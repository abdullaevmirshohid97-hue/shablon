import { one } from '@mubosher/shared';
import type {
  LedgerTransaction,
  Counterparty,
  TransactionCategory,
  Module,
  AccountType,
  SkladLookup,
  SkladItem,
  SkladOrder,
  SkladBatch,
  SkladBatchPrice,
  SkladBatchRow,
  SkladMovement,
  SkladStockRow,
  SkladAuditEntry,
  SkladStage,
  SkladOrderLine,
  SkladShipment,
} from '@mubosher/shared';
import type { Database } from './database.types';

type TransactionRow = Database['public']['Tables']['transactions']['Row'];
type CounterpartyRow = Database['public']['Tables']['counterparties']['Row'];
type AccountRow = Database['public']['Tables']['accounts']['Row'];
type CategoryRow = Database['public']['Tables']['transaction_categories']['Row'];
type ModuleRow = Database['public']['Tables']['modules']['Row'];
type SkladLookupRow = Database['public']['Tables']['sklad_lookups']['Row'];
type SkladItemRow = Database['public']['Tables']['sklad_items']['Row'];
type SkladOrderRow = Database['public']['Tables']['sklad_orders']['Row'];
// Named for the table, to leave `SkladBatchRow` meaning the flattened list row
// that sklad_batch_page returns (see @mubosher/shared).
type SkladBatchTableRow = Database['public']['Tables']['sklad_batches']['Row'];
type SkladBatchPriceRow = Database['public']['Tables']['sklad_batch_prices']['Row'];
type SkladBatchPageRow = Database['public']['Functions']['sklad_batch_page']['Returns'][number];
type SkladMovementRow = Database['public']['Functions']['list_sklad_movements']['Returns'][number];
type SkladStockRpcRow = Database['public']['Functions']['sklad_stock_by_item']['Returns'][number];
type SkladAuditRow = Database['public']['Functions']['list_sklad_audit']['Returns'][number];
type SkladStageRow = Database['public']['Tables']['sklad_stages']['Row'];
type SkladOrderLineRow = Database['public']['Tables']['sklad_order_lines']['Row'];
type SkladShipmentRow = Database['public']['Tables']['sklad_shipments']['Row'];

export function toModule(row: ModuleRow): Module {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    createdAt: row.created_at,
  };
}

export function toCounterparty(row: CounterpartyRow): Counterparty {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    phone: row.phone,
    categories: row.categories,
    notes: row.notes,
    currency: row.currency,
    managerId: row.manager_id,
    createdAt: row.created_at,
  };
}

export function toTransactionCategory(row: CategoryRow): TransactionCategory {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    unit: row.unit,
    defaultDebitAccountId: row.default_debit_account_id,
    defaultCreditAccountId: row.default_credit_account_id,
  };
}

export function toSkladLookup(row: SkladLookupRow): SkladLookup {
  return {
    id: row.id,
    orgId: row.org_id,
    kind: row.kind,
    name: row.name,
    createdAt: row.created_at,
  };
}

export function toSkladItem(row: SkladItemRow): SkladItem {
  return {
    id: row.id,
    orgId: row.org_id,
    kod: row.kod,
    name: row.name,
    productTypeId: row.product_type_id,
    yarnTypeId: row.yarn_type_id,
    gsm: row.gsm,
    widthCm: num(row.width_cm),
    lengthCm: num(row.length_cm),
    sortId: row.sort_id,
    colorId: row.color_id,
    pantoneId: row.pantone_id,
    createdAt: row.created_at,
  };
}

export function toSkladStage(row: SkladStageRow): SkladStage {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    position: row.position,
    isFinal: row.is_final,
  };
}

export function toSkladOrderLine(row: SkladOrderLineRow): SkladOrderLine {
  return {
    id: row.id,
    orgId: row.org_id,
    orderId: row.order_id,
    itemId: row.item_id,
    position: row.position,
    description: row.description,
    sizeText: row.size_text,
    colorText: row.color_text,
    plannedDona: row.planned_dona,
    plannedKg: row.planned_kg == null ? null : Number(row.planned_kg),
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function toSkladShipment(row: SkladShipmentRow): SkladShipment {
  return {
    id: row.id,
    orgId: row.org_id,
    orderId: row.order_id,
    counterpartyId: row.counterparty_id,
    managerId: row.manager_id,
    documentNo: row.document_no,
    shippedAt: row.shipped_at,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function toSkladOrder(row: SkladOrderRow): SkladOrder {
  return {
    id: row.id,
    orgId: row.org_id,
    orderNo: row.order_no,
    orderName: row.order_name,
    counterpartyId: row.counterparty_id,
    managerId: row.manager_id,
    deadline: row.deadline,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function toSkladBatchPrice(row: SkladBatchPriceRow): SkladBatchPrice {
  return {
    batchId: row.batch_id,
    orgId: row.org_id,
    pricePerKg: row.price_per_kg,
    pricePerPiece: row.price_per_piece,
    pricePerSet: row.price_per_set,
    totalAmount: row.total_amount,
    purchaseCost: row.purchase_cost,
    profitPercent: row.profit_percent,
    profitAmount: row.profit_amount,
    currency: row.currency,
  };
}

/** Row shape from useSkladBatches' embedded select (item/order/counterparty/price joined in
 * one query). The nested relations are *declared* as arrays because this hand-maintained type
 * file carries no Relationships metadata for supabase-js to infer cardinality from; PostgREST
 * actually sends an object for each of them, which is why they are read through `one()`. */
export type SkladBatchEmbeddedRow = SkladBatchTableRow & {
  sklad_items: { name: string; kod: string | null }[] | null;
  sklad_orders:
    | {
        order_no: string | null;
        order_name: string | null;
        counterparties: { name: string }[] | null;
      }[]
    | null;
  sklad_batch_prices: SkladBatchPriceRow[] | null;
};

export function toSkladBatch(row: SkladBatchEmbeddedRow): SkladBatch {
  const item = one(row.sklad_items);
  const order = one(row.sklad_orders);
  const price = one(row.sklad_batch_prices);

  return {
    id: row.id,
    orgId: row.org_id,
    itemId: row.item_id,
    orderId: row.order_id,
    bruttoKg: row.brutto_kg,
    nettoKg: row.netto_kg,
    taraKg: row.tara_kg,
    donaSoni: row.dona_soni,
    naborSoni: row.nabor_soni,
    qopSoni: row.qop_soni,
    pieceWeightKg: row.piece_weight_kg,
    qoldiqDona: row.qoldiq_dona,
    ishlabChiqarilganSana: row.ishlab_chiqarilgan_sana,
    omborgaKirganSana: row.omborga_kirgan_sana,
    status: row.status,
    qcCheckedBy: row.qc_checked_by,
    qcCheckedAt: row.qc_checked_at,
    defectType: row.defect_type,
    defectQty: row.defect_qty,
    notes: row.notes,
    locationSector: row.location_sector,
    locationRow: row.location_row,
    locationRack: row.location_rack,
    locationShelf: row.location_shelf,
    createdAt: row.created_at,
    itemName: item?.name,
    itemKod: item?.kod ?? null,
    orderNo: order?.order_no ?? null,
    orderName: order?.order_name ?? null,
    counterpartyName: one(order?.counterparties)?.name ?? null,
    price: price ? toSkladBatchPrice(price) : null,
  };
}

/** Postgres numerics arrive as strings often enough to be worth centralising. */
function num(value: number | string | null | undefined): number | null {
  return value == null ? null : Number(value);
}

/**
 * One row of sklad_batch_page (0023).
 *
 * The price block is assembled only when at least one price figure came back.
 * For staff every one of them is null — not because this function hides them,
 * but because the RPC runs with the caller's rights and sklad_batch_prices has
 * no member SELECT policy — and a `price: null` says that more honestly than
 * an object full of nulls would.
 */
export function toSkladBatchRow(row: SkladBatchPageRow): SkladBatchRow {
  const hasPrice =
    row.price_per_kg != null ||
    row.price_per_piece != null ||
    row.price_per_set != null ||
    row.total_amount != null ||
    row.purchase_cost != null ||
    row.profit_percent != null ||
    row.profit_amount != null;

  return {
    id: row.id,
    itemId: row.item_id,
    orderId: row.order_id,
    kod: row.kod,
    itemName: row.item_name,
    productType: row.product_type,
    yarnType: row.yarn_type,
    widthCm: num(row.width_cm),
    lengthCm: num(row.length_cm),
    sortName: row.sort_name,
    colorName: row.color_name,
    pantoneCode: row.pantone_code,
    gsm: num(row.gsm),
    bruttoKg: num(row.brutto_kg),
    nettoKg: num(row.netto_kg),
    taraKg: num(row.tara_kg),
    pieceWeightKg: num(row.piece_weight_kg),
    donaSoni: row.dona_soni,
    naborSoni: row.nabor_soni,
    qopSoni: row.qop_soni,
    qoldiqDona: row.qoldiq_dona,
    qoldiqKg: num(row.qoldiq_kg),
    ishlabChiqarilganSana: row.ishlab_chiqarilgan_sana,
    omborgaKirganSana: row.omborga_kirgan_sana,
    status: row.status,
    orderNo: row.order_no,
    orderName: row.order_name,
    counterpartyName: row.counterparty_name,
    defectType: row.defect_type,
    defectQty: row.defect_qty,
    notes: row.notes,
    locationSector: row.location_sector,
    locationRow: row.location_row,
    locationRack: row.location_rack,
    locationShelf: row.location_shelf,
    createdAt: row.created_at,
    price: hasPrice
      ? {
          batchId: row.id,
          pricePerKg: num(row.price_per_kg),
          pricePerPiece: num(row.price_per_piece),
          pricePerSet: num(row.price_per_set),
          totalAmount: num(row.total_amount),
          purchaseCost: num(row.purchase_cost),
          profitPercent: num(row.profit_percent),
          profitAmount: num(row.profit_amount),
          currency: row.currency ?? 'UZS',
        }
      : null,
  };
}

export function toSkladMovement(row: SkladMovementRow): SkladMovement {
  return {
    id: row.id,
    kind: row.kind,
    dona: Number(row.dona),
    kg: num(row.kg),
    occurredAt: row.occurred_at,
    counterpartyName: row.counterparty_name,
    orderNo: row.order_no,
    note: row.note,
    isInitial: row.is_initial,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
  };
}

export function toSkladStockRow(row: SkladStockRpcRow): SkladStockRow {
  return {
    itemId: row.item_id,
    kod: row.kod,
    itemName: row.item_name,
    productType: row.product_type,
    widthCm: num(row.width_cm),
    lengthCm: num(row.length_cm),
    colorName: row.color_name,
    batchCount: Number(row.batch_count),
    totalDona: Number(row.total_dona),
    totalKg: Number(row.total_kg),
    stockValue: num(row.stock_value),
  };
}

export function toSkladAuditEntry(row: SkladAuditRow): SkladAuditEntry {
  return {
    id: row.id,
    entity: row.entity,
    entityId: row.entity_id,
    action: row.action,
    changedAt: row.changed_at,
    changedByName: row.changed_by_name,
    itemName: row.item_name,
    kod: row.kod,
    oldRow: row.old_row,
    newRow: row.new_row,
  };
}

export function toLedgerTransaction(
  row: TransactionRow,
  accountsById: Map<string, AccountRow>,
  categoriesById?: Map<string, CategoryRow>,
): LedgerTransaction {
  const debitType: AccountType = accountsById.get(row.debit_account_id)?.type ?? 'other';
  const creditType: AccountType = accountsById.get(row.credit_account_id)?.type ?? 'other';
  const categoryName = row.category_id
    ? (categoriesById?.get(row.category_id)?.name ?? null)
    : null;

  return {
    id: row.id,
    orgId: row.org_id,
    counterpartyId: row.counterparty_id,
    categoryId: row.category_id,
    categoryName,
    documentNo: row.document_no,
    occurredAt: row.occurred_at,
    dueDate: row.due_date,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    quantityKg: row.quantity_kg,
    quantityDona: row.quantity_dona,
    debitAccountType: debitType,
    debitAmount: row.debit_amount,
    creditAccountType: creditType,
    creditAmount: row.credit_amount,
    currency: row.currency,
    source: row.source,
    clientLocalId: row.client_local_id,
    status: row.status ?? 'posted',
    reversalOfId: row.reversal_of_id ?? null,
    reversedById: row.reversed_by_id ?? null,
    reversalReason: row.reversal_reason ?? null,
  };
}
