-- RAG site docs: site_chunks + match_site_chunks
-- Applied via migration: rag_site_chunks_and_match

create table if not exists public.site_chunks (
  id uuid primary key default gen_random_uuid(),
  doc_id text not null,
  page_path text not null,
  title text not null,
  chunk_index int not null check (chunk_index >= 0),
  section text,
  content text not null,
  content_hash text not null,
  embedding extensions.vector(1536),
  token_count int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (doc_id, chunk_index)
);

create index if not exists site_chunks_doc_id_idx on public.site_chunks (doc_id);
create index if not exists site_chunks_content_hash_idx on public.site_chunks (doc_id, content_hash);
create index if not exists site_chunks_embedding_hnsw
  on public.site_chunks using hnsw (embedding extensions.vector_cosine_ops);

alter table public.site_chunks enable row level security;
revoke all on table public.site_chunks from anon, authenticated;
grant select, insert, update, delete on table public.site_chunks to service_role;

create or replace function public.match_site_chunks(
  query_embedding extensions.vector(1536),
  match_count int default 6,
  filter_doc_ids text[] default null
)
returns table (
  chunk_id uuid,
  doc_id text,
  page_path text,
  title text,
  section text,
  content text,
  similarity float
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    c.id as chunk_id,
    c.doc_id,
    c.page_path,
    c.title,
    c.section,
    c.content,
    (1 - (c.embedding <=> query_embedding))::float as similarity
  from public.site_chunks c
  where c.embedding is not null
    and (filter_doc_ids is null or c.doc_id = any(filter_doc_ids))
  order by c.embedding <=> query_embedding
  limit greatest(coalesce(match_count, 6), 1);
$$;

revoke all on function public.match_site_chunks(extensions.vector, integer, text[])
  from public, anon, authenticated;
grant execute on function public.match_site_chunks(extensions.vector, integer, text[])
  to service_role;
