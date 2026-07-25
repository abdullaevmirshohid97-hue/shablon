-- Fixes an onboarding dead-end: `organizations_insert` lets any authenticated
-- user create an org, but `memberships_write` requires is_org_admin(), so the
-- creator could never add themselves as a member and would be locked out of
-- their own org. This trigger makes the creating user the org owner
-- automatically, so a fresh signup can bootstrap without service-role access.
--
-- When an org is created outside a user session (e.g. seed scripts running as
-- the postgres role) auth.uid() is null; in that case we skip and let the
-- script insert the membership itself.

create or replace function add_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    insert into memberships (org_id, user_id, role)
    values (new.id, auth.uid(), 'owner')
    on conflict (org_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_organization_created
  after insert on organizations
  for each row execute function add_creator_as_owner();
