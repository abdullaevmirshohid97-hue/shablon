-- The Finance PIN becomes admin-issued.
--
-- 0008 gave each member a self-chosen 4-8 digit PIN; 0010 then bypassed it
-- entirely in favour of a photo picker + the employee's full login password.
-- Neither is what a shop floor wants: the account password is long and gets
-- typed on a shared screen, and a self-set PIN means the admin who hands out
-- the account cannot hand out the code that goes with it.
--
-- So: the admin sets it, and it widens to 4-10 characters of anything — a
-- word is easier to remember than eight digits and no less strong at this
-- length, because the PIN is a second factor behind an already-authenticated
-- session, not a primary credential.
--
-- What a PIN deliberately does NOT do is create a Supabase session. It can
-- only confirm the person already signed in, so verify_finance_pin stays
-- hard-scoped to auth.uid(). Signing in AS someone else still requires that
-- person's password — that is what keeps the audit log honest about who
-- entered a row.
--
-- Re-runnable, same as 0014-0019.

alter table memberships add column if not exists finance_pin_hash text;

-- ---------------------------------------------------------------------
-- Shared validation, so the rule lives in one place.
-- ---------------------------------------------------------------------
create or replace function assert_valid_finance_pin(pin text)
returns void
language plpgsql
immutable
set search_path = public
as $$
begin
  if pin is null or length(pin) < 4 or length(pin) > 10 then
    raise exception 'PIN 4 tadan 10 tagacha belgidan iborat bo''lishi kerak';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Admin issues (or changes) another member's PIN.
--
-- pgcrypto lives in the `extensions` schema on Supabase, so crypt()/gen_salt()
-- are only resolvable with it on the search path — see 0008.
-- ---------------------------------------------------------------------
create or replace function admin_set_finance_pin(
  target_org_id uuid,
  target_user_id uuid,
  pin text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not is_org_admin(target_org_id) then
    raise exception 'faqat egasi yoki admin PIN o''rnata oladi';
  end if;

  perform assert_valid_finance_pin(pin);

  update memberships
  set finance_pin_hash = crypt(pin, gen_salt('bf'))
  where org_id = target_org_id and user_id = target_user_id;

  if not found then
    raise exception 'bu xodim tashkilot a''zosi emas';
  end if;
end;
$$;

-- Admin removes a PIN — that member then falls back to their login password
-- at the Finance gate rather than being locked out.
create or replace function admin_clear_finance_pin(target_org_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not is_org_admin(target_org_id) then
    raise exception 'faqat egasi yoki admin PIN o''chira oladi';
  end if;

  update memberships
  set finance_pin_hash = null
  where org_id = target_org_id and user_id = target_user_id;

  if not found then
    raise exception 'bu xodim tashkilot a''zosi emas';
  end if;
end;
$$;

-- 0008's self-service setter, widened to the same 4-10 rule so an employee
-- can change the code they were given without an admin round-trip.
create or replace function set_finance_pin(target_org_id uuid, pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform assert_valid_finance_pin(pin);

  update memberships
  set finance_pin_hash = crypt(pin, gen_salt('bf'))
  where org_id = target_org_id and user_id = auth.uid();

  if not found then
    raise exception 'bu tashkilot a''zosi emassiz';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Verification. Scoped to auth.uid() by construction: there is no
-- target_user_id parameter, so no amount of client-side tampering can check
-- a PIN against anyone but the caller's own membership row.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- The admin directory gains a "has a PIN" flag so Settings can show at a
-- glance who still needs one. Admin-only (is_org_admin in the where), so
-- this exposes nothing to staff. Only the boolean travels — never the hash.
-- ---------------------------------------------------------------------
drop function if exists list_org_members(uuid);

create function list_org_members(target_org_id uuid)
returns table (
  user_id uuid,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  role org_role,
  has_finance_pin boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    m.user_id, u.email, p.full_name, p.phone, p.avatar_url, m.role,
    m.finance_pin_hash is not null as has_finance_pin,
    m.created_at
  from memberships m
  join auth.users u on u.id = m.user_id
  left join profiles p on p.id = m.user_id
  where m.org_id = target_org_id and is_org_admin(target_org_id)
  order by m.created_at asc;
$$;
