-- Shared work calendar per household.

create table if not exists public.work_shifts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by_member_id uuid null references public.household_members(id) on delete set null,
  assigned_to_member_id uuid null references public.household_members(id) on delete set null,
  shift_date date not null,
  shift_type text not null,
  label text not null,
  start_time time null,
  end_time time null,
  color text null,
  notes text null,
  is_day_off boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'work_shifts_shift_type_check') then
    alter table public.work_shifts add constraint work_shifts_shift_type_check
      check (shift_type in ('morning', 'afternoon', 'closing', 'day_off', 'custom'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'work_shifts_day_off_time_check') then
    alter table public.work_shifts add constraint work_shifts_day_off_time_check
      check (is_day_off = false or (start_time is null and end_time is null));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'work_shifts_time_range_check') then
    alter table public.work_shifts add constraint work_shifts_time_range_check
      check (start_time is null or end_time is null or start_time < end_time);
  end if;
end;
$$;

create index if not exists work_shifts_household_date_idx on public.work_shifts(household_id, shift_date);
create index if not exists work_shifts_assignee_date_idx on public.work_shifts(assigned_to_member_id, shift_date);
create index if not exists work_shifts_created_by_member_idx on public.work_shifts(created_by_member_id);

create or replace function public.set_work_shifts_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_work_shifts_updated_at on public.work_shifts;
create trigger set_work_shifts_updated_at
before update on public.work_shifts
for each row execute procedure public.set_work_shifts_updated_at();

alter table public.work_shifts enable row level security;

drop policy if exists "work_shifts_select_household" on public.work_shifts;
create policy "work_shifts_select_household" on public.work_shifts
for select to authenticated
using (public.is_household_member(household_id));

drop policy if exists "work_shifts_insert_household" on public.work_shifts;
create policy "work_shifts_insert_household" on public.work_shifts
for insert to authenticated
with check (
  public.is_household_member(household_id)
  and public.member_belongs_to_household(created_by_member_id, household_id)
  and public.member_belongs_to_household(assigned_to_member_id, household_id)
);

drop policy if exists "work_shifts_update_household" on public.work_shifts;
create policy "work_shifts_update_household" on public.work_shifts
for update to authenticated
using (public.is_household_member(household_id))
with check (
  public.is_household_member(household_id)
  and public.member_belongs_to_household(created_by_member_id, household_id)
  and public.member_belongs_to_household(assigned_to_member_id, household_id)
);

drop policy if exists "work_shifts_delete_household" on public.work_shifts;
create policy "work_shifts_delete_household" on public.work_shifts
for delete to authenticated
using (public.is_household_member(household_id));

grant select, insert, update, delete on public.work_shifts to authenticated;
