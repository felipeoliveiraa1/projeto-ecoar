"use client";

import { motion } from "motion/react";
import { ATALHOS, type Atalho } from "@/lib/atalhos";
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  selecionado?: string;
  aoEscolher: (atalho: Atalho) => void;
}

export function QuickActions({ selecionado, aoEscolher }: QuickActionsProps) {
  return (
    <div
      role="group"
      aria-label="Atalhos para começar a conversa"
      className="rolagem-fina -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-3 xl:grid-cols-5"
    >
      {ATALHOS.map((atalho, i) => {
        const Icone = atalho.icone;
        const ativo = atalho.id === selecionado;
        return (
          <motion.button
            key={atalho.id}
            type="button"
            aria-pressed={ativo}
            onClick={() => aoEscolher(atalho)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 + i * 0.06, ease: "easeOut" }}
            className={cn(
              "group flex w-[74%] shrink-0 snap-start flex-col items-start gap-2.5 rounded-[14px] border bg-cartao p-4 text-left",
              "transition-[translate,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-ouro/60 hover:shadow-[0_8px_28px_-6px_rgb(212_163_46/0.22)]",
              "focus-visible:ring-2 focus-visible:ring-ouro/60 focus-visible:outline-none sm:w-auto sm:p-5",
              ativo ? "border-ouro/80 shadow-[0_0_26px_-4px_rgb(212_163_46/0.3)]" : "border-ouro/20",
            )}
          >
            <Icone className="size-7 text-ouro transition-colors group-hover:text-ouro-claro" strokeWidth={1.6} aria-hidden />
            <span className="font-heading text-base leading-snug font-semibold text-branco">{atalho.titulo}</span>
            <span className="text-[13.5px] leading-relaxed text-cinza">{atalho.descricao}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
