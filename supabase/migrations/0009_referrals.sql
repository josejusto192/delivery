-- Sistema de indicação ("indique e ganhe")

alter table public.profiles
  add column if not exists referral_code text unique,
  add column if not exists referred_by uuid references public.profiles(id),
  add column if not exists referral_reward_given boolean not null default false,
  add column if not exists welcome_coupon_code text;

alter table public.store_settings
  add column if not exists referral_enabled boolean not null default true,
  add column if not exists referral_percent numeric(5,2) not null default 10,
  add column if not exists referral_min_order numeric(10,2) not null default 0,
  add column if not exists referral_title text not null default 'Indique e ganhe',
  add column if not exists referral_description text not null default
    'Compartilhe seu código com amigos. Quem usar ganha desconto na primeira compra, e você ganha um cupom quando o pedido dele for concluído.';

-- gera um código de indicação único a partir do nome do usuário
create or replace function public.generate_referral_code(p_name text)
returns text language plpgsql as $$
declare
  base text;
  candidate text;
begin
  base := upper(regexp_replace(coalesce(split_part(p_name, ' ', 1), 'AMIGO'), '[^A-Za-z0-9]', '', 'g'));
  if base = '' then base := 'AMIGO'; end if;
  loop
    candidate := base || '-' || upper(substr(md5(random()::text), 1, 4));
    if not exists (select 1 from public.profiles where referral_code = candidate) then
      return candidate;
    end if;
  end loop;
end; $$;

-- atualiza criação de perfil: gera referral_code, vincula quem indicou
-- e cria um cupom de boas-vindas para quem se cadastrou com um código
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_referrer_id uuid;
  v_referral_code text;
  v_welcome_code text;
  v_settings record;
begin
  select id into v_referrer_id from public.profiles
    where referral_code = upper(new.raw_user_meta_data->>'referral_code');

  v_referral_code := public.generate_referral_code(coalesce(new.raw_user_meta_data->>'name', new.email));

  if v_referrer_id is not null then
    select referral_percent, referral_min_order into v_settings
      from public.store_settings where id = 1;
    v_welcome_code := 'BV' || upper(substr(replace(new.id::text, '-', ''), 1, 6));
    insert into public.coupons (code, type, value, min_order, max_uses, active)
    values (v_welcome_code, 'percent', coalesce(v_settings.referral_percent, 10), coalesce(v_settings.referral_min_order, 0), 1, true);
  end if;

  insert into public.profiles (id, name, whatsapp, email, birth_date, referral_code, referred_by, welcome_coupon_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'whatsapp',
    new.email,
    nullif(new.raw_user_meta_data->>'birth_date', '')::date,
    v_referral_code,
    v_referrer_id,
    v_welcome_code
  );
  return new;
end; $$;

-- gera referral_code para perfis já existentes
update public.profiles set referral_code = public.generate_referral_code(name) where referral_code is null;

-- recompensa de quem indicou: ao concluir o primeiro pedido do indicado
create table public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid references public.profiles(id) on delete set null,
  coupon_code text not null,
  created_at timestamptz not null default now()
);

alter table public.referral_rewards enable row level security;
create policy "read own referral rewards" on public.referral_rewards
  for select using (auth.uid() = referrer_id or public.is_admin());

create or replace function public.handle_order_referral_reward()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_profile record;
  v_settings record;
  v_order_count int;
  v_code text;
begin
  if new.user_id is null or new.status <> 'delivered' then
    return new;
  end if;

  select * into v_profile from public.profiles where id = new.user_id;
  if v_profile is null or v_profile.referred_by is null or v_profile.referral_reward_given then
    return new;
  end if;

  select count(*) into v_order_count from public.orders
    where user_id = new.user_id and status = 'delivered';
  if v_order_count <> 1 then
    return new;
  end if;

  select referral_percent, referral_min_order into v_settings from public.store_settings where id = 1;
  v_code := 'IND' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.coupons (code, type, value, min_order, max_uses, active)
  values (v_code, 'percent', coalesce(v_settings.referral_percent, 10), coalesce(v_settings.referral_min_order, 0), 1, true);

  insert into public.referral_rewards (referrer_id, referred_id, coupon_code)
  values (v_profile.referred_by, v_profile.id, v_code);

  update public.profiles set referral_reward_given = true where id = v_profile.id;
  return new;
end; $$;

create trigger on_order_status_referral_reward
  after update of status on public.orders
  for each row execute function public.handle_order_referral_reward();
