-- Registro de problemas em pedidos e observações persistentes sobre clientes

alter table public.orders
  add column if not exists issue_type text,
  add column if not exists issue_notes text;

create table if not exists public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_whatsapp text not null unique,
  note text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.customer_notes enable row level security;

create policy "admin manage customer notes" on public.customer_notes
  for all using (public.is_admin()) with check (public.is_admin());
