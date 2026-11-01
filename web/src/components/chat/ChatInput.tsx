"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import { ClipboardList, Mic, Paperclip, SendHorizontal, Square } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ALTURA_MAXIMA = 192; // px
const TAMANHO_MAXIMO_ANEXO = 60_000; // caracteres

interface ChatInputProps {
  valor: string;
  aoMudar: Dispatch<SetStateAction<string>>;
  aoEnviar: () => void;
  aoParar: () => void;
  gerando: boolean;
  refTexto: RefObject<HTMLTextAreaElement | null>;
  aoAbrirAnamnese: () => void;
}

const TAMANHO_MAXIMO_ARQUIVO = 10 * 1024 * 1024; // 10 MB

/** Extrai o texto de .txt, .md, .pdf ou .docx no próprio navegador (o arquivo não vai para o servidor). */
async function textoDoArquivo(arquivo: File): Promise<string> {
  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await arquivo.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }
  if (nome.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ arrayBuffer: await arquivo.arrayBuffer() });
    return value;
  }
  return arquivo.text();
}

// Tipos mínimos da Web Speech API (ainda não fazem parte do lib.dom do TypeScript).
interface ResultadoVoz {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface ReconhecimentoVoz {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((evento: ResultadoVoz) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type ConstrutorReconhecimento = new () => ReconhecimentoVoz;

function reconhecimentoDisponivel(): ConstrutorReconhecimento | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: ConstrutorReconhecimento;
    webkitSpeechRecognition?: ConstrutorReconhecimento;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// O suporte a voz não muda durante o uso: lido no navegador, "não" no servidor.
const nadaParaAssinar = () => () => {};
const vozNoNavegador = () => reconhecimentoDisponivel() !== null;
const vozNoServidor = () => false;

// Em telas estreitas, o texto de exemplo do campo fica mais curto para caber numa linha.
const TELA_ESTREITA = "(max-width: 480px)";
const assinarTela = (avisar: () => void) => {
  const consulta = window.matchMedia(TELA_ESTREITA);
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
};
const telaEstreitaNoNavegador = () => window.matchMedia(TELA_ESTREITA).matches;
const telaEstreitaNoServidor = () => false;

/** Em navegadores sem `field-sizing: content`, o campo cresce enquanto a pessoa digita. */
function ajustarAltura(e: FormEvent<HTMLTextAreaElement>) {
  const el = e.currentTarget;
  if (CSS.supports("field-sizing", "content")) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, ALTURA_MAXIMA)}px`;
}

const botaoIcone =
  "grid size-10 shrink-0 place-items-center rounded-xl text-cinza transition-colors duration-150 hover:bg-white/5 hover:text-ouro-claro focus-visible:ring-2 focus-visible:ring-ouro/60 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40";

export function ChatInput({ valor, aoMudar, aoEnviar, aoParar, gerando, refTexto, aoAbrirAnamnese }: ChatInputProps) {
  const refArquivo = useRef<HTMLInputElement>(null);
  const refVoz = useRef<ReconhecimentoVoz | null>(null);
  // O microfone só aparece se o navegador tiver reconhecimento de voz.
  const temVoz = useSyncExternalStore(nadaParaAssinar, vozNoNavegador, vozNoServidor);
  const telaEstreita = useSyncExternalStore(assinarTela, telaEstreitaNoNavegador, telaEstreitaNoServidor);
  const [ouvindo, setOuvindo] = useState(false);
  const [avisoAnexo, setAvisoAnexo] = useState<string | null>(null);

  const podeEnviar = valor.trim().length > 0 && !gerando;

  useEffect(() => () => refVoz.current?.stop(), []);

  const aoTeclar = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (podeEnviar) aoEnviar();
    }
  };

  const alternarVoz = () => {
    if (ouvindo) {
      refVoz.current?.stop();
      return;
    }
    const Construtor = reconhecimentoDisponivel();
    if (!Construtor) return;
    const voz = new Construtor();
    voz.lang = "pt-BR";
    voz.interimResults = false;
    voz.continuous = false;
    voz.onresult = (evento) => {
      const falado = Array.from(evento.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (falado) aoMudar((atual) => (atual ? `${atual.replace(/\s+$/, "")} ${falado}` : falado));
    };
    voz.onend = () => setOuvindo(false);
    voz.onerror = () => setOuvindo(false);
    refVoz.current = voz;
    setOuvindo(true);
    voz.start();
  };

  const anexar = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO) {
      setAvisoAnexo("Arquivo grande demais (máximo 10 MB).");
      return;
    }
    let conteudo: string;
    try {
      conteudo = (await textoDoArquivo(arquivo)).trim();
    } catch {
      setAvisoAnexo("Não consegui ler esse arquivo. Tente .txt, .md, .pdf ou .docx.");
      return;
    }
    if (refArquivo.current) refArquivo.current.value = "";
    if (!conteudo) {
      setAvisoAnexo("O arquivo está vazio.");
      return;
    }
    const cortado = conteudo.length > TAMANHO_MAXIMO_ANEXO;
    const texto = cortado ? `${conteudo.slice(0, TAMANHO_MAXIMO_ANEXO)}…` : conteudo;
    aoMudar((atual) => {
      const antes = atual.trim();
      return `${antes ? `${antes}\n\n` : ""}Anotações anexadas (${arquivo.name}):\n${texto}`;
    });
    setAvisoAnexo(
      cortado
        ? "O arquivo era grande e foi cortado. Confira se não há dados que identifiquem o cliente."
        : "Confira se as anotações não têm dados que identifiquem o cliente antes de enviar.",
    );
    refTexto.current?.focus();
  };

  return (
    <div className="w-full">
      <div
        className={cn(
          "flex items-end gap-1.5 rounded-2xl border border-ouro/45 bg-[#11100e] p-2 shadow-[0_0_34px_-12px_rgb(212_163_46/0.35)] transition-[border-color,box-shadow] duration-200 sm:gap-2 sm:p-2.5",
          "focus-within:border-ouro/80 focus-within:shadow-[0_0_0_3px_rgb(212_163_46/0.14),0_0_34px_-10px_rgb(212_163_46/0.4)]",
        )}
      >
        <Tooltip>
          <TooltipTrigger
            type="button"
            aria-label="Anexar anotações ou anamnese"
            className={botaoIcone}
            onClick={() => refArquivo.current?.click()}
            disabled={gerando}
          >
            <Paperclip className="size-5" aria-hidden />
          </TooltipTrigger>
          <TooltipContent>Anexar anotações ou anamnese (.pdf, .docx, .txt)</TooltipContent>
        </Tooltip>
        <input
          ref={refArquivo}
          type="file"
          accept=".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => anexar(e.target.files?.[0])}
        />
        <Tooltip>
          <TooltipTrigger
            type="button"
            aria-label="Preencher anamnese"
            className={botaoIcone}
            onClick={aoAbrirAnamnese}
            disabled={gerando}
          >
            <ClipboardList className="size-5" aria-hidden />
          </TooltipTrigger>
          <TooltipContent>Preencher a ficha de anamnese e gerar o roteiro</TooltipContent>
        </Tooltip>
        <span aria-hidden className="mb-2.5 h-6 w-px shrink-0 self-end bg-white/10" />

        <Textarea
          ref={refTexto}
          value={valor}
          onChange={(e) => {
            aoMudar(e.target.value);
            if (avisoAnexo) setAvisoAnexo(null);
          }}
          onKeyDown={aoTeclar}
          onInput={ajustarAltura}
          rows={1}
          placeholder={telaEstreita ? "Pergunte ao Agente RB7…" : "Digite sua mensagem para o Agente RB7…"}
          aria-label="Mensagem para o Agente RB7"
          className="max-h-48 min-h-10 resize-none overflow-y-auto rounded-none border-0 bg-transparent px-1.5 py-2.5 text-[15.5px] leading-6 text-branco shadow-none placeholder:overflow-hidden placeholder:text-ellipsis placeholder:whitespace-nowrap placeholder:text-cinza/70 focus-visible:border-0 focus-visible:ring-0 md:text-[15.5px] dark:bg-transparent"
        />

        {temVoz && (
          <Tooltip>
            <TooltipTrigger
              type="button"
              aria-label={ouvindo ? "Parar de ouvir" : "Falar mensagem"}
              aria-pressed={ouvindo}
              className={cn(botaoIcone, ouvindo && "bg-ouro/10 text-ouro-claro")}
              onClick={alternarVoz}
              disabled={gerando}
            >
              <Mic className={cn("size-5", ouvindo && "animate-pulse")} aria-hidden />
            </TooltipTrigger>
            <TooltipContent>{ouvindo ? "Ouvindo… toque para parar" : "Falar mensagem"}</TooltipContent>
          </Tooltip>
        )}

        {gerando ? (
          <button
            type="button"
            onClick={aoParar}
            aria-label="Parar resposta"
            className="grid h-10 w-12 shrink-0 place-items-center rounded-xl border border-ouro/60 text-ouro-claro transition-colors duration-150 hover:bg-ouro/10 focus-visible:ring-2 focus-visible:ring-ouro/60 focus-visible:outline-none sm:h-11 sm:w-14"
          >
            <Square className="size-4 fill-current" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={aoEnviar}
            disabled={!podeEnviar}
            aria-label="Enviar mensagem"
            className="gradiente-ouro grid h-10 w-12 shrink-0 place-items-center rounded-xl text-preto shadow-[0_6px_20px_-6px_rgb(212_163_46/0.6)] transition-[translate,filter,box-shadow] duration-200 hover:-translate-y-px hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ouro-claro focus-visible:ring-offset-2 focus-visible:ring-offset-preto focus-visible:outline-none disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:brightness-75 sm:h-11 sm:w-14"
          >
            <SendHorizontal className="size-5" strokeWidth={2.2} aria-hidden />
          </button>
        )}
      </div>

      {avisoAnexo && (
        <p className="mt-2 px-2 text-xs text-ouro-claro/90" role="status">
          {avisoAnexo}
        </p>
      )}
    </div>
  );
}
