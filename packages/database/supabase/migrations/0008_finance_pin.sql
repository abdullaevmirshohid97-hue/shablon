-- Per-employee PIN gate for the Finance module. Each membership row can hold
-- its own bcrypt PIN hash; the PIN is never sent to the client, only the
-- entered code (verified server-side via pgcrypto's crypt()).
--
-- memberships_write (0001_init.sql) requires is_org_admin(), which would
-- lock plain 'staff' members out of setting/checking their own PIN, so both
-- operations run as SECURITY DEFINER, hard-scoped to auth.uid()'s own row —
-- nobody can set or verify another member's PIN through these functions.
--
-- Supabase installs pgcrypto into the `extensions` schema, not `public`, so
-- crypt()/gen_salt() are only resolvable if that schema is on the search
-- path — hence `set search_path = public, extensions` below (plain
-- `= public` 42883-errors on crypt() not existing).

alter table memberships add column if not exists finance_pin_hash text;

create or replace function set_finance_pin(target_org_id uuid, pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if pin !~ '^[0-9]{4,8}$' then
    raise exception 'PIN must be 4-8 digits';
  end if;

  update memberships
  set finance_pin_hash = crypt(pin, gen_salt('bf'))
  where org_id = target_org_id and user_id = auth.uid();

  if not found then
    raise exception 'not a member of this organization';
  end if;
end;
$$;

create or replace function verify_finance_pin(target_org_id uuid, pin text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    (select finance_pin_hash = crypt(pin, finance_pin_hash)
     from memberships
     where org_id = target_org_id and user_id = auth.uid() and finance_pin_hash is not null),
    false
  );
$$;

create or replace function has_finance_pin(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    (select finance_pin_hash is not null
     from memberships
     where org_id = target_org_id and user_id = auth.uid()),
    false
  );
$$;
