"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, Check, Copy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Fonte, Mensagem } from "@/lib/chat/tipos";
import { cn } from "@/lib/utils";
import { BrainAvatar } from "./GoldBrain";
import { TypingIndicator } from "./TypingIndicator";

interface MessageBubbleProps {
  mensagem: Mensagem;
  aoAbrirFonte: (fonte: Fonte) => void;
}

const hora = (ms: number) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const PREFIXO_FONTE = "#fonte-";

/**
 * Transforma as citações [n] da resposta em links internos para a fonte n.
 * Enquanto a resposta chega, citações ainda sem fonte ficam como texto; no fim,
 * as que não correspondem a nenhuma fonte conferida são removidas.
 */
function prepararCitacoes(texto: string, fontes: Fonte[] | undefined, pendente: boolean): string {
  const numeros = new Set((fontes ?? []).map((f) => f.numero).filter((n): n is number => n !== undefined));
  return texto.replace(/\[(\d{1,2})\](?!\()/g, (marcador, n: string) => {
    const numero = Number(n);
    if (numeros.has(numero)) return `[${numero}](${PREFIXO_FONTE}${numero})`;
    return pendente || numeros.size === 0 ? marcador : "";
  });
}

export function MessageBubble({ mensagem, aoAbrirFonte }: MessageBubbleProps) {
  if (mensagem.papel === "usuario") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="max-w-[88%] rounded-2xl rounded-br-md border border-white/[0.07] bg-grafite px-4 py-3 text-[15.5px] leading-relaxed wrap-break-word whitespace-pre-wrap text-branco sm:max-w-[75%] sm:px-5">
          {mensagem.texto}
        </div>
        <time className="pr-1 text-xs text-cinza/60">{hora(mensagem.criadaEm)}</time>
      </div>
    );
  }

  const aguardando = mensagem.pendente && !mensagem.texto;
  const textoComCitacoes = prepararCitacoes(mensagem.texto, mensagem.fontes, Boolean(mensagem.pendente));
  const fontePorNumero = new Map((mensagem.fontes ?? []).map((f) => [f.numero, f]));

  return (
    <div className="flex items-start gap-3 sm:gap-4">
      <BrainAvatar className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "rounded-2xl rounded-tl-md border bg-[#0a0908] px-4 py-3.5 shadow-[0_0_30px_-8px_rgb(212_163_46/0.14)] sm:px-5 sm:py-4",
            mensagem.erro ? "border-destructive/60" : "border-ouro/35",
          )}
        >
          {aguardando ? (
            <TypingIndicator etapa={mensagem.etapa} />
          ) : (
            <div className="markdown-rb7">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ node, href, children, ...props }) => {
                    void node;
                    if (href?.startsWith(PREFIXO_FONTE)) {
                      const fonte = fontePorNumero.get(Number(href.slice(PREFIXO_FONTE.length)));
                      if (!fonte) return <>{children}</>;
                      return (
                        <button
                          type="button"
                          onClick={() => aoAbrirFonte(fonte)}
                          title={fonte.citacao}
                          aria-label={`Fonte ${fonte.numero}: ${fonte.citacao}`}
                          className="mx-0.5 inline-flex h-[1.35em] min-w-[1.35em] -translate-y-px items-center justify-center rounded-md border border-ouro/40 bg-ouro/10 px-1 align-middle text-[0.72em] leading-none font-semibold text-ouro-claro no-underline transition-colors duration-150 hover:border-ouro/70 hover:bg-ouro/20 focus-visible:ring-2 focus-visible:ring-ouro/60 focus-visible:outline-none"
                        >
                          {fonte.numero}
                        </button>
                      );
                    }
                    return (
                      <a href={href} {...props} target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {textoComCitacoes}
              </Markdown>
            </div>
          )}

          {mensagem.fontes && mensagem.fontes.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ouro/15 pt-3">
              <span className="mr-1 text-[11px] font-medium tracking-[0.12em] text-cinza/80 uppercase">Fontes</span>
              {mensagem.fontes.map((fonte) => (
                <button
                  key={fonte.id}
                  type="button"
                  onClick={() => aoAbrirFonte(fonte)}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-ouro/35 bg-ouro/[0.07] px-3 py-1 text-left text-[12.5px] text-ouro-claro transition-colors duration-200 hover:border-ouro/60 hover:bg-ouro/15 focus-visible:ring-2 focus-visible:ring-ouro/60 focus-visible:outline-none"
                >
                  {fonte.numero !== undefined ? (
                    <span className="grid size-4 shrink-0 place-items-center rounded bg-ouro/20 text-[10px] font-semibold">
                      {fonte.numero}
                    </span>
                  ) : (
                    <BookOpen className="size-3.5 shrink-0" aria-hidden />
                  )}
                  <span className="truncate">{fonte.citacao}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {!mensagem.pendente && mensagem.texto && (
          <div className="mt-1.5 flex items-center gap-1 pl-1">
            {!mensagem.erro && <BotaoCopiar texto={mensagem.texto} />}
            <time className="text-xs text-cinza/60">{hora(mensagem.criadaEm)}</time>
          </div>
        )}
      </div>
    </div>
  );
}

function BotaoCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setCopiado(false), 1800);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger
        onClick={copiar}
        aria-label={copiado ? "Resposta copiada" : "Copiar resposta"}
        className="grid size-8 place-items-center rounded-lg text-cinza transition-colors duration-150 hover:bg-white/5 hover:text-ouro-claro focus-visible:ring-2 focus-visible:ring-ouro/60 focus-visible:outline-none"
      >
        {copiado ? <Check className="size-4 text-ouro" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      </TooltipTrigger>
      <TooltipContent>{copiado ? "Copiado!" : "Copiar resposta"}</TooltipContent>
    </Tooltip>
  );
}
