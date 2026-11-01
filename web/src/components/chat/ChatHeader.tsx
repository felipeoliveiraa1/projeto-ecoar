"use client";

import { Bot, SquarePen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ChatHeaderProps {
  emConversa: boolean;
  aoNovaConversa: () => void;
}

export function ChatHeader({ emConversa, aoNovaConversa }: ChatHeaderProps) {
  return (
    <header className="relative z-20 flex h-[68px] shrink-0 items-center justify-between bg-preto/85 px-4 backdrop-blur-md sm:px-8 lg:px-12">
      <div className="flex items-center gap-3 sm:gap-5">
        <span className="font-heading text-[22px] font-semibold tracking-tight text-branco sm:text-[26px]">
          Método <span className="text-ouro">RB7</span>
        </span>
        <span aria-hidden className="hidden h-7 w-px bg-ouro/25 sm:block" />
        <span className="inline-flex items-center gap-2 rounded-full border border-ouro/40 bg-ouro/5 px-2.5 py-1 text-xs font-medium text-branco/85 sm:px-3.5 sm:py-1.5 sm:text-[13px]">
          <Bot className="size-4 text-ouro" aria-hidden />
          <span className="hidden min-[380px]:inline">Agente de IA</span>
        </span>
      </div>

      {emConversa && (
        <Tooltip>
          <TooltipTrigger
            onClick={aoNovaConversa}
            aria-label="Nova conversa"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-cinza transition-colors duration-200 hover:border-ouro/50 hover:text-branco focus-visible:ring-2 focus-visible:ring-ouro/60 focus-visible:outline-none"
          >
            <SquarePen className="size-4" aria-hidden />
            <span className="hidden sm:inline">Nova conversa</span>
          </TooltipTrigger>
          <TooltipContent>Começar uma nova conversa</TooltipContent>
        </Tooltip>
      )}

      {/* Linha dourada sutil na base do header */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-ouro/35 to-transparent"
      />
    </header>
  );
}
