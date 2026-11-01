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
  /(melhor|queria|vou) (eu )?n[aã]o estar mais aqui/i,
  /acabar com tudo/i,
];

export function temSinalDeCrise(texto: string): boolean {
  return SINAIS_DE_CRISE.some((padrao) => padrao.test(texto));
}

export const RESPOSTA_CRISE = `Percebi que a sua mensagem fala de **risco à vida**. Antes de qualquer técnica, a prioridade é a segurança.

- **Perigo imediato:** ligue **192 (SAMU)** ou vá ao pronto-socorro mais próximo.
- **Para conversar agora:** **CVV — 188**, 24 horas, ligação gratuita (também por chat em cvv.org.br).
- **Se for um cliente seu:** priorize o encaminhamento para um psiquiatra ou serviço de saúde mental e busque supervisão. Não siga com a sessão como se nada tivesse acontecido.

Estou aqui quando você quiser retomar.`;

const SINAIS_ABUSO = /(abus|estupr|viol[eê]ncia sexual|molest|bolin)/i;
const SINAIS_CRIANCA = /(crian[cç]a|filh[oa]|menor de idade|sobrinh|entead|net[oa]\b|adolescente|aluno|aluna)/i;

export function falaDeAbusoContraCrianca(texto: string): boolean {
  return SINAIS_ABUSO.test(texto) && SINAIS_CRIANCA.test(texto);
}

export const RESPOSTA_ABUSO = `Situações de **abuso ou violência contra criança ou adolescente** pedem proteção antes de qualquer técnica.

- **Se o abuso pode estar acontecendo agora:** acione o **Disque 100** (Direitos Humanos, 24h, gratuito) ou o **Conselho Tutelar** da cidade. Em perigo imediato, **190**.
- **Leve o caso à supervisão** antes de seguir com sessões, e registre o que foi relatado com cuidado.
- **Na sessão:** acolha, não investigue detalhes nem confronte a família, e não prometa sigilo sobre risco à criança.

Se for uma memória antiga do cliente adulto, já sem risco atual, me conte mais sobre o objetivo da sessão que eu te ajudo a organizar o trabalho.`;

export const RESPOSTA_FILTRO = `Não consegui processar essa mensagem agora: o tema esbarrou no filtro de segurança do provedor de IA.

- Se houver **risco à vida**, priorize a segurança: **CVV 188** (24h), **SAMU 192** ou pronto-socorro.
- Se envolver **abuso contra criança ou adolescente**, acione o **Disque 100** ou o **Conselho Tutelar** e leve à supervisão.
- Se for uma dúvida do método, tente reformular com menos detalhes sensíveis (por exemplo, sem descrever a cena) que eu respondo.`;
