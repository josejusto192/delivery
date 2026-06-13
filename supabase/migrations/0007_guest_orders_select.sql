-- Permite que o próprio fluxo de criação de pedido (insert().select()) funcione
-- para pedidos de convidados (user_id is null), corrigindo o erro
-- "não foi possível enviar o pedido" no checkout sem login.

drop policy if exists "read own orders" on public.orders;
create policy "read own orders" on public.orders
  for select using (
    (user_id is null and auth.uid() is null)
    or auth.uid() = user_id
    or public.is_admin()
  );

drop policy if exists "read own order items" on public.order_items;
create policy "read own order items" on public.order_items
  for select using (exists (
    select 1 from public.orders o where o.id = order_id
      and (
        (o.user_id is null and auth.uid() is null)
        or o.user_id = auth.uid()
        or public.is_admin()
      )
  ));
