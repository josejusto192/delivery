-- ============================================================
-- Financeiro: custos fixos recorrentes e lançamento de contas (despesas)
-- ============================================================

-- ---------- CUSTOS FIXOS (modelos recorrentes, ex.: aluguel, internet) ----------
create table public.expense_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Outros',
  amount numeric(10,2) not null default 0,
  day_of_month int not null default 5 check (day_of_month between 1 and 28),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- CONTAS / LANÇAMENTOS (ficha mensal de despesas) ----------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.expense_templates(id) on delete set null,
  name text not null,
  category text not null default 'Outros',
  amount numeric(10,2) not null default 0,
  competence_month date not null, -- primeiro dia do mês de referência (ex.: 2026-07-01)
  due_date date,
  paid boolean not null default false,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index expenses_competence_idx on public.expenses (competence_month);

-- evita gerar duas vezes a conta do mesmo custo fixo no mesmo mês
create unique index expenses_template_month_uidx on public.expenses (template_id, competence_month)
  where template_id is not null;

-- ---------- RLS ----------
alter table public.expense_templates enable row level security;
alter table public.expenses enable row level security;

create policy "admin all expense_templates" on public.expense_templates for all using (public.is_admin());
create policy "admin all expenses" on public.expenses for all using (public.is_admin());
