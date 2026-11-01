import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Busca por palavras-chave (BM25) nos trechos do material do curso.
 * É a recuperação do "modo prévia". Na fase dos agentes, ela ganha a busca por
 * significado (embeddings) e passa a alimentar o modelo — sem mudar a interface.
 */

export interface Trecho {
  id: string;
  colecao: string;
  fonte: "aula" | "documento";
  aula?: number;
  titulo?: string;
  documento?: string;
  pagina_inicio?: number | null;
  citacao: string;
  texto: string;
}

export interface ResultadoBusca {
  trecho: Trecho;
  pontuacao: number;
  /** Pedaço do trecho com mais termos da pergunta. */
  destaque: string;
  /** Minuto do destaque (só para aulas). */
  minuto?: string;
}

interface Indice {
  trechos: Trecho[];
  frequencias: Map<string, number>[];
  tamanhos: number[];
  documentosComTermo: Map<string, number>;
  tamanhoMedio: number;
}

const K1 = 1.2;
const B = 0.75;
const JANELA_DESTAQUE = 60; // palavras
const MARCADOR = /^\[(\d+:\d{2}(?::\d{2})?)\]\s*/;

// Palavras sem acento, porque o texto é normalizado antes da comparação.
const PALAVRAS_VAZIAS = new Set(
  `a o as os um uma uns umas de do da dos das em no na nos nas por pelo pela pelos pelas para pra pro com sem
  sob sobre e ou mas que se como quando onde porque pois ja nao sim mais menos muito muita muitos muitas pouco
  tambem so entao ai la aqui ali isso isto esse essa esses essas este esta estes estas aquele aquela aquilo eu tu
  voce voces ele ela eles elas nos me te lhe lhes meu minha meus minhas seu sua seus suas nosso nossa ser sou era
  foi sao estar estou estava ter tem tenho tinha ha vai vou vamos fazer faz fez ate ao aos num numa qual quais
  quem cada todo toda todos todas outro outra gente ne tipo coisa coisas assim bem agora ainda pode posso quero
  queria seria sera vez vezes aqui cliente paciente me ajuda ajude explica explique sobre preciso`.split(/\s+/),
);

function radical(termo: string): string {
  if (termo.length <= 4) return termo;
  if (termo.endsWith("oes") || termo.endsWith("aes")) return `${termo.slice(0, -3)}ao`;
  if (termo.endsWith("ais")) return `${termo.slice(0, -3)}al`;
  if (termo.endsWith("eis")) return `${termo.slice(0, -3)}el`;
  if (termo.endsWith("ns")) return `${termo.slice(0, -2)}m`;
  if (/[rsz]es$/.test(termo)) return termo.slice(0, -2);
  if (termo.endsWith("s")) return termo.slice(0, -1);
  return termo;
}

export function tokenizar(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\[\d+:\d{2}(?::\d{2})?\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !PALAVRAS_VAZIAS.has(t) && !/^\d+$/.test(t))
    .map(radical);
}

let indicePromessa: Promise<Indice> | null = null;

function caminhoDosTrechos(): string {
  return process.env.TRECHOS_PATH ?? path.join(process.cwd(), "..", "conhecimento", "trechos.jsonl");
}

async function montarIndice(): Promise<Indice> {
  // A base fica fora do app (pasta conhecimento/) e não deve entrar no pacote de deploy.
  const bruto = await readFile(/*turbopackIgnore: true*/ caminhoDosTrechos(), "utf-8");
  const trechos = bruto
    .split("\n")
    .filter((linha) => linha.trim())
    .map((linha) => JSON.parse(linha) as Trecho);

  const frequencias: Map<string, number>[] = [];
  const tamanhos: number[] = [];
  const documentosComTermo = new Map<string, number>();
  for (const trecho of trechos) {
    const termos = tokenizar(trecho.texto);
    const freq = new Map<string, number>();
    for (const t of termos) freq.set(t, (freq.get(t) ?? 0) + 1);
    for (const t of freq.keys()) documentosComTermo.set(t, (documentosComTermo.get(t) ?? 0) + 1);
    frequencias.push(freq);
    tamanhos.push(termos.length);
  }
  const tamanhoMedio = tamanhos.reduce((a, b) => a + b, 0) / Math.max(1, tamanhos.length);
  return { trechos, frequencias, tamanhos, documentosComTermo, tamanhoMedio };
}

export function obterIndice(): Promise<Indice> {
  if (!indicePromessa) {
    indicePromessa = montarIndice().catch((erro) => {
      indicePromessa = null; // permite tentar de novo na próxima pergunta
      throw erro;
    });
  }
  return indicePromessa;
}

function pontuar(indice: Indice, termos: string[], i: number): number {
  const freq = indice.frequencias[i];
  const tamanho = indice.tamanhos[i];
  const total = indice.trechos.length;
  let pontuacao = 0;
  for (const termo of termos) {
    const f = freq.get(termo);
    if (!f) continue;
    const n = indice.documentosComTermo.get(termo) ?? 0;
    const idf = Math.log(1 + (total - n + 0.5) / (n + 0.5));
    pontuacao += (idf * (f * (K1 + 1))) / (f + K1 * (1 - B + (B * tamanho) / indice.tamanhoMedio));
  }
  return pontuacao;
}

function destacar(trecho: Trecho, termos: Set<string>): { destaque: string; minuto?: string } {
  const palavras: { palavra: string; minuto?: string; acerto: number }[] = [];
  let minutoAtual: string | undefined;
  for (const linha of trecho.texto.split("\n")) {
    const m = linha.match(MARCADOR);
    if (m) minutoAtual = m[1];
    const resto = m ? linha.slice(m[0].length) : linha;
    for (const palavra of resto.split(/\s+/)) {
      if (!palavra) continue;
      const t = tokenizar(palavra)[0];
      palavras.push({ palavra, minuto: minutoAtual, acerto: t && termos.has(t) ? 1 : 0 });
    }
  }
  if (!palavras.length) return { destaque: "" };

  let melhorInicio = 0;
  let melhorSoma = -1;
  let soma = 0;
  for (let i = 0; i < palavras.length; i++) {
    soma += palavras[i].acerto;
    if (i >= JANELA_DESTAQUE) soma -= palavras[i - JANELA_DESTAQUE].acerto;
    const inicio = Math.max(0, i - JANELA_DESTAQUE + 1);
    if ((i >= JANELA_DESTAQUE - 1 || i === palavras.length - 1) && soma > melhorSoma) {
      melhorSoma = soma;
      melhorInicio = inicio;
    }
  }
  const fim = Math.min(palavras.length, melhorInicio + JANELA_DESTAQUE);
  const janela = palavras.slice(melhorInicio, fim);
  const primeiroAcerto = janela.find((p) => p.acerto) ?? janela[0];
  const destaque =
    (melhorInicio > 0 ? "… " : "") + janela.map((p) => p.palavra).join(" ") + (fim < palavras.length ? " …" : "");
  return { destaque, minuto: primeiroAcerto?.minuto };
}

const numeroDoTrecho = (id: string) => Number.parseInt(id.split("-").pop() ?? "0", 10);

export async function buscar(pergunta: string, colecoes: string[], limite = 3): Promise<ResultadoBusca[]> {
  const indice = await obterIndice();
  const termos = [...new Set(tokenizar(pergunta))];
  if (!termos.length) return [];

  const candidatos = indice.trechos
    .map((trecho, i) => ({ i, pontuacao: colecoes.includes(trecho.colecao) ? pontuar(indice, termos, i) : 0 }))
    .filter((c) => c.pontuacao > 0)
    .sort((a, b) => b.pontuacao - a.pontuacao);
  if (!candidatos.length) return [];

  const minimo = Math.max(1.5, candidatos[0].pontuacao * 0.4);
  const conjuntoTermos = new Set(termos);
  const escolhidos: ResultadoBusca[] = [];
  const porOrigem = new Map<string, number>();

  for (const { i, pontuacao } of candidatos) {
    if (pontuacao < minimo || escolhidos.length >= limite) break;
    const trecho = indice.trechos[i];
    const origem = trecho.fonte === "aula" ? `aula-${trecho.aula}` : `doc-${trecho.documento}`;
    // Trechos vizinhos se sobrepõem: evita mostrar dois pedaços quase iguais.
    const vizinho = escolhidos.some(
      (e) =>
        e.trecho.fonte === trecho.fonte &&
        (e.trecho.aula ?? e.trecho.documento) === (trecho.aula ?? trecho.documento) &&
        Math.abs(numeroDoTrecho(e.trecho.id) - numeroDoTrecho(trecho.id)) <= 1,
    );
    if (vizinho || (porOrigem.get(origem) ?? 0) >= 2) continue;
    escolhidos.push({ trecho, pontuacao, ...destacar(trecho, conjuntoTermos) });
    porOrigem.set(origem, (porOrigem.get(origem) ?? 0) + 1);
  }
  return escolhidos;
}
