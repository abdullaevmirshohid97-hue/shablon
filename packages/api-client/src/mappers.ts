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
type SkladBatchRow = Database['public']['Tables']['sklad_batches']['Row'];
type SkladBatchPriceRow = Database['public']['Tables']['sklad_batch_prices']['Row'];

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
    artikul: row.artikul,
    kod: row.kod,
    name: row.name,
    productTypeId: row.product_type_id,
    yarnTypeId: row.yarn_type_id,
    gsm: row.gsm,
    sizeId: row.size_id,
    sortId: row.sort_id,
    colorId: row.color_id,
    pantoneId: row.pantone_id,
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
 * one query) — nested relations come back as arrays since this hand-maintained type file has
 * no Relationships metadata to tell supabase-js their real cardinality (same convention as
 * the existing `organizations(name)` embed elsewhere in this codebase). */
export type SkladBatchEmbeddedRow = SkladBatchRow & {
  sklad_items: { name: string; artikul: string | null }[] | null;
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
    palletSoni: row.pallet_soni,
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
    itemArtikul: item?.artikul ?? null,
    orderNo: order?.order_no ?? null,
    orderName: order?.order_name ?? null,
    counterpartyName: one(order?.counterparties)?.name ?? null,
    price: price ? toSkladBatchPrice(price) : null,
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
  };
}
