"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Loader2, ShieldAlert } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { encontrarDadosPessoais } from "@/lib/privacidade";

interface SecaoFicha {
  id: string;
  titulo: string;
  orientacao: string;
  perguntas: string[];
}

interface Ficha {
  titulo: string;
  introducao: string;
  secoes: SecaoFicha[];
}

interface AnamneseSheetProps {
  aberto: boolean;
  aoFechar: () => void;
  aoEnviar: (texto: string) => void;
}

const OPCIONAIS = new Set(["palavras_ancora", "hipotese"]);
const OBRIGATORIAS = ["dor_principal"];

/** Ficha de anamnese do Protocolo RB7 preenchida pelo terapeuta; vira o pedido do roteiro de sessão. */
export function AnamneseSheet({ aberto, aoFechar, aoEnviar }: AnamneseSheetProps) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto || ficha) return;
    let cancelado = false;
    fetch("/api/anamnese")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return (await r.json()) as Ficha;
      })
      .then((f) => !cancelado && setFicha(f))
      .catch(() => !cancelado && setErro("Não consegui carregar a ficha agora. Tente de novo em instantes."));
    return () => {
      cancelado = true;
    };
  }, [aberto, ficha]);

  const enviar = () => {
    if (!ficha) return;
    const faltando = OBRIGATORIAS.filter((id) => !respostas[id]?.trim());
    if (faltando.length) {
      setAviso("Preencha pelo menos a Dor Principal para o agente montar o roteiro.");
      return;
    }
    const tudo = Object.values(respostas).join("\n");
    const dados = encontrarDadosPessoais(tudo);
    if (dados.length) {
      setAviso(`Encontrei ${dados.join(", ")} na ficha. Remova antes de enviar (LGPD): use só iniciais.`);
      return;
    }
    const blocos = ficha.secoes.map((s) => {
      const resposta = respostas[s.id]?.trim();
      if (resposta) return `### ${s.titulo}\n${resposta}`;
      return OPCIONAIS.has(s.id) ? `### ${s.titulo}\n(em branco: sugira a partir do restante da ficha)` : null;
    });
    aoEnviar(
      `Monte o roteiro da primeira sessão pelo Método RB7 com base nesta anamnese.\n\n${blocos.filter(Boolean).join("\n\n")}`,
    );
    setAviso(null);
    aoFechar();
  };

  return (
    <Sheet open={aberto} onOpenChange={(aberta) => !aberta && aoFechar()}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-l border-ouro/30 bg-superficie p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
      >
        <SheetHeader className="gap-2 border-b border-white/[0.06] px-6 pt-6 pr-14 pb-5">
          <span className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.14em] text-ouro uppercase">
            <ClipboardList className="size-3.5" aria-hidden /> Montar roteiro de sessão
          </span>
          <SheetTitle className="font-heading text-lg leading-snug font-semibold text-branco">
            {ficha?.titulo ?? "Ficha de anamnese"}
          </SheetTitle>
          <SheetDescription className="text-[13px] leading-relaxed text-cinza">
            {ficha?.introducao ?? "Carregando a ficha…"} Preencha o que tiver; o agente usa a ficha para montar o roteiro, as palavras-âncora e hipóteses para você avaliar.
          </SheetDescription>
        </SheetHeader>

        <div className="rolagem-fina flex-1 overflow-y-auto px-6 py-5">
          {!ficha && !erro && (
            <p className="flex items-center gap-2 text-sm text-cinza">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Carregando a ficha…
            </p>
          )}
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          {ficha?.secoes.map((secao) => (
            <fieldset key={secao.id} className="mb-6">
              <legend className="font-heading text-[15px] font-semibold text-branco">
                {secao.titulo}
                {OBRIGATORIAS.includes(secao.id) && <span className="ml-1 text-ouro">*</span>}
              </legend>
              {secao.orientacao && <p className="mt-1 text-[12.5px] leading-snug text-ouro-claro/80">{secao.orientacao}</p>}
              <ul className="mt-2 mb-2 list-disc space-y-0.5 pl-5 text-[12.5px] leading-snug text-cinza marker:text-ouro/60">
                {secao.perguntas.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <Textarea
                value={respostas[secao.id] ?? ""}
                onChange={(e) => setRespostas((r) => ({ ...r, [secao.id]: e.target.value }))}
                aria-label={secao.titulo}
                placeholder="Anote com as palavras do paciente…"
                className="min-h-20 rounded-xl border-white/10 bg-[#11100e] text-[14.5px] focus-visible:border-ouro/60 focus-visible:ring-ouro/20 md:text-[14.5px] dark:bg-[#11100e]"
              />
            </fieldset>
          ))}
        </div>

        <div className="border-t border-white/[0.06] px-6 py-4">
          {aviso && (
            <p className="mb-3 flex items-start gap-2 text-[13px] text-ouro-claro" role="alert">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {aviso}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setRespostas({})}
              className="rounded-lg px-3 py-2 text-sm text-cinza transition-colors hover:text-branco"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={enviar}
              disabled={!ficha}
              className="gradiente-ouro rounded-xl px-5 py-2.5 text-sm font-semibold text-preto shadow-[0_6px_20px_-6px_rgb(212_163_46/0.6)] transition-[filter,translate] duration-200 hover:-translate-y-px hover:brightness-110 disabled:opacity-40"
            >
              Gerar roteiro da sessão
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
