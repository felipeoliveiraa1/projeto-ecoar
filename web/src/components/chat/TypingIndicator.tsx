export function TypingIndicator({ etapa }: { etapa?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 py-1.5" role="status">
      <span className="sr-only">{etapa ?? "O agente está escrevendo a resposta"}</span>
      {[0, 0.15, 0.3].map((atraso) => (
        <span
          key={atraso}
          aria-hidden
          className="ponto-digitando size-2 rounded-full bg-ouro"
          style={{ animationDelay: `${atraso}s` }}
        />
      ))}
      {etapa && (
        <span aria-hidden className="ml-2 text-[13.5px] text-cinza">
          {etapa}…
        </span>
      )}
    </span>
  );
}
