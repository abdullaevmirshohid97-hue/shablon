-- Mubosher SaaS: initial schema
-- Multi-tenant ledger: organizations -> counterparties -> transactions
-- Mirrors the paper/1C ledger structure (Дебет/Кредит/Текущее сальдо)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type platform_role as enum ('user', 'platform_admin');
create type org_role as enum ('owner', 'admin', 'staff');
create type account_type as enum ('receivable', 'cash', 'sales', 'inventory', 'other');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');

-- ---------------------------------------------------------------------
-- profiles: one row per auth.users, holds platform-wide role
-- ---------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  role_platform platform_role not null default 'user',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- organizations: subscribing tenant businesses
-- ---------------------------------------------------------------------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  base_currency text not null default 'UZS',
  subscription_status subscription_status not null default 'trialing',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- memberships: user <-> organization, with role
-- ---------------------------------------------------------------------
create table memberships (
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role org_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- ---------------------------------------------------------------------
-- counterparties: kontragentlar (e.g. "Мубошер" brokers/customers)
-- ---------------------------------------------------------------------
create table counterparties (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  phone text,
  categories text[] not null default '{}',
  notes text,
  currency text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- accounts: dynamic chart of accounts per org (Клиенты/Касса/Продажи/Склад)
-- ---------------------------------------------------------------------
create table accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  code text not null,
  name text not null,
  type account_type not null,
  created_at timestamptz not null default now(),
  unique (org_id, code)
);

-- ---------------------------------------------------------------------
-- transaction_categories: e.g. "kg sotuv", "naqd to'lov", "ombor chiqimi"
-- ---------------------------------------------------------------------
create table transaction_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  unit text,
  default_debit_account_id uuid references accounts (id),
  default_credit_account_id uuid references accounts (id),
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

-- ---------------------------------------------------------------------
-- transactions: the ledger entries themselves
-- ---------------------------------------------------------------------
create table transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  counterparty_id uuid not null references counterparties (id) on delete cascade,
  category_id uuid references transaction_categories (id),
  occurred_at timestamptz not null default now(),
  description text,
  quantity numeric,
  unit text,
  debit_account_id uuid not null references accounts (id),
  debit_amount numeric(14, 2) not null check (debit_amount >= 0),
  credit_account_id uuid not null references accounts (id),
  credit_amount numeric(14, 2) not null check (credit_amount >= 0),
  currency text not null,
  created_by uuid references auth.users (id),
  client_local_id uuid unique,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index transactions_org_counterparty_occurred_idx
  on transactions (org_id, counterparty_id, occurred_at, created_at);

-- ---------------------------------------------------------------------
-- Helper functions for RLS
-- ---------------------------------------------------------------------
create function is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role_platform = 'platform_admin'
  );
$$;

create function is_org_member(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where org_id = target_org_id and user_id = auth.uid()
  ) or is_platform_admin();
$$;

create function is_org_admin(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where org_id = target_org_id and user_id = auth.uid() and role in ('owner', 'admin')
  ) or is_platform_admin();
$$;

-- Auto-create profile row on signup
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
-- Running balance function: mirrors "Текущее сальдо" (Д/К) from the paper ledger
-- ---------------------------------------------------------------------
create function counterparty_running_balance(target_counterparty_id uuid)
returns table (
  transaction_id uuid,
  occurred_at timestamptz,
  running_balance numeric,
  balance_side text
)
language sql
stable
as $$
  select
    t.id,
    t.occurred_at,
    sum(
      case when da.type = 'receivable' then t.debit_amount else 0 end
      - case when ca.type = 'receivable' then t.credit_amount else 0 end
    ) over (order by t.occurred_at, t.created_at) as running_balance,
    case
      when sum(
        case when da.type = 'receivable' then t.debit_amount else 0 end
        - case when ca.type = 'receivable' then t.credit_amount else 0 end
      ) over (order by t.occurred_at, t.created_at) >= 0 then 'debit'
      else 'credit'
    end as balance_side
  from transactions t
  join accounts da on da.id = t.debit_account_id
  join accounts ca on ca.id = t.credit_account_id
  where t.counterparty_id = target_counterparty_id
  order by t.occurred_at, t.created_at;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table profiles enable row level security;
alter table organizations enable row level security;
alter table memberships enable row level security;
alter table counterparties enable row level security;
alter table accounts enable row level security;
alter table transaction_categories enable row level security;
alter table transactions enable row level security;

-- profiles: users see/edit their own profile; platform admins see all
create policy profiles_select on profiles
  for select using (id = auth.uid() or is_platform_admin());
create policy profiles_update_self on profiles
  for update using (id = auth.uid());

-- organizations: members and platform admins can see; only platform admin or owner can update
create policy organizations_select on organizations
  for select using (is_org_member(id));
create policy organizations_insert on organizations
  for insert with check (auth.uid() is not null);
create policy organizations_update on organizations
  for update using (is_org_admin(id) or is_platform_admin());

-- memberships
create policy memberships_select on memberships
  for select using (is_org_member(org_id));
create policy memberships_write on memberships
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- counterparties
create policy counterparties_select on counterparties
  for select using (is_org_member(org_id));
create policy counterparties_write on counterparties
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

-- accounts
create policy accounts_select on accounts
  for select using (is_org_member(org_id));
create policy accounts_write on accounts
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- transaction_categories
create policy transaction_categories_select on transaction_categories
  for select using (is_org_member(org_id));
create policy transaction_categories_write on transaction_categories
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- transactions
create policy transactions_select on transactions
  for select using (is_org_member(org_id));
create policy transactions_insert on transactions
  for insert with check (is_org_member(org_id));
create policy transactions_update on transactions
  for update using (is_org_admin(org_id));
create policy transactions_delete on transactions
  for delete using (is_org_admin(org_id));

-- ---------------------------------------------------------------------
-- Realtime: broadcast changes on transactions so web dashboard updates live
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table transactions;
