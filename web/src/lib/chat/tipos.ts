export type Papel = "usuario" | "assistente";

/** Trecho do material do curso usado como fonte de uma resposta. */
export interface Fonte {
  id: string;
  /** Ex.: "Aula 9 — Extinção vs reconsolidação, 01:41" ou "Plano Ecoar - Apostila e Guia Completo, p. 12". */
  citacao: string;
  /** Pedaço mais relevante, mostrado na resposta. */
  destaque: string;
  /** Trecho completo, mostrado no painel de fonte. */
  texto: string;
  tipo: "aula" | "documento";
  /** Número usado nas citações da resposta, como [2]. Ausente no modo prévia. */
  numero?: number;
}

export interface Mensagem {
  id: string;
  papel: Papel;
  texto: string;
  /** Momento de criação (ms). */
  criadaEm: number;
  fontes?: Fonte[];
  /** A resposta ainda está sendo gerada. */
  pendente?: boolean;
  /** O que o agente está fazendo antes do texto começar (ex.: "Buscando nas aulas"). */
  etapa?: string;
  erro?: boolean;
}

/** Eventos enviados pela API, um JSON por linha (NDJSON). */
export type EventoChat =
  | { tipo: "texto"; conteudo: string }
  | { tipo: "fontes"; fontes: Fonte[] }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "etapa"; etapa: string }
  | { tipo: "fim" };

export interface PedidoChat {
  mensagens: { papel: Papel; texto: string }[];
  /** Atalho usado para começar a conversa (ajuda a API a entender a intenção). */
  atalho?: string;
}
