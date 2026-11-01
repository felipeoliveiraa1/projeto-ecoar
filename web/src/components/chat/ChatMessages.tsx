"use client";

import { AnimatePresence, motion } from "motion/react";
import type { Fonte, Mensagem } from "@/lib/chat/tipos";
import { MessageBubble } from "./MessageBubble";

interface ChatMessagesProps {
  mensagens: Mensagem[];
  gerando: boolean;
  aoAbrirFonte: (fonte: Fonte) => void;
}

export function ChatMessages({ mensagens, gerando, aoAbrirFonte }: ChatMessagesProps) {
  return (
    <div
      role="log"
      aria-label="Conversa com o Agente RB7"
      aria-busy={gerando}
      className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 pt-6 pb-4 sm:px-6 sm:pt-8"
    >
      <AnimatePresence initial={false}>
        {mensagens.map((mensagem) => (
          <motion.div
            key={mensagem.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <MessageBubble mensagem={mensagem} aoAbrirFonte={aoAbrirFonte} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
