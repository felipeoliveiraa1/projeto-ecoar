/**
 * Carrega os trechos do material (../conhecimento/trechos.jsonl) no Supabase, com embeddings da Azure.
 *
 * Uso (dentro de web/):  node --env-file=.env.local scripts/ingerir-trechos.mts
 *
 * Cada trecho recebe uma frase de contexto (aula, tema, minutos) antes do embedding
 * ("contextual retrieval"), o que ajuda a busca a achar o trecho certo.
 * Pode rodar de novo sempre que o material mudar: os trechos são atualizados pelo id.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const DIMENSOES = 1536;
const LOTE = 48;

interface Trecho {
  id: string;
  colecao: string;
  fonte: "aula" | "documento";
  aula?: number;
  titulo?: string;
  documento?: string;
  pagina_inicio?: number | null;
  pagina_fim?: number | null;
  minuto_inicio?: string;
  minuto_fim?: string;
  citacao: string;
  texto: string;
}

function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Falta a variável ${nome} no .env.local`);
  return valor;
}

function contexto(t: Trecho): string {
  if (t.fonte === "aula") {
    const titulo = (t.titulo ?? "").replace(/^\d+\s*-\s*/, "");
    return `Aula ${t.aula} ("${titulo}") do curso ECOAR Experience #10, de Rafael Barreiros, sobre o Método RB7 — trecho de ${t.minuto_inicio} a ${t.minuto_fim}.`;
  }
  const paginas = t.pagina_inicio ? `, página ${t.pagina_inicio}${t.pagina_fim && t.pagina_fim !== t.pagina_inicio ? ` a ${t.pagina_fim}` : ""}` : "";
  return `Material de apoio do Método RB7: "${t.documento}"${paginas}.`;
}

async function main() {
  const arquivo = process.env.TRECHOS_PATH ?? path.join(process.cwd(), "..", "conhecimento", "trechos.jsonl");
  const trechos = (await readFile(arquivo, "utf-8"))
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Trecho);

  const azure = exigir("AZURE_OPENAI_ENDPOINT").replace(/\/+$/, "");
  const openai = new OpenAI({ baseURL: `${azure}/openai/v1/`, apiKey: exigir("AZURE_OPENAI_API_KEY"), maxRetries: 6 });
  const modelo = process.env.MODELO_EMBEDDING ?? "text-embedding-3-large";
  const supabase = createClient(exigir("SUPABASE_URL"), exigir("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`${trechos.length} trechos para carregar (modelo ${modelo}, ${DIMENSOES} dimensões)`);
  let feitos = 0;
  let tokens = 0;
  for (let i = 0; i < trechos.length; i += LOTE) {
    const lote = trechos.slice(i, i + LOTE);
    const contextos = lote.map(contexto);
    const entradas = lote.map((t, k) => `${contextos[k]}\n\n${t.texto}`.slice(0, 24_000));
    const resposta = await openai.embeddings.create({ model: modelo, input: entradas, dimensions: DIMENSOES });
    tokens += resposta.usage?.total_tokens ?? 0;

    const linhas = lote.map((t, k) => ({
      id: t.id,
      colecao: t.colecao,
      fonte: t.fonte,
      aula: t.aula ?? null,
      titulo: t.titulo ?? null,
      documento: t.documento ?? null,
      pagina_inicio: t.pagina_inicio ?? null,
      pagina_fim: t.pagina_fim ?? null,
      minuto_inicio: t.minuto_inicio ?? null,
      minuto_fim: t.minuto_fim ?? null,
      citacao: t.citacao,
      texto: t.texto,
      contexto: contextos[k],
      embedding: JSON.stringify(resposta.data[k].embedding),
      atualizado_em: new Date().toISOString(),
    }));
    const { error } = await supabase.from("trechos").upsert(linhas, { onConflict: "id" });
    if (error) throw new Error(`Falha ao gravar no Supabase: ${error.message}`);
    feitos += lote.length;
    process.stdout.write(`\r${feitos}/${trechos.length} trechos carregados`);
  }

  // Remove do banco trechos que não existem mais no arquivo.
  const ids = new Set(trechos.map((t) => t.id));
  const { data: existentes, error: erroLista } = await supabase.from("trechos").select("id");
  if (erroLista) throw new Error(erroLista.message);
  const sobrando = (existentes ?? []).map((r) => r.id as string).filter((id) => !ids.has(id));
  if (sobrando.length) {
    const { error } = await supabase.from("trechos").delete().in("id", sobrando);
    if (error) throw new Error(error.message);
  }
  console.log(`\nPronto: ${feitos} trechos, ${tokens} tokens de embedding, ${sobrando.length} trechos antigos removidos.`);
}

main().catch((erro) => {
  console.error(`\nErro: ${(erro as Error).message}`);
  process.exit(1);
});
