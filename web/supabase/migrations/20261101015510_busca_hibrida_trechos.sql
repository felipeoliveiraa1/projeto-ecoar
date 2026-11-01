-- Base de conhecimento do Agente RB7: trechos das aulas e apostilas com busca híbrida
-- (palavras em português + significado por embeddings), combinadas por Reciprocal Rank Fusion.

create extension if not exists vector with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Busca em português que ignora acentos ("extincao" encontra "extinção").
create text search configuration public.pt_br_sem_acento (copy = pg_catalog.portuguese);
alter text search configuration public.pt_br_sem_acento
  alter mapping for hword, hword_part, word with extensions.unaccent, portuguese_stem;

create table public.trechos (
  id text primary key,
  colecao text not null,                      -- metodo | conteudo | palco | juridico
  fonte text not null check (fonte in ('aula', 'documento')),
  aula smallint,
  titulo text,
  documento text,
  pagina_inicio smallint,
  pagina_fim smallint,
  minuto_inicio text,
  minuto_fim text,
  citacao text not null,
  texto text not null,
  contexto text,                              -- frase de contexto usada junto com o texto no embedding
  embedding extensions.vector(1536),          -- text-embedding-3-large reduzido a 1536 dimensões
  fts tsvector generated always as (
    to_tsvector('public.pt_br_sem_acento', coalesce(titulo, '') || ' ' || coalesce(documento, '') || ' ' || texto)
  ) stored,
  atualizado_em timestamptz not null default now()
);

comment on table public.trechos is 'Trechos do material do curso do Método RB7 usados pelo RAG dos agentes. Conteúdo proprietário: acesso só pelo servidor.';

create index trechos_fts_idx on public.trechos using gin (fts);
create index trechos_embedding_idx on public.trechos using hnsw (embedding extensions.vector_cosine_ops);
create index trechos_colecao_idx on public.trechos (colecao);

-- RLS ligado e sem políticas: anon e authenticated não leem nada. Só o servidor (service role) acessa.
alter table public.trechos enable row level security;

create or replace function public.buscar_trechos(
  consulta text,
  consulta_embedding extensions.vector(1536),
  colecoes text[],
  quantidade int default 20,
  peso_texto float default 1.0,
  peso_semantico float default 1.0,
  rrf_k int default 50
)
returns table (
  id text,
  colecao text,
  fonte text,
  aula smallint,
  titulo text,
  documento text,
  pagina_inicio smallint,
  pagina_fim smallint,
  minuto_inicio text,
  minuto_fim text,
  citacao text,
  texto text,
  pontuacao double precision
)
language sql
stable
set search_path = public, extensions
as $$
  with
  -- Pergunta em linguagem natural vira um OU entre os radicais das palavras (mais tolerante que E).
  pergunta as (
    select nullif(replace(plainto_tsquery('public.pt_br_sem_acento', consulta)::text, '&', '|'), '')::tsquery as q
  ),
  por_texto as (
    select t.id,
           row_number() over (order by ts_rank_cd(t.fts, p.q) desc) as posicao
    from public.trechos t, pergunta p
    where p.q is not null
      and t.colecao = any (colecoes)
      and t.fts @@ p.q
    order by posicao
    limit least(quantidade, 50) * 2
  ),
  por_significado as (
    select t.id,
           row_number() over (order by t.embedding <=> consulta_embedding) as posicao
    from public.trechos t
    where t.colecao = any (colecoes)
      and t.embedding is not null
    order by posicao
    limit least(quantidade, 50) * 2
  )
  select t.id, t.colecao, t.fonte, t.aula, t.titulo, t.documento, t.pagina_inicio, t.pagina_fim,
         t.minuto_inicio, t.minuto_fim, t.citacao, t.texto,
         coalesce(1.0 / (rrf_k + por_texto.posicao), 0.0) * peso_texto
           + coalesce(1.0 / (rrf_k + por_significado.posicao), 0.0) * peso_semantico as pontuacao
  from por_texto
  full outer join por_significado on por_texto.id = por_significado.id
  join public.trechos t on t.id = coalesce(por_texto.id, por_significado.id)
  order by pontuacao desc
  limit least(quantidade, 50);
$$;

comment on function public.buscar_trechos is 'Busca híbrida (texto em português + embeddings) com Reciprocal Rank Fusion. Uso exclusivo do servidor.';

-- Só o servidor chama a busca.
revoke execute on function public.buscar_trechos(text, extensions.vector, text[], int, float, float, int) from public, anon, authenticated;
