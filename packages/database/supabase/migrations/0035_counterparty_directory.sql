-- The client register as a register: one screen, and a rule about closing an
-- account.
--
-- 0034 would only delete a client nothing pointed at, which in practice meant
-- only a client created by mistake five minutes earlier. That is not the case
-- anybody actually has. The case is a client who traded for a year, settled
-- everything, and should now leave the list — and 0034 refused them, because it
-- counted entries rather than asking what the entries came to.
--
-- So the rule becomes the one the business uses: an account that is square can
-- be closed. Not "no history" — no balance. A client who owes nothing and is
-- owed nothing has nothing outstanding, and removing them removes a settled
-- account, which is what closing an account means.
--
-- Three things follow from that, and each is deliberate:
--
--   * The test is the NET balance, not total_debt. total_debt is clamped at
--     zero (0032), so a client the company owes five million reads as "0 qarz"
--     and would otherwise be deletable — erasing an obligation, in the one
--     direction nobody would check. Square means square: both ways.
--
--   * Their entries go with them. There is no such thing as a ledger entry
--     belonging to a client who no longer exists, and 0014's guard has to be
--     let past for this one operation. The escape is a transaction-local flag
--     set only by delete_counterparty, after it has checked the balance —
--     the same shape 0014 already uses for status changes. transaction_audit
--     is deliberately not a foreign key (0013), so the deletion still leaves
--     its trail behind.
--
--   * Warehouse and sales documents still block it. An order, a movement, an
--     invoice or a despatch is another module's paper about a physical thing
--     that happened, and Finance does not get to destroy it to tidy a list.
--     Those refuse by name, exactly as 0034 did.
--
-- Re-runnable: create or replace throughout.


-- ---------------------------------------------------------------------
-- 0014's guard, with one door.
--
-- Unchanged in every other respect: a posted entry is still cancelled by an
-- opposite entry and never erased. What is allowed now is removing the entries
-- of a client being closed, which is not an edit to the ledger — it is the
-- ledger losing an account that came to nothing.
-- ---------------------------------------------------------------------
create or replace function prevent_posted_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Tenant offboarding: deleting the organization itself cascades through
  -- everything and must not be blocked. The parent row is already gone by
  -- the time the cascade reaches here, which is how we recognise it.
  if not exists (select 1 from organizations where id = old.org_id) then
    return old;
  end if;

  -- Closing a settled client. Set only inside delete_counterparty, only after
  -- the balance has been checked, and only for the life of that transaction —
  -- there is no way to turn it on from the app.
  if coalesce(current_setting('app.counterparty_purge', true), '') = 'on' then
    return old;
  end if;

  if old.status <> 'draft' then
    raise exception
      'a posted entry cannot be deleted (document %) — reverse it instead',
      coalesce(old.document_no, old.id::text)
      using errcode = 'restrict_violation';
  end if;

  return old;
end;
$$;


-- ---------------------------------------------------------------------
-- The register itself: everyone, with what they turned over in the period and
-- where their account stands.
--
-- Turnover is the period's gross movement — everything that went through the
-- receivable in both directions — because "how much business did we do with
-- them" is a different question from "what do they owe", and the screen is
-- there to ask both at once. The balance ignores the period on purpose: an
-- account is square or it is not, whatever window happens to be selected.
-- ---------------------------------------------------------------------
create or replace function counterparty_directory(
  target_org_id uuid,
  p_start date default null,
  p_end date default null
)
returns table (
  counterparty_id uuid,
  counterparty_name text,
  phone text,
  manager_id uuid,
  manager_name text,
  currency text,
  categories text[],
  turnover numeric,
  entry_count bigint,
  balance numeric,
  total_debt numeric,
  doc_count bigint
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with ledger as (
    select
      t.counterparty_id,
      t.occurred_at,
      case when da.type = 'receivable' then t.base_debit_amount else 0 end as debit,
      case when ca.type = 'receivable' then t.base_credit_amount else 0 end as credit
    from transactions t
    join accounts da on da.id = t.debit_account_id
    join accounts ca on ca.id = t.credit_account_id
    where t.org_id = target_org_id
      and t.status <> 'draft'
      and (da.type = 'receivable' or ca.type = 'receivable')
  ),
  agg as (
    select
      c.id,
      coalesce(sum(l.debit - l.credit), 0) as balance,
      coalesce(
        sum(l.debit + l.credit) filter (
          where (p_start is null or l.occurred_at >= p_start)
            and (p_end is null or l.occurred_at < p_end + 1)
        ),
        0
      ) as turnover,
      count(l.*) filter (
        where (p_start is null or l.occurred_at >= p_start)
          and (p_end is null or l.occurred_at < p_end + 1)
      ) as entry_count
    from counterparties c
    left join ledger l on l.counterparty_id = c.id
    where c.org_id = target_org_id
    group by c.id
  )
  select
    c.id,
    c.name,
    c.phone,
    c.manager_id,
    coalesce(p.full_name, u.email),
    coalesce(c.currency, o.base_currency, 'UZS'),
    c.categories,
    round(a.turnover, 2),
    a.entry_count,
    round(a.balance, 2),
    round(greatest(a.balance, 0), 2),
    (
      (select count(*) from sklad_orders x where x.counterparty_id = c.id)
      + (select count(*) from sklad_movements x where x.counterparty_id = c.id)
      + (select count(*) from sklad_invoices x where x.counterparty_id = c.id)
      + (select count(*) from sklad_shipments x where x.counterparty_id = c.id)
    )::bigint
  from counterparties c
  join agg a on a.id = c.id
  join organizations o on o.id = c.org_id
  left join auth.users u on u.id = c.manager_id
  left join profiles p on p.id = c.manager_id
  where c.org_id = target_org_id
    and is_org_member(target_org_id)
  order by c.name;
$$;


-- ---------------------------------------------------------------------
-- Closing an account.
--
-- Re-counts everything itself rather than trusting what the screen was
-- showing, because the screen was drawn before the last invoice was.
-- ---------------------------------------------------------------------
create or replace function delete_counterparty(target_org_id uuid, target_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_balance numeric;
  v_docs bigint;
  blockers text[] := '{}';
  r record;
begin
  if not can_write_finance(target_org_id) then
    raise exception 'not authorized';
  end if;

  if not exists (
    select 1 from counterparties where id = target_id and org_id = target_org_id
  ) then
    raise exception 'Mijoz topilmadi';
  end if;

  select d.balance, d.doc_count
  into v_balance, v_docs
  from counterparty_directory(target_org_id) d
  where d.counterparty_id = target_id;

  -- Both directions. A company that owes its client is no more free to erase
  -- the account than a client who owes the company.
  if abs(coalesce(v_balance, 0)) >= 0.01 then
    raise exception
      'Hisob yopilmagan: qoldiq %. Avval hisob-kitob qilinsin.',
      trim(to_char(v_balance, 'FM999999999990.00'));
  end if;

  if coalesce(v_docs, 0) > 0 then
    for r in
      select entity, ref_count
      from counterparty_references(target_org_id, target_id)
      where ref_count > 0 and entity <> 'tranzaksiya'
    loop
      blockers := blockers || format('%s ta %s', r.ref_count, r.entity);
    end loop;

    raise exception
      'Bu mijozni o''chirib bo''lmaydi — unga bog''liq hujjatlar bor: %.',
      array_to_string(blockers, ', ');
  end if;

  -- Settled, and nothing outside Finance points at them. The flag lives for
  -- this transaction only and nothing else can set it.
  perform set_config('app.counterparty_purge', 'on', true);
  delete from transactions where org_id = target_org_id and counterparty_id = target_id;
  delete from counterparties where id = target_id and org_id = target_org_id;
end;
$$;
