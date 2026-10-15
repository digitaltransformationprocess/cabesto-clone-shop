-- RAG step 1: product_chunks + match_product_chunks
-- Applied via Supabase migration: rag_product_chunks_and_match
-- price/stock live from products — never stored in embeddings

create extension if not exists vector with schema extensions;

create table if not exists public.product_chunks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  chunk_index int not null check (chunk_index >= 0),
  section text,
  content text not null,
  content_hash text not null,
  embedding extensions.vector(1536),
  token_count int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, chunk_index)
);

create index if not exists product_chunks_product_id_idx
  on public.product_chunks (product_id);

create index if not exists product_chunks_content_hash_idx
  on public.product_chunks (product_id, content_hash);

create index if not exists product_chunks_embedding_hnsw
  on public.product_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.product_chunks enable row level security;

create or replace function public.match_product_chunks(
  query_embedding extensions.vector(1536),
  match_count int default 8,
  filter_min_price_cents int default null,
  filter_max_price_cents int default null,
  filter_in_stock_only boolean default false,
  filter_category_path text[] default null
)
returns table (
  chunk_id uuid,
  product_id uuid,
  sku text,
  name text,
  section text,
  content text,
  price_cents int,
  stock int,
  similarity float
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    c.id as chunk_id,
    p.id as product_id,
    p.sku,
    p.name,
    c.section,
    c.content,
    p.price_cents,
    p.stock,
    (1 - (c.embedding <=> query_embedding))::float as similarity
  from public.product_chunks c
  join public.products p on p.id = c.product_id
  where p.is_active = true
    and c.embedding is not null
    and (filter_min_price_cents is null or p.price_cents >= filter_min_price_cents)
    and (filter_max_price_cents is null or p.price_cents <= filter_max_price_cents)
    and (not coalesce(filter_in_stock_only, false) or p.stock > 0)
    and (
      filter_category_path is null
      or p.category_path[1 : cardinality(filter_category_path)] = filter_category_path
    )
  order by c.embedding <=> query_embedding
  limit greatest(coalesce(match_count, 8), 1);
$$;

revoke all on function public.match_product_chunks(
  extensions.vector, integer, integer, integer, boolean, text[]
) from public, anon, authenticated;

grant execute on function public.match_product_chunks(
  extensions.vector, integer, integer, integer, boolean, text[]
) to service_role;

revoke all on table public.product_chunks from anon, authenticated;
grant select, insert, update, delete on table public.product_chunks to service_role;
