-- Asistente Personal IA - Esquema Supabase
-- Ejecutar completo en Supabase > SQL Editor para una instalación nueva.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text,
  timezone text not null default 'America/Santiago',
  currency char(3) not null default 'CLP',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  avatar text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(household_id, auth_user_id),
  unique(household_id, slug)
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value text not null,
  category text not null default 'general',
  importance smallint not null default 3 check (importance between 1 and 5),
  scope text not null default 'shared' check (scope in ('shared', 'personal')),
  member_id uuid null references public.household_members(id) on delete set null,
  created_by_member_id uuid null references public.household_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memories_scope_member_check check (
    (scope = 'shared' and member_id is null) or
    (scope = 'personal' and member_id is not null)
  )
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by_member_id uuid null references public.household_members(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date timestamptz,
  completed_at timestamptz,
  created_by_member_id uuid null references public.household_members(id) on delete set null,
  assigned_to_member_id uuid null references public.household_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit text not null default 'unidad',
  category text not null default 'General',
  purchased boolean not null default false,
  purchased_at timestamptz,
  created_by_member_id uuid null references public.household_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  quantity numeric(12,3) not null check (quantity >= 0),
  unit text not null,
  purchase_date date,
  expiration_date date,
  location text not null default 'despensa' check (location in ('refrigerador', 'congelador', 'despensa', 'otro')),
  category text not null default 'General',
  notes text,
  created_by_member_id uuid null references public.household_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finances (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(14,2) not null check (amount > 0),
  category text not null,
  description text,
  transaction_date date not null default current_date,
  created_by_member_id uuid null references public.household_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists household_members_household_idx on public.household_members(household_id);
create index if not exists household_members_auth_user_idx on public.household_members(auth_user_id);
create index if not exists memories_household_scope_idx on public.memories(household_id, scope, member_id);
create index if not exists conversations_household_idx on public.conversations(household_id, created_at desc);
create index if not exists tasks_household_idx on public.tasks(household_id, status, due_date);
create index if not exists shopping_household_idx on public.shopping_items(household_id, purchased, created_at desc);
create index if not exists inventory_household_idx on public.inventory(household_id, expiration_date);
create index if not exists finances_household_idx on public.finances(household_id, transaction_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

do $$
declare
  table_name text;
begin
  foreach table_name in array array['users', 'households', 'household_members', 'memories', 'tasks', 'shopping_items', 'inventory', 'finances']
  loop
    execute format('drop trigger if exists %I on public.%I', 'set_' || table_name || '_updated_at', table_name);
    execute format('create trigger %I before update on public.%I for each row execute procedure public.set_updated_at()', 'set_' || table_name || '_updated_at', table_name);
  end loop;
end;
$$;

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

alter table public.users enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.memories enable row level security;
alter table public.conversations enable row level security;
alter table public.tasks enable row level security;
alter table public.shopping_items enable row level security;
alter table public.inventory enable row level security;
alter table public.finances enable row level security;

create or replace function public.is_household_member(target_household_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_members hm where hm.household_id = target_household_id and hm.auth_user_id = auth.uid());
$$;

create or replace function public.is_household_owner(target_household_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_members hm where hm.household_id = target_household_id and hm.auth_user_id = auth.uid() and hm.role = 'owner');
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
returns boolean language sql stable security definer set search_path = public as $$
  select target_member_id is null or exists (select 1 from public.household_members hm where hm.id = target_member_id and hm.household_id = target_household_id);
$$;

create policy "users_select_own" on public.users for select to authenticated using ((select auth.uid()) = id);
create policy "users_insert_own" on public.users for insert to authenticated with check ((select auth.uid()) = id);
create policy "users_update_own" on public.users for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "households_select_member" on public.households for select to authenticated using (public.is_household_member(id));
create policy "households_update_owner" on public.households for update to authenticated using (public.is_household_owner(id)) with check (public.is_household_owner(id));
create policy "household_members_select_household" on public.household_members for select to authenticated using (public.is_household_member(household_id));
create policy "household_members_insert_owner" on public.household_members for insert to authenticated with check (public.is_household_owner(household_id));
create policy "household_members_update_self_or_owner" on public.household_members for update to authenticated using (auth_user_id = auth.uid() or public.is_household_owner(household_id)) with check (public.is_household_member(household_id));
create policy "household_members_delete_owner" on public.household_members for delete to authenticated using (public.is_household_owner(household_id) and auth_user_id <> auth.uid());

create policy "tasks_select_household" on public.tasks for select to authenticated using (public.is_household_member(household_id));
create policy "tasks_insert_household" on public.tasks for insert to authenticated with check (public.is_household_member(household_id) and public.member_belongs_to_household(created_by_member_id, household_id) and public.member_belongs_to_household(assigned_to_member_id, household_id));
create policy "tasks_update_household" on public.tasks for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id) and public.member_belongs_to_household(created_by_member_id, household_id) and public.member_belongs_to_household(assigned_to_member_id, household_id));
create policy "tasks_delete_household" on public.tasks for delete to authenticated using (public.is_household_member(household_id));

do $$
declare
  table_name text;
begin
  foreach table_name in array array['shopping_items', 'inventory', 'finances', 'conversations']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_household_member(household_id))', table_name || '_select_household', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_household_member(household_id) and public.member_belongs_to_household(created_by_member_id, household_id))', table_name || '_insert_household', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id) and public.member_belongs_to_household(created_by_member_id, household_id))', table_name || '_update_household', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_household_member(household_id))', table_name || '_delete_household', table_name);
  end loop;
end;
$$;

create policy "memories_select_household" on public.memories for select to authenticated using (public.is_household_member(household_id) and (scope = 'shared' or public.is_current_household_member(member_id, household_id)));
create policy "memories_insert_household" on public.memories for insert to authenticated with check (public.is_household_member(household_id) and public.member_belongs_to_household(created_by_member_id, household_id) and (scope = 'shared' or public.is_current_household_member(member_id, household_id)));
create policy "memories_update_household" on public.memories for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id) and public.member_belongs_to_household(created_by_member_id, household_id) and (scope = 'shared' or public.is_current_household_member(member_id, household_id)));
create policy "memories_delete_household" on public.memories for delete to authenticated using (public.is_household_member(household_id) and (scope = 'shared' or public.is_current_household_member(member_id, household_id)));

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.users, public.households, public.household_members, public.memories, public.conversations, public.tasks, public.shopping_items, public.inventory, public.finances to authenticated;
