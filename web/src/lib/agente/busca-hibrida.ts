import { clienteBanco, clienteModelos } from "./clientes";
import { DIMENSOES_EMBEDDING, type ConfigAgentes } from "./config";

/** Trecho do material devolvido pela busca híbrida no Supabase. */
export interface TrechoRecuperado {
  id: string;
  colecao: string;
  fonte: "aula" | "documento";
  aula: number | null;
  titulo: string | null;
  documento: string | null;
  pagina_inicio: number | null;
  pagina_fim: number | null;
  minuto_inicio: string | null;
  minuto_fim: string | null;
  citacao: string;
  texto: string;
  pontuacao: number;
}

export async function gerarEmbedding(config: ConfigAgentes, texto: string): Promise<number[]> {
  const resposta = await clienteModelos(config).embeddings.create({
    model: config.modeloEmbedding,
    input: texto,
    dimensions: DIMENSOES_EMBEDDING,
  });
  return resposta.data[0].embedding;
}

/**
 * Busca híbrida: palavras em português (sem acento) + significado (embeddings),
 * combinadas no banco por Reciprocal Rank Fusion. Ver supabase/migrations.
 */
export async function buscarTrechos(
  config: ConfigAgentes,
  consulta: string,
  colecoes: string[],
  quantidade = 24,
): Promise<TrechoRecuperado[]> {
  const embedding = await gerarEmbedding(config, consulta);
  const { data, error } = await clienteBanco(config).rpc("buscar_trechos", {
    consulta,
    consulta_embedding: embedding,
    colecoes,
    quantidade,
  });
  if (error) throw new Error(`Falha na busca de trechos: ${error.message}`);
  return (data ?? []) as TrechoRecuperado[];
}
