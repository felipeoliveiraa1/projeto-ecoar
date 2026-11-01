-- Documentos-base dos agentes (Mapa do Método, biblioteca de casos etc.), lidos pelo servidor.
-- Ficam no banco, e não no repositório, porque são derivados do conteúdo do curso.

create table public.documentos_base (
  slug text primary key,                    -- ex.: 'mapa-do-metodo'
  titulo text not null,
  conteudo text not null,
  versao text,
  atualizado_em timestamptz not null default now()
);

comment on table public.documentos_base is 'Documentos-base dos agentes do Método RB7 (conteúdo proprietário: acesso só pelo servidor).';

-- RLS ligado e sem políticas: só o servidor (chave secreta) lê e escreve.
alter table public.documentos_base enable row level security;
