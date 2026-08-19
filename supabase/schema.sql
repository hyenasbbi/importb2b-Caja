-- =====================================================================
-- IMPORTB2B CONTROL FINANCIERO — BETA v0.1
-- Supabase / Postgres
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- PERFILES DE SOCIOS / STAFF
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Usuario',
  role text not null default 'admin' check (role in ('admin','owner')),
  created_at timestamptz not null default now()
);

-- Crea perfil automáticamente al crear usuario en Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'Usuario')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Si las cuentas ya existían antes de ejecutar este esquema, crear sus perfiles.
insert into public.profiles (id, full_name)
select
  id,
  coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1), 'Usuario')
from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- MOVIMIENTOS
-- ---------------------------------------------------------------------
create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('income','expense')),
  amount numeric(18,4) not null check (amount > 0),
  currency text not null check (currency in ('ARS','USDT')),
  payment_method text not null check (payment_method in ('transferencia','efectivo','usdt')),
  category text not null,
  description text,
  occurred_at timestamptz not null default now(),

  -- Para USDT: se congela la cotización del momento.
  quote_type text check (quote_type in ('buy','sell') or quote_type is null),
  quote_ars numeric(18,4),
  ars_equivalent numeric(18,4) not null,

  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint usdt_quote_required check (
    (currency = 'ARS')
    or
    (currency = 'USDT' and quote_type is not null and quote_ars is not null)
  )
);

create index if not exists movements_occurred_at_idx on public.movements (occurred_at desc);
create index if not exists movements_created_by_idx on public.movements (created_by);
create index if not exists movements_method_idx on public.movements (payment_method);

-- ---------------------------------------------------------------------
-- SNAPSHOTS DE COTIZACIÓN
-- ---------------------------------------------------------------------
create table if not exists public.quote_snapshots (
  id uuid primary key default gen_random_uuid(),
  buy_ars numeric(18,4) not null check (buy_ars > 0),
  sell_ars numeric(18,4) not null check (sell_ars > 0),
  source text not null default 'BINANCE P2P',
  captured_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) default auth.uid()
);

create index if not exists quote_snapshots_captured_idx on public.quote_snapshots (captured_at desc);

-- ---------------------------------------------------------------------
-- AUDITORÍA
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  entity_type text not null default 'movement',
  entity_id uuid,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  actor_id uuid references public.profiles(id),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists movements_touch_updated_at on public.movements;
create trigger movements_touch_updated_at
before update on public.movements
for each row execute procedure public.touch_updated_at();

create or replace function public.audit_movement_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
begin
  actor := auth.uid();

  if tg_op = 'INSERT' then
    insert into public.audit_log(entity_id, action, actor_id, new_data)
    values (new.id, 'INSERT', actor, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log(entity_id, action, actor_id, old_data, new_data)
    values (new.id, 'UPDATE', actor, to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log(entity_id, action, actor_id, old_data)
    values (old.id, 'DELETE', actor, to_jsonb(old));
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists movements_audit on public.movements;
create trigger movements_audit
after insert or update or delete on public.movements
for each row execute procedure public.audit_movement_changes();

-- ---------------------------------------------------------------------
-- RLS
-- Beta: todos los usuarios autenticados del proyecto son staff interno.
-- IMPORTANTE: desactivar altas públicas y crear solamente las 2 cuentas
-- desde Supabase Dashboard.
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.movements enable row level security;
alter table public.quote_snapshots enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "profiles authenticated read" on public.profiles;
create policy "profiles authenticated read"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "movements staff read" on public.movements;
create policy "movements staff read"
on public.movements for select
to authenticated
using (true);

drop policy if exists "movements staff insert" on public.movements;
create policy "movements staff insert"
on public.movements for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "movements staff update" on public.movements;
create policy "movements staff update"
on public.movements for update
to authenticated
using (true)
with check (true);

drop policy if exists "movements staff delete" on public.movements;
create policy "movements staff delete"
on public.movements for delete
to authenticated
using (true);

drop policy if exists "quotes staff read" on public.quote_snapshots;
create policy "quotes staff read"
on public.quote_snapshots for select
to authenticated
using (true);

drop policy if exists "quotes staff insert" on public.quote_snapshots;
create policy "quotes staff insert"
on public.quote_snapshots for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "audit staff read" on public.audit_log;
create policy "audit staff read"
on public.audit_log for select
to authenticated
using (true);

-- Privilegios Data API
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.movements to authenticated;
grant select, insert on public.quote_snapshots to authenticated;
grant select on public.audit_log to authenticated;
grant usage, select on sequence public.audit_log_id_seq to authenticated;

-- ---------------------------------------------------------------------
-- DATOS INICIALES / PASO MANUAL
-- ---------------------------------------------------------------------
-- Después de crear las cuentas de Auth, podés actualizar nombres:
--
-- update public.profiles
-- set full_name = 'Nahuel', role = 'owner'
-- where id = 'UUID-DEL-USUARIO';
--
-- update public.profiles
-- set full_name = 'Socio', role = 'admin'
-- where id = 'UUID-DEL-SOCIO';
