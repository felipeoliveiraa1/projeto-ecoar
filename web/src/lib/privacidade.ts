/**
 * Detecção de dados que identificam uma pessoa (LGPD). Usada na tela, para avisar antes
 * de enviar, e no servidor, para remover o que tiver passado. Nomes não são detectáveis
 * com segurança: por isso a ficha pede iniciais.
 */
const PADROES: { tipo: string; regex: RegExp }[] = [
  { tipo: "CPF", regex: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g },
  { tipo: "e-mail", regex: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g },
  { tipo: "telefone", regex: /(?:\+?55\s?)?\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g },
];

export function encontrarDadosPessoais(texto: string): string[] {
  return PADROES.filter(({ regex }) => new RegExp(regex.source, "g").test(texto)).map(({ tipo }) => tipo);
}

export function removerDadosPessoais(texto: string): string {
  return PADROES.reduce((acc, { regex }) => acc.replace(new RegExp(regex.source, "g"), "[dado removido]"), texto);
}
