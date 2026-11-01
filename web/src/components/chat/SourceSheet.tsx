"use client";

import { BookOpen, FileText } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Fonte } from "@/lib/chat/tipos";

const MARCADOR_MINUTO = /^\[(\d+:\d{2}(?::\d{2})?)\]\s*/;

interface SourceSheetProps {
  fonte: Fonte | null;
  aoFechar: () => void;
}

/** Painel lateral que mostra o trecho completo de onde a resposta veio. */
export function SourceSheet({ fonte, aoFechar }: SourceSheetProps) {
  const ehAula = fonte?.tipo === "aula";
  const paragrafos = fonte ? fonte.texto.split(/\n+/).filter((p) => p.trim()) : [];

  return (
    <Sheet open={fonte !== null} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-l border-ouro/30 bg-superficie p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        {fonte && (
          <>
            <SheetHeader className="gap-2 border-b border-white/[0.06] px-6 pt-6 pb-5 pr-14">
              <span className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.14em] text-ouro uppercase">
                {ehAula ? <BookOpen className="size-3.5" aria-hidden /> : <FileText className="size-3.5" aria-hidden />}
                {ehAula ? "Trecho da aula" : "Trecho da apostila"}
              </span>
              <SheetTitle className="font-heading text-lg leading-snug font-semibold text-branco">{fonte.citacao}</SheetTitle>
              <SheetDescription className="text-[13px] text-cinza">
                {ehAula
                  ? "Transcrição automática da aula. Pode ter pequenos erros de palavra."
                  : "Texto extraído do material do curso."}
              </SheetDescription>
            </SheetHeader>
            <div className="rolagem-fina flex-1 overflow-y-auto px-6 py-5">
              {paragrafos.map((paragrafo, i) => {
                const m = paragrafo.match(MARCADOR_MINUTO);
                return (
                  <p key={i} className="mb-4 text-[15px] leading-[1.7] text-[#e4e0d8]">
                    {m && (
                      <span className="mr-2 inline-block rounded-md bg-ouro/10 px-2 py-0.5 align-[1px] text-xs font-medium text-ouro-claro tabular-nums">
                        {m[1]}
                      </span>
                    )}
                    {m ? paragrafo.slice(m[0].length) : paragrafo}
                  </p>
                );
              })}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
