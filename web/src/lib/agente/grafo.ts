import { Annotation, END, START, StateGraph, type LangGraphRunnableConfig } from "@langchain/langgraph";
import type OpenAI from "openai";
import type { EventoChat, Fonte, Papel } from "@/lib/chat/tipos";
import { RESPOSTA_CRISE, temSinalDeCrise } from "@/lib/server/seguranca";
import { buscarTrechos, type TrechoRecuperado } from "./busca-hibrida";
import { clienteModelos } from "./clientes";
import { carregarDocumento } from "./documentos";
import type { ConfigAgentes } from "./config";
import {
  ESQUEMA_PLANEJADOR,
  ESQUEMA_REORDENADOR,
  ESQUEMA_REVISOR,
  INSTRUCOES_PLANEJADOR,
  INSTRUCOES_REORDENADOR,
  INSTRUCOES_REVISOR_CONTEUDO,
  instrucoesDoAgente,
  type Intencao,
} from "./prompts";

/*
 * Grafo do Agente RB7 (LangGraph):
 *
 *   segurança ─┬─(risco)──────────────────────────────▶ crise ─▶ fim
 *              └─▶ planejar ─┬─(risco)─────────────────▶ crise
 *                            ├─(conversa/fora)────────▶ responder ─▶ verificar ─▶ fim
 *                            └─▶ buscar ─▶ reordenar ─▶ responder ─▶ verificar ─▶ fim
 *
 * O texto da resposta vai para a tela em tempo real (stream "custom"); as fontes
 * citadas seguem no fim, depois de conferidas.
 */

interface MensagemConversa {
  papel: Papel;
  texto: string;
}

const MAX_SELECIONADOS = 6;
const CANDIDATOS_BUSCA = 16;
const HISTORICO_RESPOSTA = 10;

const EstadoAgente = Annotation.Root({
  mensagens: Annotation<MensagemConversa[]>,
  atalho: Annotation<string | undefined>,
  risco: Annotation<boolean>,
  intencao: Annotation<Intencao>,
  consultaBusca: Annotation<string>,
  candidatos: Annotation<TrechoRecuperado[]>,
  selecionados: Annotation<TrechoRecuperado[]>,
  resposta: Annotation<string>,
});

type Estado = typeof EstadoAgente.State;

const ESFORCO: Record<Intencao, "low" | "medium"> = {
  duvida_metodo: "low",
  sessao: "medium",
  treino: "low",
  conteudo: "medium",
  fora_do_escopo: "low",
  conversa: "low",
};

const ultimaPergunta = (mensagens: MensagemConversa[]) =>
  [...mensagens].reverse().find((m) => m.papel === "usuario")?.texto ?? "";

function emitir(config: LangGraphRunnableConfig, evento: EventoChat) {
  config.writer?.(evento);
}

async function emitirTextoEmPartes(config: LangGraphRunnableConfig, texto: string) {
  const pedacos = texto.match(/\S+\s*/g) ?? [texto];
  for (let i = 0; i < pedacos.length; i += 6) {
    emitir(config, { tipo: "texto", conteudo: pedacos.slice(i, i + 6).join("") });
    await new Promise((r) => setTimeout(r, 12));
  }
}

/** Chama a Responses API; se o modelo não aceitar o parâmetro de raciocínio, tenta sem ele. */
async function criarResposta(
  cliente: OpenAI,
  params: OpenAI.Responses.ResponseCreateParamsNonStreaming,
): Promise<OpenAI.Responses.Response> {
  try {
    return await cliente.responses.create(params);
  } catch (erro) {
    if (params.reasoning && /reasoning/i.test(String((erro as Error).message))) {
      return cliente.responses.create({ ...params, reasoning: undefined });
    }
    throw erro;
  }
}

async function respostaJson<T>(
  cliente: OpenAI,
  modelo: string,
  instrucoes: string,
  entrada: string,
  nome: string,
  esquema: Record<string, unknown>,
  esforco: "minimal" | "low" = "low",
): Promise<T> {
  const resposta = await criarResposta(cliente, {
    model: modelo,
    instructions: instrucoes,
    input: entrada,
    reasoning: { effort: esforco },
    text: { format: { type: "json_schema", name: nome, schema: esquema, strict: true } },
    store: false,
  });
  return JSON.parse(resposta.output_text) as T;
}

function conversaComoTexto(mensagens: MensagemConversa[], atalho?: string): string {
  const recentes = mensagens.slice(-8).map((m) => {
    const quem = m.papel === "usuario" ? "Usuário" : "Agente";
    const texto = m.texto.length > 1500 ? `${m.texto.slice(0, 1500)}…` : m.texto;
    return `${quem}: ${texto}`;
  });
  return `${atalho ? `(Atalho usado na tela: ${atalho})\n\n` : ""}${recentes.join("\n\n")}`;
}

function rotuloDoTrecho(t: TrechoRecuperado): string {
  if (t.fonte === "aula") {
    const titulo = (t.titulo ?? "").replace(/^\d+\s*-\s*/, "");
    const faixa = t.minuto_inicio && t.minuto_fim && t.minuto_inicio !== t.minuto_fim
      ? `${t.minuto_inicio}–${t.minuto_fim}`
      : (t.minuto_inicio ?? "");
    return `Aula ${t.aula} — ${titulo}${faixa ? `, ${faixa}` : ""}`;
  }
  return t.citacao;
}

function citacaoCurta(t: TrechoRecuperado): string {
  if (t.fonte === "aula") {
    const titulo = (t.titulo ?? "").replace(/^\d+\s*-\s*/, "");
    return `Aula ${t.aula} — ${titulo}${t.minuto_inicio ? `, ${t.minuto_inicio}` : ""}`;
  }
  return t.citacao;
}

function paraFonte(t: TrechoRecuperado, numero: number): Fonte {
  const textoLimpo = t.fonte === "documento"
    ? t.texto.replace(/([^\n])\n(?!\n)/g, "$1 ").replace(/[ \t]{2,}/g, " ")
    : t.texto;
  const corpo = textoLimpo.replace(/\[\d+:\d{2}(?::\d{2})?\]\s*/g, "");
  return {
    id: t.id,
    citacao: citacaoCurta(t),
    destaque: corpo.length > 220 ? `${corpo.slice(0, 220)}…` : corpo,
    texto: textoLimpo,
    tipo: t.fonte,
    numero,
  };
}

const numeroDoTrecho = (id: string) => Number.parseInt(id.split("-").pop() ?? "0", 10);

/** Remove trechos vizinhos da mesma aula (eles se sobrepõem em um parágrafo). */
function semVizinhos(trechos: TrechoRecuperado[]): TrechoRecuperado[] {
  const escolhidos: TrechoRecuperado[] = [];
  for (const t of trechos) {
    const vizinho = escolhidos.some(
      (e) => e.fonte === "aula" && t.fonte === "aula" && e.aula === t.aula &&
        Math.abs(numeroDoTrecho(e.id) - numeroDoTrecho(t.id)) <= 1,
    );
    if (!vizinho) escolhidos.push(t);
  }
  return escolhidos;
}

export function criarGrafo(cfg: ConfigAgentes) {
  const cliente = clienteModelos(cfg);

  const seguranca = async (estado: Estado) => ({ risco: temSinalDeCrise(ultimaPergunta(estado.mensagens)) });

  const crise = async (_estado: Estado, config: LangGraphRunnableConfig) => {
    await emitirTextoEmPartes(config, RESPOSTA_CRISE);
    return { resposta: RESPOSTA_CRISE, selecionados: [] };
  };

  const planejar = async (estado: Estado, config: LangGraphRunnableConfig) => {
    emitir(config, { tipo: "etapa", etapa: "Entendendo o pedido" });
    const plano = await respostaJson<{ intencao: Intencao; consulta_busca: string; risco: boolean }>(
      cliente,
      cfg.modeloRapido,
      INSTRUCOES_PLANEJADOR,
      conversaComoTexto(estado.mensagens, estado.atalho),
      "plano",
      ESQUEMA_PLANEJADOR,
    );
    return {
      intencao: plano.intencao,
      consultaBusca: plano.consulta_busca.trim() || ultimaPergunta(estado.mensagens),
      risco: plano.risco,
    };
  };

  const buscar = async (estado: Estado, config: LangGraphRunnableConfig) => {
    emitir(config, { tipo: "etapa", etapa: "Buscando nas aulas e apostilas" });
    const colecoes = estado.intencao === "conteudo" ? ["metodo", "conteudo"] : ["metodo"];
    const candidatos = await buscarTrechos(cfg, estado.consultaBusca, colecoes, CANDIDATOS_BUSCA);
    return { candidatos };
  };

  const reordenar = async (estado: Estado, config: LangGraphRunnableConfig) => {
    emitir(config, { tipo: "etapa", etapa: "Escolhendo os trechos mais relevantes" });
    const candidatos = semVizinhos(estado.candidatos ?? []);
    if (candidatos.length <= 3) return { selecionados: candidatos };
    const lista = candidatos
      .map((t) => `id: ${t.id}\nfonte: ${rotuloDoTrecho(t)}\ntexto: ${t.texto.replace(/\s+/g, " ").slice(0, 600)}`)
      .join("\n\n---\n\n");
    const { notas } = await respostaJson<{ notas: { id: string; nota: number }[] }>(
      cliente,
      cfg.modeloRapido,
      INSTRUCOES_REORDENADOR,
      `PERGUNTA: ${estado.consultaBusca}\n\nCANDIDATOS:\n\n${lista}`,
      "notas",
      ESQUEMA_REORDENADOR,
      "minimal",
    );
    const nota = new Map(notas.map((n) => [n.id, n.nota]));
    const ordenados = candidatos
      .map((t, posicao) => ({ t, nota: nota.get(t.id) ?? 0, posicao }))
      .sort((a, b) => b.nota - a.nota || a.posicao - b.posicao);
    let selecionados = ordenados.filter((x) => x.nota >= 2).slice(0, MAX_SELECIONADOS).map((x) => x.t);
    if (!selecionados.length) selecionados = ordenados.filter((x) => x.nota >= 1).slice(0, 3).map((x) => x.t);
    return { selecionados };
  };

  const responder = async (estado: Estado, config: LangGraphRunnableConfig) => {
    const intencao = estado.intencao ?? "duvida_metodo";
    const selecionados = estado.selecionados ?? [];
    emitir(config, { tipo: "etapa", etapa: intencao === "conteudo" ? "Escrevendo e revisando o conteúdo" : "Escrevendo a resposta" });
    const mapa = await carregarDocumento(cfg, "mapa-do-metodo");
    const blocoFontes = selecionados.length
      ? selecionados.map((t, i) => `[${i + 1}] ${rotuloDoTrecho(t)}\n${t.texto}`).join("\n\n")
      : "(nenhuma fonte encontrada no material para este pedido)";

    const historico = estado.mensagens.slice(-HISTORICO_RESPOSTA);
    const anteriores = historico.slice(0, -1).map((m) => ({
      role: m.papel === "usuario" ? ("user" as const) : ("assistant" as const),
      content: m.texto,
    }));
    const pedidoAtual = `FONTES:\n\n${blocoFontes}\n\n---\n\nMENSAGEM DO USUÁRIO:\n${ultimaPergunta(estado.mensagens)}`;
    const base = {
      model: cfg.modeloPrincipal,
      instructions: instrucoesDoAgente(intencao, mapa),
      input: [...anteriores, { role: "user" as const, content: pedidoAtual }],
      reasoning: { effort: ESFORCO[intencao] },
      max_output_tokens: 6000,
      store: false,
    };

    if (intencao === "conteudo") {
      // Conteúdo passa por um revisor antes de chegar à tela.
      const rascunho = (await criarResposta(cliente, base)).output_text;
      const revisao = await respostaJson<{ aprovado: boolean; ajustes: string[]; texto_final: string }>(
        cliente,
        cfg.modeloRapido,
        INSTRUCOES_REVISOR_CONTEUDO,
        rascunho,
        "revisao",
        ESQUEMA_REVISOR,
      );
      const final = revisao.aprovado ? rascunho : revisao.texto_final;
      await emitirTextoEmPartes(config, final);
      return { resposta: final };
    }

    let texto = "";
    const enviarParams = { ...base, stream: true as const };
    let fluxo: AsyncIterable<OpenAI.Responses.ResponseStreamEvent>;
    try {
      fluxo = await cliente.responses.create(enviarParams);
    } catch (erro) {
      if (!/reasoning/i.test(String((erro as Error).message))) throw erro;
      fluxo = await cliente.responses.create({ ...enviarParams, reasoning: undefined });
    }
    for await (const evento of fluxo) {
      if (evento.type === "response.output_text.delta") {
        texto += evento.delta;
        emitir(config, { tipo: "texto", conteudo: evento.delta });
      }
    }
    return { resposta: texto };
  };

  const verificar = async (estado: Estado, config: LangGraphRunnableConfig) => {
    const selecionados = estado.selecionados ?? [];
    const citados = new Set<number>();
    for (const m of (estado.resposta ?? "").matchAll(/\[(\d{1,2})\]/g)) {
      const n = Number(m[1]);
      if (n >= 1 && n <= selecionados.length) citados.add(n);
    }
    const fontes = [...citados].sort((a, b) => a - b).map((n) => paraFonte(selecionados[n - 1], n));
    if (fontes.length) emitir(config, { tipo: "fontes", fontes });
    return {};
  };

  return new StateGraph(EstadoAgente)
    .addNode("seguranca", seguranca)
    .addNode("crise", crise)
    .addNode("planejar", planejar)
    .addNode("buscar", buscar)
    .addNode("reordenar", reordenar)
    .addNode("responder", responder)
    .addNode("verificar", verificar)
    .addEdge(START, "seguranca")
    .addConditionalEdges("seguranca", (e: Estado) => (e.risco ? "crise" : "planejar"), ["crise", "planejar"])
    .addConditionalEdges(
      "planejar",
      (e: Estado) => (e.risco ? "crise" : e.intencao === "conversa" || e.intencao === "fora_do_escopo" ? "responder" : "buscar"),
      ["crise", "responder", "buscar"],
    )
    .addEdge("buscar", "reordenar")
    .addEdge("reordenar", "responder")
    .addEdge("responder", "verificar")
    .addEdge("verificar", END)
    .addEdge("crise", END)
    .compile();
}

let grafoEmCache: { cfg: ConfigAgentes; grafo: ReturnType<typeof criarGrafo> } | null = null;

export function obterGrafo(cfg: ConfigAgentes) {
  if (!grafoEmCache || grafoEmCache.cfg !== cfg) grafoEmCache = { cfg, grafo: criarGrafo(cfg) };
  return grafoEmCache.grafo;
}

/** Roda o grafo e entrega os eventos para a tela (texto em tempo real e fontes no fim). */
export async function* executarAgente(
  cfg: ConfigAgentes,
  mensagens: MensagemConversa[],
  atalho: string | undefined,
  sinal?: AbortSignal,
): AsyncGenerator<EventoChat> {
  const grafo = obterGrafo(cfg);
  const fluxo = await grafo.stream({ mensagens, atalho }, { streamMode: "custom", signal: sinal });
  for await (const evento of fluxo) yield evento as EventoChat;
}
