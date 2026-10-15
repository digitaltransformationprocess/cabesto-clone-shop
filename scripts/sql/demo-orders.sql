-- Demo orders schema + seed (migration: demo_orders_and_items)
-- Account: client@test.fr / Julie Martin — all statuses, mixed products

create table if not exists public.orders (
  id text primary key,
  customer_name text not null,
  email text not null,
  status text not null,
  carrier text not null,
  ordered_at date not null default (current_date),
  shipping jsonb not null default '{}'::jsonb,
  tracking_code text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders (id) on delete cascade,
  product_sku text not null references public.products (sku),
  qty int not null check (qty > 0),
  unit_price_cents int,
  created_at timestamptz not null default now(),
  unique (order_id, product_sku)
);

-- See Supabase migration for full seed (CMD-1101 … CMD-1048 for client@test.fr)
