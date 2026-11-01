/**
 * Regras fixas de segurança (ver conhecimento/politica-de-seguranca.md).
 * Valem antes de qualquer resposta, inclusive no modo prévia.
 */

// Vale para a própria pessoa e para o cliente de quem o terapeuta está falando.
const SINAIS_DE_CRISE = [
  /suic[ií]d/i,
  /\b(me|se|te) matar\b/i,
  /\bmatar-(me|se)\b/i,
  /\bmatar a (mim|si)\b/i,
  /tirar (a )?(minha |sua |pr[oó]pria )?(pr[oó]pria )?vida/i,
  /acabar com (a )?(minha|sua|pr[oó]pria) vida/i,
  /\b(quero|quer|vou|vai|penso em|pensa em|pensando em|vontade de|desejo de) morrer\b/i,
  /n[aã]o (quero|quer|aguento|aguenta) mais viver/i,
  /automutila/i,
  /\b(me|se) (cortar|cortando|cortou|machucar|machucando|machucou|ferir|ferindo|feriu)\b/i,
];

export function temSinalDeCrise(texto: string): boolean {
  return SINAIS_DE_CRISE.some((padrao) => padrao.test(texto));
}

export const RESPOSTA_CRISE = `Percebi que a sua mensagem fala de **risco à vida**. Antes de qualquer técnica, a prioridade é a segurança.

- **Perigo imediato:** ligue **192 (SAMU)** ou vá ao pronto-socorro mais próximo.
- **Para conversar agora:** **CVV — 188**, 24 horas, ligação gratuita (também por chat em cvv.org.br).
- **Se for um cliente seu:** priorize o encaminhamento para um psiquiatra ou serviço de saúde mental e busque supervisão. Não siga com a sessão como se nada tivesse acontecido.

Estou aqui quando você quiser retomar.`;
