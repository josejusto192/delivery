-- Marketing: promoções (com produtos participantes e locais de exibição) e fidelidade.

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  banner_url text,
  discount_type text not null check (discount_type in ('percent', 'fixed')) default 'percent',
  discount_value numeric(10,2) not null default 0,
  display_on text[] not null default array['home']::text[], -- home, produto, carrinho, checkout
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.promotion_products (
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (promotion_id, product_id)
);

alter table public.promotions enable row level security;
alter table public.promotion_products enable row level security;

create policy "promotions_public_read" on public.promotions for select using (true);
create policy "promotion_products_public_read" on public.promotion_products for select using (true);

-- Fidelidade: configuração geral (linha única) + pontuação por produto + recompensas.

create table public.loyalty_settings (
  id int primary key default 1,
  enabled boolean not null default false,
  points_per_currency numeric(10,2) not null default 1, -- pontos ganhos por R$1 gasto
  min_order_to_earn numeric(10,2) not null default 0,
  check (id = 1)
);
insert into public.loyalty_settings (id) values (1);

alter table public.products add column loyalty_points numeric(10,2); -- override de pontos por unidade; null = usa cálculo padrão (preço * points_per_currency)

create table public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  points_cost int not null,
  type text not null check (type in ('discount_percent', 'discount_fixed', 'free_product')) default 'discount_fixed',
  value numeric(10,2) not null default 0,
  product_id uuid references public.products(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.loyalty_settings enable row level security;
alter table public.loyalty_rewards enable row level security;

create policy "loyalty_settings_public_read" on public.loyalty_settings for select using (true);
create policy "loyalty_rewards_public_read" on public.loyalty_rewards for select using (true);

create table public.loyalty_points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  reward_id uuid references public.loyalty_rewards(id) on delete set null,
  points int not null, -- positivo = ganho, negativo = resgate
  created_at timestamptz not null default now()
);

alter table public.loyalty_points_ledger enable row level security;
create policy "loyalty_ledger_owner_read" on public.loyalty_points_ledger for select using (auth.uid() = user_id);
