create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by_member_id uuid null references public.household_members(id) on delete set null,
  assigned_to_member_id uuid null references public.household_members(id) on delete set null,
  name text not null,
  category text not null default 'suscripcion',
  amount numeric(12,2) not null,
  currency text not null default 'CLP',
  frequency text not null default 'monthly',
  billing_day integer null,
  next_billing_date date null,
  start_date date null,
  end_date date null,
  payment_method text null,
  notes text null,
  is_active boolean not null default true,
  auto_create_transaction boolean not null default false,
  last_generated_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_expenses_name_check check (length(trim(name)) > 0),
  constraint recurring_expenses_amount_check check (amount >= 0),
  constraint recurring_expenses_currency_check check (length(trim(currency)) > 0),
  constraint recurring_expenses_frequency_check check (frequency in ('daily', 'weekly', 'monthly', 'yearly', 'custom')),
  constraint recurring_expenses_billing_day_check check (billing_day is null or billing_day between 1 and 31)
);

create index if not exists recurring_expenses_household_idx on public.recurring_expenses(household_id);
create index if not exists recurring_expenses_household_active_idx on public.recurring_expenses(household_id, is_active);
create index if not exists recurring_expenses_household_next_idx on public.recurring_expenses(household_id, next_billing_date);
create index if not exists recurring_expenses_household_frequency_idx on public.recurring_expenses(household_id, frequency);

alter table public.recurring_expenses enable row level security;
create policy "recurring_expenses_select_household" on public.recurring_expenses for select to authenticated
  using (public.is_household_member(household_id));
create policy "recurring_expenses_insert_household" on public.recurring_expenses for insert to authenticated
  with check (public.is_household_member(household_id)
    and public.member_belongs_to_household(created_by_member_id, household_id)
    and public.member_belongs_to_household(assigned_to_member_id, household_id));
create policy "recurring_expenses_update_household" on public.recurring_expenses for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id)
    and public.member_belongs_to_household(created_by_member_id, household_id)
    and public.member_belongs_to_household(assigned_to_member_id, household_id));
create policy "recurring_expenses_delete_household" on public.recurring_expenses for delete to authenticated
  using (public.is_household_member(household_id));

create or replace function public.set_recurring_expense_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists recurring_expenses_updated_at on public.recurring_expenses;
create trigger recurring_expenses_updated_at before update on public.recurring_expenses
for each row execute procedure public.set_recurring_expense_updated_at();
