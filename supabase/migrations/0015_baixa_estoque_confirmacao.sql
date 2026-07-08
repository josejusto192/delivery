-- ============================================================
-- Baixa automática de estoque dos insumos ao confirmar um pedido
-- (e estorno automático caso o pedido seja cancelado depois de confirmado)
-- ============================================================

alter table public.orders
  add column stock_deducted boolean not null default false;

create or replace function public.sync_order_stock(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  o record;
  has_items boolean;
begin
  select id, status, stock_deducted into o from public.orders where id = p_order_id for update;
  if not found then
    return;
  end if;

  select exists(select 1 from public.order_items where order_id = p_order_id) into has_items;
  if not has_items then
    return;
  end if;

  if o.status = 'confirmed' and not o.stock_deducted then
    update public.ingredients ing set stock_quantity = ing.stock_quantity - moved.qty
    from (
      select pi.ingredient_id, sum(pi.quantity * oi.quantity) as qty
      from public.order_items oi
      join public.product_ingredients pi on pi.product_id = oi.product_id
      where oi.order_id = p_order_id
      group by pi.ingredient_id
    ) moved
    where ing.id = moved.ingredient_id;

    update public.orders set stock_deducted = true where id = p_order_id;

  elsif o.status = 'canceled' and o.stock_deducted then
    update public.ingredients ing set stock_quantity = ing.stock_quantity + moved.qty
    from (
      select pi.ingredient_id, sum(pi.quantity * oi.quantity) as qty
      from public.order_items oi
      join public.product_ingredients pi on pi.product_id = oi.product_id
      where oi.order_id = p_order_id
      group by pi.ingredient_id
    ) moved
    where ing.id = moved.ingredient_id;

    update public.orders set stock_deducted = false where id = p_order_id;
  end if;
end; $$;

-- dispara quando o pedido é criado já confirmado (ex.: PDV) ou muda de status
create or replace function public.orders_stock_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_order_stock(new.id);
  return null;
end; $$;

create trigger orders_sync_stock
  after insert or update of status on public.orders
  for each row execute function public.orders_stock_trigger();

-- dispara quando os itens são inseridos depois do pedido já confirmado (ex.: PDV)
create or replace function public.order_items_stock_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_order_stock(coalesce(new.order_id, old.order_id));
  return null;
end; $$;

create trigger order_items_sync_stock
  after insert or update or delete on public.order_items
  for each row execute function public.order_items_stock_trigger();
