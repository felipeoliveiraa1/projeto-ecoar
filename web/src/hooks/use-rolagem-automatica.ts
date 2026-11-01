"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

const DISTANCIA_DO_FIM = 120; // px: abaixo disso, consideramos que a pessoa está acompanhando o fim

/**
 * Rola para a última mensagem quando chega conteúdo novo, mas só se a pessoa já
 * estiver perto do fim. Se ela subiu para reler algo, não puxa a tela: mostra um botão.
 */
export function useRolagemAutomatica(
  area: RefObject<HTMLElement | null>,
  gatilho: unknown,
  emStreaming: boolean,
) {
  const grudado = useRef(true);
  const [temNovidade, setTemNovidade] = useState(false);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const aoRolar = () => {
      const perto = el.scrollHeight - el.scrollTop - el.clientHeight < DISTANCIA_DO_FIM;
      grudado.current = perto;
      if (perto) setTemNovidade(false);
    };
    el.addEventListener("scroll", aoRolar, { passive: true });
    return () => el.removeEventListener("scroll", aoRolar);
  }, [area]);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    if (grudado.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: emStreaming ? "auto" : "smooth" });
    } else {
      setTemNovidade(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatilho]);

  const irParaOFim = () => {
    const el = area.current;
    if (!el) return;
    grudado.current = true;
    setTemNovidade(false);
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  /** Chamado quando a própria pessoa envia uma mensagem: a tela sempre acompanha. */
  const acompanhar = () => {
    grudado.current = true;
  };

  return { temNovidade, irParaOFim, acompanhar };
}
