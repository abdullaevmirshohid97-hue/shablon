-- Employee editing (name/phone/photo/password) + a name+photo roster picker
-- for the Finance entry screen. The roster is intentionally readable by any
-- org member (not just admins) — everyone needs to find their own tile —
-- while editing another employee's profile or password stays admin-only,
-- same SECURITY DEFINER + is_org_admin() pattern as 0008/0009.

alter table profiles add column if not exists avatar_url text;

-- Public bucket: profile photos aren't sensitive, and the picker needs to
-- show them before anyone has "confirmed" who they are.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects
  for all using (bucket_id = 'avatars' and auth.role() = 'authenticated')
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- Admin-only: edit another member's name/phone/photo.
create function update_employee(
  target_org_id uuid,
  target_user_id uuid,
  p_full_name text default null,
  p_phone text default null,
  p_avatar_url text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not is_org_admin(target_org_id) then
    raise exception 'only an org owner/admin can edit employees';
  end if;

  if not exists (
    select 1 from memberships
    where org_id = target_org_id and user_id = target_user_id
  ) then
    raise exception 'not a member of this organization';
  end if;

  update profiles
  set full_name = p_full_name, phone = p_phone, avatar_url = p_avatar_url
  where id = target_user_id;
end;
$$;

-- Admin-only: reset another member's login password.
create function reset_employee_password(target_org_id uuid, target_user_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not is_org_admin(target_org_id) then
    raise exception 'only an org owner/admin can reset a password';
  end if;

  if p_password !~ '^.{6,72}$' then
    raise exception 'password must be at least 6 characters';
  end if;

  update auth.users
  set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now()
  where id = target_user_id
    and exists (
      select 1 from memberships
      where org_id = target_org_id and user_id = target_user_id
    );

  if not found then
    raise exception 'not a member of this organization';
  end if;
end;
$$;

-- Any org member (not just admins) — the "who are you" picker on Finance
-- entry needs to list everyone so each employee can find their own tile.
create function list_org_roster(target_org_id uuid)
returns table (
  user_id uuid,
  full_name text,
  email text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select m.user_id, p.full_name, u.email, p.avatar_url
  from memberships m
  join auth.users u on u.id = m.user_id
  left join profiles p on p.id = m.user_id
  where m.org_id = target_org_id and is_org_member(target_org_id)
  order by p.full_name asc nulls last;
$$;

-- Widen the admin-only directory (0009) with the photo, for the Settings table.
drop function if exists list_org_members(uuid);

create function list_org_members(target_org_id uuid)
returns table (
  user_id uuid,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  role org_role,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select m.user_id, u.email, p.full_name, p.phone, p.avatar_url, m.role, m.created_at
  from memberships m
  join auth.users u on u.id = m.user_id
  left join profiles p on p.id = m.user_id
  where m.org_id = target_org_id and is_org_admin(target_org_id)
  order by m.created_at asc;
$$;
