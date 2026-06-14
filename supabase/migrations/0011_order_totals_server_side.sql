-- Segurança: recalcula valores do pedido no servidor a partir dos itens,
-- produtos/adicionais e cupom — o cliente não pode mais manipular preços/total.

create or replace function public.validate_order_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  prod record;
  addon_el jsonb;
  fixed_addons jsonb := '[]'::jsonb;
  addon_price numeric;
  addons_total numeric := 0;
begin
  if new.product_id is not null then
    select price, promo_price into prod from products where id = new.product_id;
    if found then
      new.unit_price := case
        when prod.promo_price is not null and prod.promo_price < prod.price then prod.promo_price
        else prod.price
      end;

      for addon_el in select * from jsonb_array_elements(coalesce(new.addons, '[]'::jsonb))
      loop
        select a.price into addon_price
        from addons a
        join addon_groups g on g.id = a.group_id
        where g.product_id = new.product_id
          and a.name = addon_el->>'name'
          and a.active
        limit 1;

        if addon_price is null then
          continue; -- adicional inexistente para este produto: ignora
        end if;

        fixed_addons := fixed_addons || jsonb_build_object('name', addon_el->>'name', 'price', addon_price);
        addons_total := addons_total + addon_price;
      end loop;

      new.addons := fixed_addons;
      new.total := (new.unit_price + addons_total) * new.quantity;
    end if;
  end if;

  return new;
end; $$;

create trigger order_items_validate
  before insert or update on public.order_items
  for each row execute function public.validate_order_item();

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

  if o.fulfillment = 'pickup' then
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

create trigger order_items_recompute
  after insert or update or delete on public.order_items
  for each row execute function public.recompute_order_totals();
