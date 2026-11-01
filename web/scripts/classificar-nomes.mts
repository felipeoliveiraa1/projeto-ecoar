/**
 * Classifica palavras capitalizadas das transcrições para a anonimização da base do agente.
 * Entrada: JSON { palavra: { n, exemplos[] } }. Saída: ../conhecimento/anonimizacao.json
 * com os primeiros nomes de participantes, alunos e pacientes a substituir por "[participante]".
 *
 * Uso (dentro de web/):  node --env-file=.env.local scripts/classificar-nomes.mts <candidatos.json>
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

const base = (process.env.AZURE_OPENAI_ENDPOINT ?? "").replace(/\/+$/, "");
const cliente = new OpenAI({ baseURL: `${base}/openai/v1/`, apiKey: process.env.AZURE_OPENAI_API_KEY, maxRetries: 3 });
const modelo = process.env.MODELO_RAPIDO ?? "gpt-5-mini-1";

const candidatos = JSON.parse(await readFile(process.argv[2], "utf-8")) as Record<string, { n: number; exemplos: string[] }>;
const palavras = Object.entries(candidatos);
const LOTE = 120;
const nomes = new Set<string>();

const instrucoes = `Você ajuda a anonimizar transcrições de aulas de um curso de terapia dado por Rafael Barreiros.
Para cada palavra (com exemplos de contexto), decida se é o PRIMEIRO NOME ou apelido de uma pessoa comum que participou da aula ou foi citada como paciente, aluno, colega, familiar ou membro da equipe.
NÃO marque: Rafael, Barreiros, Rafa; autores, cientistas e pesquisadores (ex.: Kahneman, Sapolsky, Nader, Elman); figuras públicas e celebridades; lugares (ex.: Paulo em "São Paulo"); marcas, instituições, termos técnicos, nomes de métodos, Deus e santos; palavras comuns que só começam com maiúscula.
Responda em JSON: {"nomes": [palavras que são nomes de pessoas comuns a anonimizar]}.`;

for (let i = 0; i < palavras.length; i += LOTE) {
  const lote = palavras.slice(i, i + LOTE);
  const entrada = lote.map(([p, info]) => `- ${p} (${info.n}x): ${info.exemplos.join(" | ")}`).join("\n");
  const r = await cliente.responses.create({
    model: modelo,
    instructions: instrucoes,
    input: entrada,
    reasoning: { effort: "low" },
    text: {
      format: {
        type: "json_schema",
        name: "nomes",
        strict: true,
        schema: { type: "object", additionalProperties: false, required: ["nomes"], properties: { nomes: { type: "array", items: { type: "string" } } } },
      },
    },
    store: false,
  });
  for (const n of (JSON.parse(r.output_text) as { nomes: string[] }).nomes) if (candidatos[n]) nomes.add(n);
  process.stdout.write(`\r${Math.min(i + LOTE, palavras.length)}/${palavras.length} palavras classificadas`);
}

const lista = [...nomes].sort((a, b) => candidatos[b].n - candidatos[a].n);
const saida = path.join(process.cwd(), "..", "conhecimento", "anonimizacao.json");
await writeFile(saida, JSON.stringify({ substituto: "[participante]", nomes: lista }, null, 2) + "\n", "utf-8");
console.log(`\n${lista.length} nomes a anonimizar: ${lista.map((n) => `${n} (${candidatos[n].n})`).join(", ")}`);
