/**
 * Teste rápido da conexão com a Azure: chama cada implantação configurada com uma pergunta mínima.
 * Uso (dentro de web/):  node --env-file=.env.local scripts/testar-azure.mts
 */
import OpenAI from "openai";

const base = (process.env.AZURE_OPENAI_ENDPOINT ?? "").replace(/\/+$/, "");
const cliente = new OpenAI({ baseURL: `${base}/openai/v1/`, apiKey: process.env.AZURE_OPENAI_API_KEY, maxRetries: 1 });

const modelosTexto = [process.env.MODELO_RAPIDO ?? "gpt-5-mini-1", process.env.MODELO_PRINCIPAL ?? "gpt-6-1-sol", "gpt-5-5"];
const modeloEmbedding = process.env.MODELO_EMBEDDING ?? "text-embedding-3-large";

for (const modelo of [...new Set(modelosTexto)]) {
  const inicio = Date.now();
  try {
    const r = await cliente.responses.create({
      model: modelo,
      input: "Classifique: 'Qual a diferença entre extinção e reconsolidação?'",
      instructions: "Responda em JSON.",
      reasoning: { effort: "low" },
      text: {
        format: {
          type: "json_schema",
          name: "teste",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["tema"],
            properties: { tema: { type: "string" } },
          },
        },
      },
      store: false,
    });
    console.log(`ok   ${modelo.padEnd(24)} ${Date.now() - inicio}ms  ${r.output_text.slice(0, 80)}`);
  } catch (erro) {
    console.log(`erro ${modelo.padEnd(24)} ${(erro as Error).message.slice(0, 140)}`);
  }
}

try {
  const e = await cliente.embeddings.create({ model: modeloEmbedding, input: "teste", dimensions: 1536 });
  console.log(`ok   ${modeloEmbedding.padEnd(24)} ${e.data[0].embedding.length} dimensões`);
} catch (erro) {
  console.log(`erro ${modeloEmbedding.padEnd(24)} ${(erro as Error).message.slice(0, 140)}`);
}
