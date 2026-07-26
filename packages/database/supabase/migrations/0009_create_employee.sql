-- Lets an org owner/admin create a new employee account (email + password)
-- directly from the app, without the Supabase Admin API / service_role key.
-- Mirrors the exact auth.users + auth.identities insert already proven to
-- work in demo_login.sql: the four empty-string token columns avoid
-- GoTrue's "Database error querying schema" 500 on NULL tokens, and the
-- identities row is required for password login to work.

create function create_employee(
  target_org_id uuid,
  p_email text,
  p_password text,
  p_full_name text default null,
  p_phone text default null,
  p_role org_role default 'staff'
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
begin
  if not is_org_admin(target_org_id) then
    raise exception 'only an org owner/admin can create employees';
  end if;

  if p_role not in ('admin', 'staff') then
    raise exception 'role must be admin or staff';
  end if;

  if p_password !~ '^.{6,72}$' then
    raise exception 'password must be at least 6 characters';
  end if;

  if exists (select 1 from auth.users where lower(email) = lower(p_email)) then
    raise exception 'a user with this email already exists';
  end if;

  v_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    phone
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id, 'authenticated', 'authenticated', p_email,
    crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name),
    '', '', '', '',
    p_phone
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_user_id, v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', p_email),
    'email', now(), now(), now()
  );

  -- handle_new_user (0001_init.sql) auto-creates the profiles row from
  -- raw_user_meta_data ->> 'full_name'; it doesn't set phone, so back-fill it.
  update profiles set phone = p_phone where id = v_user_id;

  insert into memberships (org_id, user_id, role) values (target_org_id, v_user_id, p_role);

  return v_user_id;
end;
$$;

-- Employee directory for the org-settings screen — admin-only (silently
-- empty for non-admins, mirroring RLS-style behavior rather than erroring).
create function list_org_members(target_org_id uuid)
returns table (
  user_id uuid,
  email text,
  full_name text,
  phone text,
  role org_role,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select m.user_id, u.email, p.full_name, p.phone, m.role, m.created_at
  from memberships m
  join auth.users u on u.id = m.user_id
  left join profiles p on p.id = m.user_id
  where m.org_id = target_org_id and is_org_admin(target_org_id)
  order by m.created_at asc;
$$;
