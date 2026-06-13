-- ============================================================
-- Plataforma de Delivery — Schema inicial (MVP de Pedidos)
-- Execute no SQL Editor do Supabase ou via supabase db push
-- ============================================================

-- ---------- PERFIS ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  whatsapp text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

-- cria perfil automaticamente ao registrar
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, whatsapp)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), new.raw_user_meta_data->>'whatsapp');
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- CONFIGURAÇÕES DA LOJA ----------
create table public.store_settings (
  id int primary key default 1 check (id = 1),
  name text not null default 'Minha Loja',
  logo_url text,
  phone text,
  whatsapp text,
  address text,
  brand_color text not null default '#ea1d2c',
  is_open boolean not null default true,
  opening_hours jsonb not null default '{}', -- {"mon":[["18:00","23:00"]],...}
  delivery_fee numeric(10,2) not null default 0,
  min_order numeric(10,2) not null default 0,
  delivery_areas jsonb not null default '[]', -- [{"name":"Centro","fee":5}]
  updated_at timestamptz not null default now()
);
insert into public.store_settings (id) values (1);

-- ---------- CARDÁPIO ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text not null default '',
  price numeric(10,2) not null,
  image_url text,
  featured boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- grupos de adicionais (ex.: "Escolha o molho", min 0 max 2)
create table public.addon_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  min_select int not null default 0,
  max_select int not null default 1,
  sort_order int not null default 0
);

create table public.addons (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.addon_groups(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null default 0,
  active boolean not null default true,
  sort_order int not null default 0
);

-- ---------- CLIENTES ----------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Casa',
  street text not null,
  number text not null,
  complement text,
  neighborhood text not null,
  city text not null,
  reference text,
  created_at timestamptz not null default now()
);

-- ---------- CUPONS ----------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('percent', 'fixed', 'free_delivery')),
  value numeric(10,2) not null default 0,
  min_order numeric(10,2) not null default 0,
  max_uses int,
  used_count int not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- PEDIDOS ----------
create sequence public.order_code_seq start 1000;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code int not null default nextval('public.order_code_seq'),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_whatsapp text not null,
  fulfillment text not null check (fulfillment in ('delivery', 'pickup')),
  address jsonb, -- snapshot do endereço no momento do pedido
  payment_method text not null check (payment_method in ('pix', 'card', 'cash')),
  change_for numeric(10,2), -- troco para (dinheiro)
  status text not null default 'new' check (status in
    ('new', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'canceled')),
  channel text not null default 'web' check (channel in ('web', 'counter', 'phone', 'whatsapp')),
  subtotal numeric(10,2) not null,
  delivery_fee numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  coupon_code text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_status_idx on public.orders(status);
create index orders_user_idx on public.orders(user_id);
create index orders_created_idx on public.orders(created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null,
  addons jsonb not null default '[]', -- [{"name":"Bacon","price":3}]
  notes text,
  total numeric(10,2) not null
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.store_settings enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.addon_groups enable row level security;
alter table public.addons enable row level security;
alter table public.addresses enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- perfis: dono lê/edita o seu; admin lê todos
create policy "own profile" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id);

-- catálogo e configurações: leitura pública, escrita admin
create policy "public read settings" on public.store_settings for select using (true);
create policy "admin write settings" on public.store_settings for update using (public.is_admin());

create policy "public read categories" on public.categories for select using (true);
create policy "admin all categories" on public.categories for all using (public.is_admin());

create policy "public read products" on public.products for select using (true);
create policy "admin all products" on public.products for all using (public.is_admin());

create policy "public read addon_groups" on public.addon_groups for select using (true);
create policy "admin all addon_groups" on public.addon_groups for all using (public.is_admin());

create policy "public read addons" on public.addons for select using (true);
create policy "admin all addons" on public.addons for all using (public.is_admin());

-- endereços: somente o dono
create policy "own addresses" on public.addresses for all using (auth.uid() = user_id);

-- cupons: leitura pública (validação), escrita admin
create policy "public read coupons" on public.coupons for select using (true);
create policy "admin write coupons" on public.coupons for all using (public.is_admin());

-- pedidos: cliente cria e vê os seus; admin vê e atualiza todos
create policy "create order" on public.orders for insert
  with check (user_id is null or auth.uid() = user_id or public.is_admin());
create policy "read own orders" on public.orders for select
  using (auth.uid() = user_id or public.is_admin());
create policy "admin update orders" on public.orders for update using (public.is_admin());

create policy "create order items" on public.order_items for insert
  with check (exists (
    select 1 from public.orders o where o.id = order_id
      and (o.user_id is null or o.user_id = auth.uid() or public.is_admin())
  ));
create policy "read own order items" on public.order_items for select
  using (exists (
    select 1 from public.orders o where o.id = order_id
      and (o.user_id = auth.uid() or public.is_admin())
  ));

-- ---------- ACOMPANHAMENTO PÚBLICO ----------
-- Permite acompanhar um pedido conhecendo apenas o UUID (link de rastreio),
-- inclusive para pedidos feitos sem login.
create or replace function public.get_order_public(p_order_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'code', o.code, 'status', o.status,
    'customer_name', o.customer_name, 'fulfillment', o.fulfillment,
    'payment_method', o.payment_method, 'subtotal', o.subtotal,
    'delivery_fee', o.delivery_fee, 'discount', o.discount, 'total', o.total,
    'created_at', o.created_at, 'updated_at', o.updated_at,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'product_name', i.product_name, 'quantity', i.quantity,
        'addons', i.addons, 'notes', i.notes, 'total', i.total
      )), '[]'::jsonb)
      from order_items i where i.order_id = o.id
    )
  )
  from orders o where o.id = p_order_id;
$$;

-- ---------- REALTIME ----------
alter publication supabase_realtime add table public.orders;

-- ---------- STORAGE (imagens de produtos) ----------
insert into storage.buckets (id, name, public) values ('products', 'products', true)
on conflict do nothing;

create policy "public read product images" on storage.objects
  for select using (bucket_id = 'products');
create policy "admin upload product images" on storage.objects
  for insert with check (bucket_id = 'products' and public.is_admin());
create policy "admin delete product images" on storage.objects
  for delete using (bucket_id = 'products' and public.is_admin());

-- ============================================================
-- Após criar seu usuário admin (via cadastro no site), promova-o:
-- update public.profiles set role = 'admin' where id = 'UUID-DO-USUARIO';
-- ============================================================
