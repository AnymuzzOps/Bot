-- Shared households for multiple Supabase Auth users.
-- Safe migration from the previous single-account/internal-member model.

create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.household_members add column if not exists household_id uuid null references public.households(id) on delete cascade;
alter table public.household_members add column if not exists auth_user_id uuid null references auth.users(id) on delete cascade;
alter table public.household_members add column if not exists role text not null default 'member';
alter table public.household_members add column if not exists updated_at timestamptz not null default now();

alter table public.tasks add column if not exists household_id uuid null references public.households(id) on delete cascade;
alter table public.tasks add column if not exists assigned_to_member_id uuid null references public.household_members(id) on delete set null;
alter table public.shopping_items add column if not exists household_id uuid null references public.households(id) on delete cascade;
alter table public.inventory add column if not exists household_id uuid null references public.households(id) on delete cascade;
alter table public.finances add column if not exists household_id uuid null references public.households(id) on delete cascade;
alter table public.memories add column if not exists household_id uuid null references public.households(id) on delete cascade;
alter table public.conversations add column if not exists household_id uuid null references public.households(id) on delete cascade;

alter table public.tasks add column if not exists created_by_member_id uuid null references public.household_members(id) on delete set null;
alter table public.shopping_items add column if not exists created_by_member_id uuid null references public.household_members(id) on delete set null;
alter table public.inventory add column if not exists created_by_member_id uuid null references public.household_members(id) on delete set null;
alter table public.finances add column if not exists created_by_member_id uuid null references public.household_members(id) on delete set null;
alter table public.memories add column if not exists created_by_member_id uuid null references public.household_members(id) on delete set null;
alter table public.conversations add column if not exists created_by_member_id uuid null references public.household_members(id) on delete set null;
alter table public.memories add column if not exists scope text not null default 'shared';
alter table public.memories add column if not exists member_id uuid null references public.household_members(id) on delete set null;

alter table public.household_members drop constraint if exists household_members_slug_check;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'household_members_role_check') then
    alter table public.household_members add constraint household_members_role_check check (role in ('owner', 'member'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'household_members_household_auth_user_key') then
    alter table public.household_members add constraint household_members_household_auth_user_key unique (household_id, auth_user_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'household_members_household_slug_key') then
    alter table public.household_members add constraint household_members_household_slug_key unique (household_id, slug);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'memories_scope_check') then
    alter table public.memories add constraint memories_scope_check check (scope in ('shared', 'personal'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'memories_scope_member_check') then
    alter table public.memories add constraint memories_scope_member_check check (
      (scope = 'shared' and member_id is null) or
      (scope = 'personal' and member_id is not null)
    );
  end if;
end;
$$;

-- Bootstrap one private household per existing auth user so current data remains visible until accounts are joined manually.
do $$
declare
  auth_user record;
  private_household_id uuid;
  private_slug text;
begin
  for auth_user in select id, email, raw_user_meta_data from auth.users loop
    select hm.household_id into private_household_id
    from public.household_members hm
    where hm.auth_user_id = auth_user.id
      and hm.household_id is not null
    limit 1;

    if private_household_id is null then
      insert into public.households (name)
      values (coalesce(auth_user.raw_user_meta_data ->> 'full_name', auth_user.email, 'Hogar'))
      returning id into private_household_id;
    end if;

    private_slug := regexp_replace(
      lower(coalesce(nullif(auth_user.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(auth_user.email, 'usuario'), '@', 1))),
      '[^a-z0-9]+',
      '-',
      'g'
    );

    insert into public.household_members (household_id, auth_user_id, user_id, name, slug, role)
    values (
      private_household_id,
      auth_user.id,
      auth_user.id,
      coalesce(nullif(auth_user.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(auth_user.email, 'usuario'), '@', 1)),
      coalesce(nullif(private_slug, ''), 'usuario'),
      'owner'
    )
    on conflict do nothing;
  end loop;
end;
$$;

update public.household_members
set auth_user_id = coalesce(auth_user_id, user_id),
    role = coalesce(role, 'member')
where auth_user_id is null;

update public.tasks t set household_id = hm.household_id, created_by_member_id = hm.id
from public.household_members hm where t.household_id is null and t.user_id = hm.auth_user_id;
update public.shopping_items s set household_id = hm.household_id, created_by_member_id = hm.id
from public.household_members hm where s.household_id is null and s.user_id = hm.auth_user_id;
update public.inventory i set household_id = hm.household_id, created_by_member_id = hm.id
from public.household_members hm where i.household_id is null and i.user_id = hm.auth_user_id;
update public.finances f set household_id = hm.household_id, created_by_member_id = hm.id
from public.household_members hm where f.household_id is null and f.user_id = hm.auth_user_id;
update public.memories m set household_id = hm.household_id, created_by_member_id = hm.id
from public.household_members hm where m.household_id is null and m.user_id = hm.auth_user_id;
update public.conversations c set household_id = hm.household_id, created_by_member_id = hm.id
from public.household_members hm where c.household_id is null and c.user_id = hm.auth_user_id;

create index if not exists households_updated_idx on public.households(updated_at desc);
create index if not exists household_members_household_idx on public.household_members(household_id);
create index if not exists household_members_auth_user_idx on public.household_members(auth_user_id);
create index if not exists tasks_household_idx on public.tasks(household_id, status, due_date);
create index if not exists shopping_household_idx on public.shopping_items(household_id, purchased, created_at desc);
create index if not exists inventory_household_idx on public.inventory(household_id, expiration_date);
create index if not exists finances_household_idx on public.finances(household_id, transaction_date desc);
create index if not exists memories_household_scope_idx on public.memories(household_id, scope, member_id);
create index if not exists conversations_household_idx on public.conversations(household_id, created_at desc);

create or replace function public.prevent_household_member_auth_user_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.auth_user_id is distinct from new.auth_user_id then
    raise exception 'auth_user_id cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_household_member_auth_user_change on public.household_members;
create trigger prevent_household_member_auth_user_change
before update on public.household_members
for each row execute procedure public.prevent_household_member_auth_user_change();

alter table public.households enable row level security;
alter table public.household_members enable row level security;

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household_id
      and hm.auth_user_id = auth.uid()
  );
$$;

create or replace function public.is_household_owner(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household_id
      and hm.auth_user_id = auth.uid()
      and hm.role = 'owner'
  );
$$;


create or replace function public.is_current_household_member(target_member_id uuid, target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_member_id is not null and exists (
    select 1 from public.household_members hm
    where hm.id = target_member_id
      and hm.household_id = target_household_id
      and hm.auth_user_id = auth.uid()
  );
$$;

create or replace function public.member_belongs_to_household(target_member_id uuid, target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_member_id is null or exists (
    select 1 from public.household_members hm
    where hm.id = target_member_id
      and hm.household_id = target_household_id
  );
$$;

drop policy if exists "households_select_member" on public.households;
create policy "households_select_member" on public.households for select to authenticated using (public.is_household_member(id));
drop policy if exists "households_update_owner" on public.households;
create policy "households_update_owner" on public.households for update to authenticated using (public.is_household_owner(id)) with check (public.is_household_owner(id));

drop policy if exists "household_members_select_household" on public.household_members;
create policy "household_members_select_household" on public.household_members for select to authenticated using (public.is_household_member(household_id));
drop policy if exists "household_members_insert_owner" on public.household_members;
create policy "household_members_insert_owner" on public.household_members for insert to authenticated with check (public.is_household_owner(household_id) and auth_user_id = auth.uid());
drop policy if exists "household_members_update_self_or_owner" on public.household_members;
create policy "household_members_update_self_or_owner" on public.household_members for update to authenticated using (auth_user_id = auth.uid() or public.is_household_owner(household_id)) with check (auth_user_id = auth.uid() and public.is_household_member(household_id));
drop policy if exists "household_members_delete_owner" on public.household_members;
create policy "household_members_delete_owner" on public.household_members for delete to authenticated using (public.is_household_owner(household_id) and auth_user_id <> auth.uid());

-- Replace user-scoped table policies with household-scoped policies.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['tasks', 'shopping_items', 'inventory', 'finances', 'memories', 'conversations']
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_select_household', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_household', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_household', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_household', table_name);

    execute format('create policy %I on public.%I for select to authenticated using (public.is_household_member(household_id))', table_name || '_select_household', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_household_member(household_id) and public.member_belongs_to_household(created_by_member_id, household_id))', table_name || '_insert_household', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id) and public.member_belongs_to_household(created_by_member_id, household_id))', table_name || '_update_household', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_household_member(household_id))', table_name || '_delete_household', table_name);
  end loop;
end;
$$;



-- Tasks also validate optional assignee against the same household.
drop policy if exists "tasks_insert_household" on public.tasks;
drop policy if exists "tasks_update_household" on public.tasks;
create policy "tasks_insert_household" on public.tasks for insert to authenticated with check (
  public.is_household_member(household_id)
  and public.member_belongs_to_household(created_by_member_id, household_id)
  and public.member_belongs_to_household(assigned_to_member_id, household_id)
);
create policy "tasks_update_household" on public.tasks for update to authenticated using (public.is_household_member(household_id)) with check (
  public.is_household_member(household_id)
  and public.member_belongs_to_household(created_by_member_id, household_id)
  and public.member_belongs_to_household(assigned_to_member_id, household_id)
);

-- Memories need stricter personal-memory visibility than other household tables.
drop policy if exists "memories_select_household" on public.memories;
drop policy if exists "memories_insert_household" on public.memories;
drop policy if exists "memories_update_household" on public.memories;
drop policy if exists "memories_delete_household" on public.memories;
create policy "memories_select_household" on public.memories for select to authenticated using (
  public.is_household_member(household_id)
  and (scope = 'shared' or public.is_current_household_member(member_id, household_id))
);
create policy "memories_insert_household" on public.memories for insert to authenticated with check (
  public.is_household_member(household_id)
  and public.member_belongs_to_household(created_by_member_id, household_id)
  and (scope = 'shared' or public.is_current_household_member(member_id, household_id))
);
create policy "memories_update_household" on public.memories for update to authenticated using (public.is_household_member(household_id)) with check (
  public.is_household_member(household_id)
  and public.member_belongs_to_household(created_by_member_id, household_id)
  and (scope = 'shared' or public.is_current_household_member(member_id, household_id))
);
create policy "memories_delete_household" on public.memories for delete to authenticated using (
  public.is_household_member(household_id)
  and (scope = 'shared' or public.is_current_household_member(member_id, household_id))
);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.households to authenticated;
grant select, insert, update, delete on public.household_members to authenticated;
