-- ============================================================
-- Estoque (insumos) e ficha técnica de custo/margem dos produtos
-- ============================================================

-- ---------- INSUMOS ----------
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null check (unit in ('un', 'kg')),
  cost_per_unit numeric(10,4) not null default 0, -- valor pago por 1 unidade ou por 1 kg
  stock_quantity numeric(12,3) not null default 0,
  min_stock numeric(12,3) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ingredients_name_idx on public.ingredients (name);

create trigger ingredients_touch before update on public.ingredients
  for each row execute function public.touch_updated_at();

-- ---------- FICHA TÉCNICA (insumos usados por produto do cardápio) ----------
create table public.product_ingredients (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity numeric(12,4) not null check (quantity > 0), -- na mesma unidade do insumo (un ou kg)
  created_at timestamptz not null default now(),
  unique (product_id, ingredient_id)
);
create index product_ingredients_product_idx on public.product_ingredients (product_id);

-- custo calculado e margem (por produto, com fallback para a margem padrão da loja)
alter table public.products
  add column cost_price numeric(10,4) not null default 0,
  add column margin_percent numeric(5,2);

alter table public.store_settings
  add column default_margin_percent numeric(5,2) not null default 30;

-- ---------- RLS ----------
alter table public.ingredients enable row level security;
alter table public.product_ingredients enable row level security;

create policy "admin all ingredients" on public.ingredients for all using (public.is_admin());
create policy "admin all product_ingredients" on public.product_ingredients for all using (public.is_admin());
