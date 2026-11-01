import OpenAI from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ConfigAgentes } from "./config";

let openai: OpenAI | null = null;
let supabase: SupabaseClient | null = null;

/** Cliente dos modelos na Azure, pelo endpoint v1 (mesmo formato da API da OpenAI). */
export function clienteModelos(config: ConfigAgentes): OpenAI {
  if (!openai) {
    const base = config.azureEndpoint.replace(/\/+$/, "");
    openai = new OpenAI({
      baseURL: `${base}/openai/v1/`,
      apiKey: config.azureApiKey,
      maxRetries: 2,
      timeout: 60_000,
    });
  }
  return openai;
}

/** Cliente do Supabase com a chave do servidor. Nunca deve chegar ao navegador. */
export function clienteBanco(config: ConfigAgentes): SupabaseClient {
  if (!supabase) {
    supabase = createClient(config.supabaseUrl, config.supabaseChaveServidor, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabase;
}
