-- Explicit "modules" (business categories): each becomes a sidebar link and
-- a scoped dashboard view, matching the existing category-derived behavior
-- but now manageable (create/rename/delete) instead of only implied by
-- whatever tags happen to be on counterparties.

create table modules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

alter table modules enable row level security;

create policy modules_select on modules
  for select using (is_org_member(org_id));
create policy modules_write on modules
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- Renaming/deleting a module must cascade into counterparties.categories
-- (a plain text[] tag list) so every counterparty tagged with it stays in
-- sync. security definer + an explicit is_org_admin check, since this
-- bypasses RLS to update rows the caller doesn't directly own the tag on.
create function rename_module_category(target_org_id uuid, old_name text, new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_org_admin(target_org_id) then
    raise exception 'not authorized';
  end if;

  update counterparties
  set categories = array_replace(categories, old_name, new_name)
  where org_id = target_org_id and old_name = any(categories);
end;
$$;

create function remove_module_category(target_org_id uuid, name_to_remove text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_org_admin(target_org_id) then
    raise exception 'not authorized';
  end if;

  update counterparties
  set categories = array_remove(categories, name_to_remove)
  where org_id = target_org_id and name_to_remove = any(categories);
end;
$$;

-- Backfill: any category tag already in use becomes a real module row.
insert into modules (org_id, name)
select distinct org_id, unnest(categories) as name
from counterparties
where categories is not null and array_length(categories, 1) > 0
on conflict (org_id, name) do nothing;
