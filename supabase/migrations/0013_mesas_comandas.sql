-- Comandas/Mesas: permite abrir uma "comanda" vinculada a uma mesa, lançar itens
-- ao longo do atendimento (sem fechar o pedido) e fechar no final com pagamento e impressão.

alter table public.orders add column table_number int;
alter table public.orders add column closed_at timestamptz;

-- payment_method só é definido no fechamento da comanda — passa a aceitar nulo enquanto aberta.
alter table public.orders alter column payment_method drop not null;
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method is null or payment_method in ('pix', 'card', 'cash'));

alter table public.orders drop constraint if exists orders_fulfillment_check;
alter table public.orders add constraint orders_fulfillment_check
  check (fulfillment in ('delivery', 'pickup', 'dine_in'));

alter table public.orders drop constraint if exists orders_channel_check;
alter table public.orders add constraint orders_channel_check
  check (channel in ('web', 'counter', 'phone', 'whatsapp', 'dine_in'));

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('open_tab', 'new', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'canceled'));

create index orders_table_number_idx on public.orders(table_number) where status = 'open_tab';

-- comandas (dine_in) não têm taxa de entrega, igual ao pickup.
create or replace function public.recompute_order_totals()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  oid uuid := coalesce(new.order_id, old.order_id);
  o record;
  c record;
  new_subtotal numeric;
  new_fee numeric;
  new_discount numeric;
  area_fee numeric;
begin
  select coalesce(sum(total), 0) into new_subtotal from order_items where order_id = oid;
  select * into o from orders where id = oid;
  if not found then return null; end if;

  if o.fulfillment in ('pickup', 'dine_in') then
    new_fee := 0;
  else
    new_fee := null;
    if o.coupon_code is not null then
      select * into c from coupons where code = o.coupon_code and active;
      if found and c.type = 'free_delivery' then
        new_fee := 0;
      end if;
    end if;
    if new_fee is null then
      select s.delivery_fee into new_fee from store_settings s where s.id = 1;
      if o.address is not null and (o.address->>'area') is not null then
        select (a->>'fee')::numeric into area_fee
        from store_settings s, jsonb_array_elements(s.delivery_areas) a
        where s.id = 1 and a->>'name' = o.address->>'area';
        if area_fee is not null then new_fee := area_fee; end if;
      end if;
    end if;
  end if;

  new_discount := 0;
  if o.coupon_code is not null then
    select * into c from coupons
      where code = o.coupon_code and active
        and (expires_at is null or expires_at > now())
        and (max_uses is null or used_count < max_uses)
        and new_subtotal >= min_order;
    if found then
      if c.type = 'percent' then
        new_discount := round(new_subtotal * c.value / 100, 2);
      elsif c.type = 'fixed' then
        new_discount := least(c.value, new_subtotal);
      end if;
    end if;
  end if;

  update orders set
    subtotal = new_subtotal,
    delivery_fee = coalesce(new_fee, 0),
    discount = new_discount,
    total = greatest(0, new_subtotal + coalesce(new_fee, 0) - new_discount)
  where id = oid;

  return null;
end; $$;
