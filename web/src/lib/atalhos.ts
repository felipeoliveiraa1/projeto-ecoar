import { CalendarDays, FileText, Layers, Search, Target, type LucideIcon } from "lucide-react";

export interface Atalho {
  id: string;
  titulo: string;
  descricao: string;
  /** Texto colocado no campo de mensagem; termina em aberto para o terapeuta completar. */
  sugestao: string;
  icone: LucideIcon;
}

/**
 * Atalhos da tela inicial. São só entradas de conversa: preenchem o campo de mensagem.
 * As sugestões não trazem conteúdo do método — ele vem da base de conhecimento.
 */
export const ATALHOS: Atalho[] = [
  {
    id: "roteiro-sessao",
    titulo: "Montar roteiro de sessão",
    descricao: "Estruture uma sessão completa seguindo o passo a passo do Método RB7.",
    sugestao: "Quero montar o roteiro de uma sessão pelo Método RB7. A queixa principal do cliente é: ",
    icone: CalendarDays,
  },
  {
    id: "analisar-caso",
    titulo: "Analisar caso",
    descricao: "Organize as informações do cliente e levante hipóteses para você avaliar.",
    sugestao: "Me ajude a analisar este caso pelo Método RB7 (sem dados que identifiquem o cliente): ",
    icone: Search,
  },
  {
    id: "gerar-protocolo",
    titulo: "Gerar protocolo",
    descricao: "Aplique as etapas do protocolo RB7 ao seu caso, com a fonte de cada etapa.",
    sugestao: "Como aplico as etapas do protocolo RB7 neste caso? Contexto: ",
    icone: Layers,
  },
  {
    id: "plano-acompanhamento",
    titulo: "Criar plano de acompanhamento",
    descricao: "Defina as próximas sessões, os objetivos e os sinais de evolução.",
    sugestao: "Quero um plano de acompanhamento para as próximas sessões. Situação atual do cliente: ",
    icone: Target,
  },
  {
    id: "resumir-atendimento",
    titulo: "Resumir atendimento",
    descricao: "Transforme suas anotações em um resumo objetivo, com os próximos passos.",
    sugestao: "Resuma este atendimento com os pontos principais e os próximos passos (anotações sem o nome do cliente): ",
    icone: FileText,
  },
];
