-- Household members for shared account usage.

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  avatar text null,
  created_at timestamptz not null default now(),
  unique(user_id, slug),
  constraint household_members_slug_check check (slug in ('benjamin', 'javiera'))
);

alter table public.tasks add column if not exists created_by_member_id uuid null references public.household_members(id) on delete set null;
alter table public.shopping_items add column if not exists created_by_member_id uuid null references public.household_members(id) on delete set null;
alter table public.inventory add column if not exists created_by_member_id uuid null references public.household_members(id) on delete set null;
alter table public.finances add column if not exists created_by_member_id uuid null references public.household_members(id) on delete set null;
alter table public.memories add column if not exists created_by_member_id uuid null references public.household_members(id) on delete set null;
alter table public.conversations add column if not exists created_by_member_id uuid null references public.household_members(id) on delete set null;

alter table public.memories add column if not exists scope text not null default 'shared';
alter table public.memories add column if not exists member_id uuid null references public.household_members(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'memories_scope_check'
  ) then
    alter table public.memories add constraint memories_scope_check check (scope in ('shared', 'personal'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'memories_scope_member_check'
  ) then
    alter table public.memories add constraint memories_scope_member_check check (
      (scope = 'shared' and member_id is null) or
      (scope = 'personal' and member_id is not null)
    );
  end if;
end;
$$;

create index if not exists household_members_user_slug_idx on public.household_members(user_id, slug);
create index if not exists tasks_created_by_member_idx on public.tasks(created_by_member_id);
create index if not exists shopping_created_by_member_idx on public.shopping_items(created_by_member_id);
create index if not exists inventory_created_by_member_idx on public.inventory(created_by_member_id);
create index if not exists finances_created_by_member_idx on public.finances(created_by_member_id);
create index if not exists memories_scope_member_idx on public.memories(user_id, scope, member_id);
create index if not exists conversations_created_by_member_idx on public.conversations(created_by_member_id);

alter table public.household_members enable row level security;

drop policy if exists "household_members_select_own" on public.household_members;
create policy "household_members_select_own" on public.household_members for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "household_members_insert_own" on public.household_members;
create policy "household_members_insert_own" on public.household_members for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "household_members_update_own" on public.household_members;
create policy "household_members_update_own" on public.household_members for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "household_members_delete_own" on public.household_members;
create policy "household_members_delete_own" on public.household_members for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.household_members to authenticated;

insert into public.household_members (user_id, name, slug)
select id, 'Benjamín', 'benjamin' from auth.users
on conflict (user_id, slug) do nothing;

insert into public.household_members (user_id, name, slug)
select id, 'Javiera', 'javiera' from auth.users
on conflict (user_id, slug) do nothing;
