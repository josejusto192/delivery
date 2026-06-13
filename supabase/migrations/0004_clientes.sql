-- Módulo Clientes: dados extras de perfil
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists birth_date date;

-- preenche e-mail dos usuários já cadastrados
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- trigger de novo usuário passa a salvar e-mail e nascimento
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, whatsapp, email, birth_date)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'whatsapp',
    new.email,
    nullif(new.raw_user_meta_data->>'birth_date', '')::date
  );
  return new;
end; $$;
