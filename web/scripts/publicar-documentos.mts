/**
 * Publica os documentos-base dos agentes no Supabase (tabela documentos_base).
 * Uso (dentro de web/):  node --env-file=.env.local scripts/publicar-documentos.mts
 *
 * Os arquivos vêm de ../conhecimento/ (fora do repositório, porque derivam do curso).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DOCUMENTOS = [
  { slug: "mapa-do-metodo", titulo: "Mapa do Método RB7 / ECOAR", arquivo: "mapa-do-metodo.md" },
  { slug: "casos", titulo: "Biblioteca de casos", arquivo: "casos.md" },
  { slug: "voz-do-rafael", titulo: "Voz do Rafael", arquivo: "voz-do-rafael.md" },
  { slug: "glossario", titulo: "Glossário do método", arquivo: "glossario.md" },
  { slug: "faq", titulo: "Perguntas frequentes", arquivo: "faq.md" },
];

const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_SECRET_KEY;
if (!url || !chave) throw new Error("Faltam SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local");
const supabase = createClient(url, chave, { auth: { persistSession: false } });

const versao = new Date().toISOString().slice(0, 10);
for (const doc of DOCUMENTOS) {
  const caminho = path.join(process.cwd(), "..", "conhecimento", doc.arquivo);
  let conteudo: string;
  try {
    conteudo = await readFile(caminho, "utf-8");
  } catch {
    console.log(`pulei  ${doc.slug} (arquivo não encontrado)`);
    continue;
  }
  const { error } = await supabase
    .from("documentos_base")
    .upsert({ slug: doc.slug, titulo: doc.titulo, conteudo, versao, atualizado_em: new Date().toISOString() });
  if (error) throw new Error(`${doc.slug}: ${error.message}`);
  console.log(`ok     ${doc.slug.padEnd(16)} ${conteudo.split(/\s+/).length} palavras`);
}
