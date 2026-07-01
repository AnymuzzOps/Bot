-- Asistente Personal IA - Esquema Supabase
-- Ejecutar completo en Supabase > SQL Editor.

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

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value text not null,
  category text not null default 'general',
  importance smallint not null default 3 check (importance between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, key)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit text not null default 'unidad',
  category text not null default 'General',
  purchased boolean not null default false,
  purchased_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  quantity numeric(12,3) not null check (quantity >= 0),
  unit text not null,
  purchase_date date,
  expiration_date date,
  location text not null default 'despensa' check (location in ('refrigerador', 'congelador', 'despensa', 'otro')),
  category text not null default 'General',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(14,2) not null check (amount > 0),
  category text not null,
  description text,
  transaction_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists memories_user_updated_idx on public.memories(user_id, updated_at desc);
create index if not exists conversations_user_created_idx on public.conversations(user_id, created_at desc);
create index if not exists tasks_user_status_due_idx on public.tasks(user_id, status, due_date);
create index if not exists shopping_user_purchased_idx on public.shopping_items(user_id, purchased, created_at desc);
create index if not exists inventory_user_expiration_idx on public.inventory(user_id, expiration_date);
create index if not exists finances_user_date_idx on public.finances(user_id, transaction_date desc);

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
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

do $$
declare
  table_name text;
begin
  foreach table_name in array array['users', 'memories', 'tasks', 'shopping_items', 'inventory', 'finances']
  loop
    execute format(
      'drop trigger if exists %I on public.%I',
      'set_' || table_name || '_updated_at',
      table_name
    );
    execute format(
      'create trigger %I before update on public.%I for each row execute procedure public.set_updated_at()',
      'set_' || table_name || '_updated_at',
      table_name
    );
  end loop;
end;
$$;

alter table public.users enable row level security;
alter table public.memories enable row level security;
alter table public.conversations enable row level security;
alter table public.tasks enable row level security;
alter table public.shopping_items enable row level security;
alter table public.inventory enable row level security;
alter table public.finances enable row level security;

-- Perfil: cada usuario solo accede a su propia fila.
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own" on public.users for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Políticas CRUD uniformes para tablas con user_id.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['memories', 'conversations', 'tasks', 'shopping_items', 'inventory', 'finances']
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name || '_select_own', table_name);

    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name || '_insert_own', table_name);

    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name || '_update_own', table_name);

    execute format('drop policy if exists %I on public.%I', table_name || '_delete_own', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name || '_delete_own', table_name);
  end loop;
end;
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.users to authenticated;
grant select, insert, update, delete on public.memories to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.shopping_items to authenticated;
grant select, insert, update, delete on public.inventory to authenticated;
grant select, insert, update, delete on public.finances to authenticated;
