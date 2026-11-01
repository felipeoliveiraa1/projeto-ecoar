import type { EventoChat, PedidoChat } from "./tipos";

/**
 * Camada de integração com a API do agente. A interface só conversa com esta função,
 * então trocar o modo prévia pelos agentes de verdade não muda nada na parte visual.
 */
export async function conversar(
  pedido: PedidoChat,
  aoReceber: (evento: EventoChat) => void,
  sinal?: AbortSignal,
): Promise<void> {
  const resposta = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pedido),
    signal: sinal,
  });
  if (!resposta.ok || !resposta.body) {
    throw new Error(`Falha na conversa (HTTP ${resposta.status})`);
  }

  const leitor = resposta.body.getReader();
  const decodificador = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await leitor.read();
    if (done) break;
    buffer += decodificador.decode(value, { stream: true });
    let quebra = buffer.indexOf("\n");
    while (quebra >= 0) {
      const linha = buffer.slice(0, quebra).trim();
      buffer = buffer.slice(quebra + 1);
      if (linha) aoReceber(JSON.parse(linha) as EventoChat);
      quebra = buffer.indexOf("\n");
    }
  }
  const resto = buffer.trim();
  if (resto) aoReceber(JSON.parse(resto) as EventoChat);
}
