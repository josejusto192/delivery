-- Permite configurar um link de destino para cada banner do carrossel

alter table public.store_settings
  add column if not exists banner_links jsonb not null default '[]'::jsonb;
