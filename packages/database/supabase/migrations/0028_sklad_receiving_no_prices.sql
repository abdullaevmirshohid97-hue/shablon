-- Receiving stops carrying money.
--
-- The receiving grid had three price columns on it, admin-only, and the RPC
-- behind it wrote them onto the batch. That put a valuation on goods at the
-- moment they arrived — before anyone had decided what they would be sold for,
-- and by a storekeeper who has no reason to know.
--
-- Price now belongs to the sales invoice (0027), where a manager sets it while
-- selling. Receiving records what came in: what it is, how much of it, and how
-- heavy. Nothing else.
--
-- sklad_batch_prices stays. It is still the place a batch's valuation lives,
-- still admin-only, and still written from the single-batch form — this
-- migration only takes the bulk receiving path out of the money business.
--
-- Re-runnable, same as 0014-0027.

create or replace function sklad_receive_rows(
  target_org_id uuid,
  p_rows jsonb,
  p_order_id uuid default null,
  p_received_at date default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_received date := coalesce(p_received_at, current_date);
  v_item uuid;
  v_kod text;
  v_name text;
  v_type uuid;
  v_yarn uuid;
  v_sort uuid;
  v_color uuid;
  v_pantone uuid;
  v_gsm numeric;
  v_width numeric;
  v_length numeric;
  v_count integer := 0;
begin
  -- Still SECURITY DEFINER, and still checked by hand: the point of the
  -- elevated rights is to let a storekeeper create a colour or a yarn count
  -- they have just typed, which sklad_lookups otherwise reserves for admins.
  -- With prices gone there is nothing else here worth guarding.
  if not is_org_member(target_org_id) then
    raise exception 'Ruxsat yo''q';
  end if;

  if p_order_id is not null and not exists (
    select 1 from sklad_orders where id = p_order_id and org_id = target_org_id
  ) then
    raise exception 'Buyurtma topilmadi';
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_kod := nullif(btrim(coalesce(r ->> 'kod', '')), '');
    v_name := nullif(btrim(coalesce(r ->> 'name', '')), '');
    v_gsm := nullif(r ->> 'gsm', '')::numeric;
    v_width := nullif(r ->> 'width', '')::numeric;
    v_length := nullif(r ->> 'length', '')::numeric;

    v_type := sklad_lookup_id(target_org_id, 'mahsulot_turi', r ->> 'productType');
    v_yarn := sklad_lookup_id(target_org_id, 'ip_turi', r ->> 'yarnType');
    v_sort := sklad_lookup_id(target_org_id, 'sort', r ->> 'sort');
    v_color := sklad_lookup_id(target_org_id, 'rang', r ->> 'color');
    v_pantone := sklad_lookup_id(target_org_id, 'pantone', r ->> 'pantone');

    if v_name is null and v_kod is null and v_type is null then
      continue;
    end if;

    if v_name is null then
      v_name := btrim(
        coalesce((select name from sklad_lookups where id = v_type), '') || ' ' ||
        coalesce(sklad_size_text(v_width, v_length), '')
      );
      if v_name = '' then v_name := coalesce(v_kod, '—'); end if;
    end if;

    v_item := null;

    if v_kod is not null then
      select id into v_item
      from sklad_items where org_id = target_org_id and kod = v_kod;
    else
      select id into v_item
      from sklad_items
      where org_id = target_org_id
        and lower(name) = lower(v_name)
        and product_type_id is not distinct from v_type
        and color_id is not distinct from v_color
        and sort_id is not distinct from v_sort
        and gsm is not distinct from v_gsm
        and width_cm is not distinct from v_width
        and length_cm is not distinct from v_length
      limit 1;
    end if;

    if v_item is null then
      insert into sklad_items (
        org_id, kod, name, product_type_id, yarn_type_id, gsm,
        width_cm, length_cm, sort_id, color_id, pantone_id
      )
      values (
        target_org_id, v_kod, v_name, v_type, v_yarn, v_gsm,
        v_width, v_length, v_sort, v_color, v_pantone
      )
      returning id into v_item;
    end if;

    insert into sklad_batches (
      org_id, item_id, order_id, brutto_kg, netto_kg, dona_soni, nabor_soni,
      qop_soni, omborga_kirgan_sana, ishlab_chiqarilgan_sana, notes
    )
    values (
      target_org_id, v_item, p_order_id,
      nullif(r ->> 'brutto', '')::numeric,
      nullif(r ->> 'netto', '')::numeric,
      nullif(r ->> 'dona', '')::integer,
      nullif(r ->> 'nabor', '')::integer,
      nullif(r ->> 'qop', '')::integer,
      v_received,
      nullif(r ->> 'producedAt', '')::date,
      nullif(btrim(coalesce(r ->> 'notes', '')), '')
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
