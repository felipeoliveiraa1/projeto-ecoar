"use client";

import { useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowDown } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { useRolagemAutomatica } from "@/hooks/use-rolagem-automatica";
import type { Atalho } from "@/lib/atalhos";
import type { Fonte } from "@/lib/chat/tipos";
import { AnamneseSheet } from "./AnamneseSheet";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { ChatMessages } from "./ChatMessages";
import { QuickActions } from "./QuickActions";
import { SourceSheet } from "./SourceSheet";
import { WelcomeHero } from "./WelcomeHero";

export function ChatApp() {
  const { mensagens, gerando, enviar, parar, reiniciar } = useChat();
  const [texto, setTexto] = useState("");
  const [atalho, setAtalho] = useState<string>();
  const [fonte, setFonte] = useState<Fonte | null>(null);
  const [anamneseAberta, setAnamneseAberta] = useState(false);
  const refArea = useRef<HTMLDivElement>(null);
  const refTexto = useRef<HTMLTextAreaElement>(null);

  const emConversa = mensagens.length > 0;
  const ultima = mensagens.at(-1);
  const { temNovidade, irParaOFim, acompanhar } = useRolagemAutomatica(
    refArea,
    `${mensagens.length}:${ultima?.texto.length ?? 0}:${ultima?.fontes?.length ?? 0}:${ultima?.pendente}`,
    gerando,
  );

  const escolherAtalho = (escolhido: Atalho) => {
    setAtalho(escolhido.id);
    if (escolhido.id === "roteiro-sessao") {
      setAnamneseAberta(true);
      return;
    }
    setTexto(escolhido.sugestao);
    requestAnimationFrame(() => {
      const el = refTexto.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const enviarTexto = () => {
    if (!texto.trim() || gerando) return;
    acompanhar();
    void enviar(texto, atalho);
    setTexto("");
  };

  const enviarAnamnese = (texto: string) => {
    acompanhar();
    setAtalho("roteiro-sessao");
    void enviar(texto, "roteiro-sessao");
  };

  const novaConversa = () => {
    reiniciar();
    setTexto("");
    setAtalho(undefined);
    requestAnimationFrame(() => refTexto.current?.focus());
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative flex h-dvh flex-col overflow-hidden bg-preto">
        {/* Iluminação dourada de fundo, bem discreta */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgb(212_163_46/0.09),transparent_70%)]"
        />

        <ChatHeader emConversa={emConversa} aoNovaConversa={novaConversa} />

        <main ref={refArea} className="rolagem-fina relative flex-1 overflow-x-hidden overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            {emConversa ? (
              <motion.div
                key="conversa"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChatMessages mensagens={mensagens} gerando={gerando} aoAbrirFonte={setFonte} />
              </motion.div>
            ) : (
              <motion.div
                key="inicio"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="mx-auto flex min-h-full w-full max-w-[1240px] flex-col justify-center px-4 py-8 sm:px-6 sm:py-10"
              >
                <WelcomeHero />
                <div className="mt-8 sm:mt-10">
                  <QuickActions selecionado={atalho} aoEscolher={escolherAtalho} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="relative z-10 shrink-0 bg-linear-to-t from-preto via-preto to-preto/0 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] sm:px-6">
          <div className="relative mx-auto w-full max-w-[1100px]">
            <AnimatePresence>
              {temNovidade && (
                <motion.button
                  type="button"
                  onClick={irParaOFim}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="absolute -top-12 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-ouro/40 bg-cartao/95 px-3.5 py-1.5 text-xs text-ouro-claro shadow-lg backdrop-blur hover:border-ouro/70"
                >
                  <ArrowDown className="size-3.5" aria-hidden />
                  Ir para a resposta
                </motion.button>
              )}
            </AnimatePresence>
            <ChatInput
              valor={texto}
              aoMudar={setTexto}
              aoEnviar={enviarTexto}
              aoParar={parar}
              gerando={gerando}
              refTexto={refTexto}
              aoAbrirAnamnese={() => setAnamneseAberta(true)}
            />
            <p className="mt-2 text-center text-[11.5px] leading-snug text-cinza/70 sm:text-xs">
              <span className="sm:hidden">Não substitui avaliação clínica. Não inclua dados que identifiquem clientes.</span>
              <span className="hidden sm:inline">
                O Agente RB7 apoia o seu trabalho, mas não substitui avaliação clínica nem faz diagnósticos. Não inclua
                dados que identifiquem clientes.
              </span>
            </p>
          </div>
        </footer>

        <SourceSheet fonte={fonte} aoFechar={() => setFonte(null)} />
        <AnamneseSheet aberto={anamneseAberta} aoFechar={() => setAnamneseAberta(false)} aoEnviar={enviarAnamnese} />
      </div>
    </MotionConfig>
  );
}
