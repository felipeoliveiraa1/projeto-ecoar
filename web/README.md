# Agente de IA · Método RB7 — interface

Interface de chat do Agente RB7 (identidade visual da Escola Plano Ecoar): Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui (Base UI), Lucide e Motion.

## Rodar

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

Antes de publicar, rode `npx tsc --noEmit`, `npm run lint` e `npm run build`.

## Como está organizado

| Onde | O quê |
| --- | --- |
| `src/components/chat/` | `ChatApp` (tela), `ChatHeader`, `WelcomeHero`, `GoldBrain`, `NeuralWaves`, `QuickActions`, `ChatMessages`, `MessageBubble`, `ChatInput`, `TypingIndicator`, `SourceSheet` |
| `src/hooks/` | `use-chat` (estado e streaming da conversa) e `use-rolagem-automatica` (acompanha a resposta sem puxar a tela de quem está relendo) |
| `src/lib/atalhos.ts` | Os 5 atalhos da tela inicial (só preenchem o campo de mensagem) |
| `src/lib/chat/` | Tipos e o cliente da API (`servico.ts`) — a única ponte entre a interface e o agente |
| `src/app/api/chat/route.ts` | API do chat (resposta em NDJSON, uma linha por evento) |
| `src/lib/server/` | Busca nos trechos do curso (`busca.ts`) e regras fixas de segurança (`seguranca.ts`) |
| `public/cerebro-rb7.png` | Cérebro dourado (PNG transparente) |

## Modo prévia

Enquanto os agentes não estão ligados, a API responde em **modo prévia**: busca (BM25) nos trechos reais das aulas e apostilas (`../conhecimento/trechos.jsonl`) e mostra os mais relevantes, com a fonte. Nada é inventado. Para usar outro arquivo de trechos, defina `TRECHOS_PATH`.

Mensagens com sinal de risco à vida recebem sempre a resposta de segurança (CVV 188, SAMU 192), antes de qualquer outra coisa.

## Privacidade (LGPD)

- A API não grava o conteúdo das mensagens em log.
- Os atalhos e o anexo lembram de não usar dados que identifiquem o cliente.
- As respostas não são apresentadas como diagnóstico.

## Próximos passos

- Ligar a API aos agentes (Azure OpenAI) mantendo o mesmo formato de eventos: `texto`, `fontes`, `erro`, `fim`.
- Anonimizar nomes de participantes nos trechos antes do lançamento.
- Login de alunos, histórico e avaliação das respostas (Supabase, quando for para produção).
