-- Upload de logo e múltiplos banners (carrossel) para a loja

alter table public.store_settings
  add column if not exists banner_urls jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public)
values ('store', 'store', true)
on conflict (id) do nothing;

create policy "public read store images" on storage.objects
  for select using (bucket_id = 'store');
create policy "admin upload store images" on storage.objects
  for insert with check (bucket_id = 'store' and public.is_admin());
create policy "admin update store images" on storage.objects
  for update using (bucket_id = 'store' and public.is_admin());
create policy "admin delete store images" on storage.objects
  for delete using (bucket_id = 'store' and public.is_admin());
