-- Histórico de mudanças de status do pedido (com horários)
create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  created_at timestamptz not null default now()
);
create index osh_order_idx on public.order_status_history(order_id, created_at);

alter table public.order_status_history enable row level security;
create policy "read own history" on public.order_status_history for select
  using (exists (
    select 1 from public.orders o where o.id = order_id
      and (o.user_id = auth.uid() or public.is_admin())
  ));

-- registra automaticamente na criação e em cada mudança de status
create or replace function public.log_order_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into order_status_history (order_id, status, created_at) values (new.id, new.status, new.created_at);
  elsif new.status is distinct from old.status then
    insert into order_status_history (order_id, status) values (new.id, new.status);
  end if;
  return new;
end; $$;

create trigger orders_log_insert after insert on public.orders
  for each row execute function public.log_order_status();
create trigger orders_log_update after update on public.orders
  for each row execute function public.log_order_status();

-- backfill dos pedidos existentes (aproximado)
insert into public.order_status_history (order_id, status, created_at)
select id, 'new', created_at from public.orders;
insert into public.order_status_history (order_id, status, created_at)
select id, status, updated_at from public.orders where status <> 'new';

-- RPC pública de acompanhamento agora retorna dados completos + histórico
create or replace function public.get_order_public(p_order_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'code', o.code, 'status', o.status,
    'customer_name', o.customer_name, 'customer_whatsapp', o.customer_whatsapp,
    'fulfillment', o.fulfillment, 'address', o.address,
    'payment_method', o.payment_method, 'change_for', o.change_for,
    'subtotal', o.subtotal, 'delivery_fee', o.delivery_fee,
    'discount', o.discount, 'total', o.total,
    'coupon_code', o.coupon_code, 'notes', o.notes,
    'created_at', o.created_at, 'updated_at', o.updated_at,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'product_name', i.product_name, 'quantity', i.quantity,
        'addons', i.addons, 'notes', i.notes, 'total', i.total
      )), '[]'::jsonb)
      from order_items i where i.order_id = o.id
    ),
    'history', (
      select coalesce(jsonb_agg(jsonb_build_object('status', h.status, 'at', h.created_at) order by h.created_at), '[]'::jsonb)
      from order_status_history h where h.order_id = o.id
    )
  )
  from orders o where o.id = p_order_id;
$$;
