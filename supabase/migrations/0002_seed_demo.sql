-- Dados de demonstração (opcional — apague depois de cadastrar o cardápio real)
insert into public.categories (id, name, sort_order) values
  ('11111111-1111-1111-1111-111111111111', 'Hambúrgueres', 1),
  ('22222222-2222-2222-2222-222222222222', 'Bebidas', 2),
  ('33333333-3333-3333-3333-333333333333', 'Sobremesas', 3);

insert into public.products (id, category_id, name, description, price, featured) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'X-Burger Clássico', 'Pão brioche, hambúrguer 150g, queijo, alface, tomate e molho da casa.', 24.90, true),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'X-Bacon Duplo', 'Dois hambúrgueres 150g, dobro de queijo, bacon crocante e cebola caramelizada.', 34.90, true),
  ('aaaaaaaa-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222',
   'Refrigerante Lata', 'Coca-Cola, Guaraná ou Fanta — 350ml.', 6.00, false),
  ('aaaaaaaa-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333',
   'Brownie com Sorvete', 'Brownie de chocolate quente com bola de sorvete de creme.', 16.90, false);

insert into public.addon_groups (id, product_id, name, min_select, max_select) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Adicionais', 0, 5);

insert into public.addons (group_id, name, price) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Bacon extra', 4.00),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Queijo extra', 3.00),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Ovo', 2.50);

insert into public.coupons (code, type, value, min_order) values
  ('BEMVINDO10', 'percent', 10, 30);
