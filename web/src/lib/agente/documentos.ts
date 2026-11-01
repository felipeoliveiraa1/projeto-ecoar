import { readFile } from "node:fs/promises";
import path from "node:path";
import { clienteBanco } from "./clientes";
import type { ConfigAgentes } from "./config";

/*
 * Documentos-base dos agentes (Mapa do Método, casos…). A fonte oficial é a tabela
 * documentos_base no Supabase, publicada por scripts/publicar-documentos.mts. No Mac,
 * se o banco não tiver o documento, cai no arquivo de ../conhecimento/.
 */

const VALIDADE_MS = 10 * 60 * 1000;
const cache = new Map<string, { conteudo: string; lidoEm: number }>();

async function lerDoArquivo(slug: string): Promise<string> {
  try {
    const caminho = path.join(process.cwd(), "..", "conhecimento", `${slug}.md`);
    return await readFile(/*turbopackIgnore: true*/ caminho, "utf-8");
  } catch {
    return "";
  }
}

export async function carregarDocumento(cfg: ConfigAgentes, slug: string): Promise<string> {
  const emCache = cache.get(slug);
  if (emCache && Date.now() - emCache.lidoEm < VALIDADE_MS) return emCache.conteudo;

  let conteudo = "";
  try {
    const { data, error } = await clienteBanco(cfg)
      .from("documentos_base")
      .select("conteudo")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    conteudo = (data?.conteudo as string | undefined) ?? "";
  } catch {
    console.error(`[agente] não consegui ler o documento ${slug} do banco`);
  }
  if (!conteudo) conteudo = await lerDoArquivo(slug);
  cache.set(slug, { conteudo, lidoEm: Date.now() });
  return conteudo;
}
