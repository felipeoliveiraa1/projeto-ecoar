import { lerConfig } from "@/lib/agente/config";
import { executarAgente } from "@/lib/agente/grafo";
import { ATALHOS } from "@/lib/atalhos";
import type { EventoChat, Fonte, Papel } from "@/lib/chat/tipos";
import { buscar, type ResultadoBusca } from "@/lib/server/busca";
import { RESPOSTA_CRISE, temSinalDeCrise } from "@/lib/server/seguranca";

/*
 * API do chat. Responde em NDJSON (um evento por linha: texto, fontes, erro, fim).
 * - Com as variáveis da Azure e do Supabase configuradas: agentes do Método RB7 (LangGraph + RAG híbrido).
 * - Sem elas: MODO PRÉVIA, que mostra os trechos reais do material mais ligados à pergunta.
 * LGPD: o conteúdo das mensagens nunca vai para o log.
 */

// Respostas longas (roteiro de sessão) podem levar até ~40s; a Vercel corta no limite abaixo.
export const maxDuration = 120;

const MAX_MENSAGENS = 40;
const MAX_CARACTERES = 6000;

interface MensagemRecebida {
  papel: Papel;
  texto: string;
}

function validar(corpo: unknown): { mensagens: MensagemRecebida[]; atalho?: string } | null {
  if (!corpo || typeof corpo !== "object") return null;
  const { mensagens, atalho } = corpo as { mensagens?: unknown; atalho?: unknown };
  if (!Array.isArray(mensagens) || mensagens.length === 0 || mensagens.length > MAX_MENSAGENS) return null;
  const validas = mensagens.filter(
    (m): m is MensagemRecebida =>
      !!m &&
      typeof m === "object" &&
      ((m as MensagemRecebida).papel === "usuario" || (m as MensagemRecebida).papel === "assistente") &&
      typeof (m as MensagemRecebida).texto === "string",
  );
  if (validas.length !== mensagens.length || validas.at(-1)?.papel !== "usuario") return null;
  const tituloAtalho = typeof atalho === "string" ? ATALHOS.find((a) => a.id === atalho)?.titulo : undefined;
  return {
    mensagens: validas.map((m) => ({ papel: m.papel, texto: m.texto.slice(0, MAX_CARACTERES) })),
    atalho: tituloAtalho,
  };
}

// ---------- Modo prévia ----------

const SEM_RESULTADO =
  "Não encontrei nada sobre isso no material do Método RB7 que tenho até agora. Tente perguntar com outras palavras ou citar o tema da aula.";
const INDICE_INDISPONIVEL =
  "Ainda não consegui carregar o material do curso neste ambiente. Esta é uma prévia da interface: as respostas do agente chegam na próxima etapa.";

function fonteDaPrevia(resultado: ResultadoBusca): Fonte {
  const { trecho, destaque, minuto } = resultado;
  if (trecho.fonte === "aula") {
    const tituloLimpo = (trecho.titulo ?? "").replace(/^\d+\s*-\s*/, "");
    return {
      id: trecho.id,
      citacao: `Aula ${trecho.aula} — ${tituloLimpo}${minuto ? `, ${minuto}` : ""}`,
      destaque,
      texto: trecho.texto,
      tipo: "aula",
    };
  }
  return {
    id: trecho.id,
    citacao: trecho.citacao,
    destaque,
    texto: trecho.texto.replace(/([^\n])\n(?!\n)/g, "$1 ").replace(/[ \t]{2,}/g, " "),
    tipo: "documento",
  };
}

async function* respostaPrevia(pergunta: string): AsyncGenerator<EventoChat> {
  if (temSinalDeCrise(pergunta)) {
    yield* emPartes(RESPOSTA_CRISE);
    return;
  }
  let resultados: ResultadoBusca[] | null;
  try {
    resultados = await buscar(pergunta, ["metodo"], 3);
  } catch {
    console.error("[chat] índice de trechos indisponível");
    resultados = null;
  }
  if (resultados === null) return yield* emPartes(INDICE_INDISPONIVEL);
  if (!resultados.length) return yield* emPartes(SEM_RESULTADO);
  const fontes = resultados.map(fonteDaPrevia);
  const itens = fontes.map((f, i) => `**${i + 1}. ${f.citacao}**\n\n> ${f.destaque}`).join("\n\n");
  yield* emPartes(
    [
      "Estou em **modo prévia**: as respostas completas do agente ainda estão sendo preparadas. Por enquanto, estes são os trechos do material do Método RB7 que mais têm a ver com a sua mensagem:",
      itens,
      "Toque em uma fonte abaixo para ler o trecho completo.",
    ].join("\n\n"),
  );
  yield { tipo: "fontes", fontes };
}

async function* emPartes(texto: string): AsyncGenerator<EventoChat> {
  const pedacos = texto.match(/\S+\s*/g) ?? [texto];
  for (let i = 0; i < pedacos.length; i += 4) {
    yield { tipo: "texto", conteudo: pedacos.slice(i, i + 4).join("") };
    await new Promise((resolver) => setTimeout(resolver, 16));
  }
}

// ---------- Rota ----------

export async function POST(request: Request) {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  const pedido = validar(corpo);
  if (!pedido) return Response.json({ erro: "Pedido inválido." }, { status: 400 });

  const config = lerConfig();
  const codificador = new TextEncoder();
  const controle = new AbortController();
  request.signal.addEventListener("abort", () => controle.abort());

  const fluxo = new ReadableStream<Uint8Array>({
    async start(saida) {
      const emitir = (evento: EventoChat) => {
        if (!controle.signal.aborted) saida.enqueue(codificador.encode(`${JSON.stringify(evento)}\n`));
      };
      const inicio = Date.now();
      try {
        const eventos = config
          ? executarAgente(config, pedido.mensagens, pedido.atalho, controle.signal)
          : respostaPrevia(pedido.mensagens.at(-1)!.texto);
        for await (const evento of eventos) {
          if (controle.signal.aborted) break;
          emitir(evento);
        }
        emitir({ tipo: "fim" });
        // Só metadados no log (LGPD): modo e tempo, nunca o conteúdo.
        console.info(`[chat] modo=${config ? "agente" : "previa"} ms=${Date.now() - inicio}`);
      } catch (erro) {
        if (!controle.signal.aborted) {
          console.error(`[chat] falha (${(erro as Error).name}) ms=${Date.now() - inicio}`);
          emitir({ tipo: "erro", mensagem: "Não consegui responder agora. Tente novamente em instantes." });
        }
      } finally {
        if (!controle.signal.aborted) saida.close();
      }
    },
    cancel() {
      controle.abort();
    },
  });

  return new Response(fluxo, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
