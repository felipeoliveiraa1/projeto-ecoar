/**
 * Configuração dos agentes, lida das variáveis de ambiente (web/.env.local no Mac,
 * variáveis de ambiente do projeto na Vercel). Nenhuma chave fica no código.
 */
export interface ConfigAgentes {
  azureEndpoint: string;
  azureApiKey: string;
  modeloPrincipal: string;
  modeloRapido: string;
  modeloEmbedding: string;
  supabaseUrl: string;
  supabaseChaveServidor: string;
}

let configEmCache: ConfigAgentes | null | undefined;

/** Lê a configuração uma vez por processo. Devolve null se faltar alguma variável (aí a API usa o modo prévia). */
export function lerConfig(): ConfigAgentes | null {
  if (configEmCache === undefined) configEmCache = montarConfig();
  return configEmCache;
}

function montarConfig(): ConfigAgentes | null {
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseChaveServidor = process.env.SUPABASE_SECRET_KEY;
  if (!azureEndpoint || !azureApiKey || !supabaseUrl || !supabaseChaveServidor) return null;
  return {
    azureEndpoint,
    azureApiKey,
    // Nomes das implantações na Azure.
    modeloPrincipal: process.env.MODELO_PRINCIPAL ?? "gpt-6-1-sol",
    modeloRapido: process.env.MODELO_RAPIDO ?? "gpt-5-mini-1",
    modeloEmbedding: process.env.MODELO_EMBEDDING ?? "text-embedding-3-large",
    supabaseUrl,
    supabaseChaveServidor,
  };
}

/** Dimensões do embedding (text-embedding-3-large reduzido; precisa bater com a coluna no banco). */
export const DIMENSOES_EMBEDDING = 1536;
