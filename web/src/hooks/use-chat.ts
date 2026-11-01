"use client";

import { useCallback, useRef, useState } from "react";
import { conversar } from "@/lib/chat/servico";
import type { Mensagem } from "@/lib/chat/tipos";

const novoId = () => crypto.randomUUID();

/** Estado da conversa e envio de mensagens com resposta em streaming. */
export function useChat() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [gerando, setGerando] = useState(false);
  const controle = useRef<AbortController | null>(null);

  const enviar = useCallback(
    async (texto: string, atalho?: string) => {
      const conteudo = texto.trim();
      if (!conteudo || gerando) return;

      const pergunta: Mensagem = { id: novoId(), papel: "usuario", texto: conteudo, criadaEm: Date.now() };
      const resposta: Mensagem = { id: novoId(), papel: "assistente", texto: "", criadaEm: Date.now(), pendente: true };
      const historico = [...mensagens, pergunta];
      setMensagens([...historico, resposta]);
      setGerando(true);

      const ctrl = new AbortController();
      controle.current = ctrl;
      const atualizar = (f: (m: Mensagem) => Mensagem) =>
        setMensagens((atual) => atual.map((m) => (m.id === resposta.id ? f(m) : m)));

      try {
        await conversar(
          {
            mensagens: historico.filter((m) => !m.erro).map(({ papel, texto }) => ({ papel, texto })),
            atalho,
          },
          (evento) => {
            if (evento.tipo === "texto") atualizar((m) => ({ ...m, texto: m.texto + evento.conteudo }));
            else if (evento.tipo === "fontes") atualizar((m) => ({ ...m, fontes: evento.fontes }));
            else if (evento.tipo === "erro") atualizar((m) => ({ ...m, texto: evento.mensagem, erro: true }));
            else if (evento.tipo === "etapa") atualizar((m) => ({ ...m, etapa: evento.etapa }));
          },
          ctrl.signal,
        );
      } catch (erro) {
        if ((erro as Error).name !== "AbortError") {
          atualizar((m) => ({
            ...m,
            texto: "Não consegui responder agora. Tente novamente em instantes.",
            erro: true,
          }));
        }
      } finally {
        atualizar((m) => ({ ...m, pendente: false }));
        if (controle.current === ctrl) {
          controle.current = null;
          setGerando(false);
        }
      }
    },
    [mensagens, gerando],
  );

  const parar = useCallback(() => controle.current?.abort(), []);

  const reiniciar = useCallback(() => {
    controle.current?.abort();
    controle.current = null;
    setMensagens([]);
    setGerando(false);
  }, []);

  return { mensagens, gerando, enviar, parar, reiniciar };
}
