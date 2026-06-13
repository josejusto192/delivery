-- Preço promocional (de/por) e informações da loja estilo marketplace
alter table public.products add column if not exists promo_price numeric(10,2);

alter table public.store_settings add column if not exists banner_url text;
alter table public.store_settings add column if not exists delivery_time_min int not null default 40;
alter table public.store_settings add column if not exists delivery_time_max int not null default 60;
