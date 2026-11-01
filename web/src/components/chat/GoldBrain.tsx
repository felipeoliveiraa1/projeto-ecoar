import Image from "next/image";
import { cn } from "@/lib/utils";

const LARGURA_ORIGINAL = 1536;
const ALTURA_ORIGINAL = 1024;

/** Cérebro dourado da tela inicial: flutua devagar, com um brilho dourado pulsando atrás. */
export function GoldBrain({ className }: { className?: string }) {
  return (
    <div className={cn("relative grid place-items-center", className)}>
      <div
        aria-hidden
        className="animar-brilho absolute inset-x-[14%] inset-y-[10%] rounded-full bg-[radial-gradient(closest-side,rgb(212_163_46/0.42),rgb(212_163_46/0.12)_60%,transparent)] blur-2xl"
      />
      <Image
        src="/cerebro-rb7.png"
        alt="Cérebro dourado do Método RB7"
        width={LARGURA_ORIGINAL}
        height={ALTURA_ORIGINAL}
        sizes="(max-width: 640px) 190px, 260px"
        preload
        draggable={false}
        className="animar-flutuar relative h-auto w-full select-none"
      />
    </div>
  );
}

/** Avatar do agente nas mensagens: o mesmo cérebro, recortado num círculo. */
export function BrainAvatar({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative size-9 shrink-0 overflow-hidden rounded-full border border-ouro/50 bg-superficie shadow-[0_0_16px_rgb(212_163_46/0.16)] sm:size-10",
        className,
      )}
    >
      <Image
        src="/cerebro-rb7.png"
        alt=""
        width={LARGURA_ORIGINAL}
        height={ALTURA_ORIGINAL}
        sizes="96px"
        draggable={false}
        className="absolute top-1/2 left-1/2 h-auto w-[150%] max-w-none -translate-x-1/2 -translate-y-1/2 select-none"
      />
    </div>
  );
}
