export type AccountType = 'receivable' | 'cash' | 'sales' | 'inventory' | 'other';

/** Which cash source a transaction's money came from / went to. */
export type FundSource = 'fabrika' | 'shaxsiy';

export type OrgRole = 'owner' | 'admin' | 'staff';

export type PlatformRole = 'user' | 'platform_admin';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  baseCurrency: string;
  subscriptionStatus: SubscriptionStatus;
  createdAt: string;
}

/** A user-managed business module (sidebar link + scoped dashboard view). */
export interface Module {
  id: string;
  orgId: string;
  name: string;
  createdAt: string;
}

export interface Counterparty {
  id: string;
  orgId: string;
  name: string;
  phone?: string | null;
  categories: string[];
  notes?: string | null;
  currency?: string | null;
  createdAt: string;
}

export interface Account {
  id: string;
  orgId: string;
  code: string;
  name: string;
  type: AccountType;
}

export interface TransactionCategory {
  id: string;
  orgId: string;
  name: string;
  unit?: string | null;
  defaultDebitAccountId?: string | null;
  defaultCreditAccountId?: string | null;
}

/** A single ledger entry, mirroring the Дебет/Кредит columns of the paper ledger. */
export interface LedgerTransaction {
  id: string;
  orgId: string;
  counterpartyId: string;
  categoryId?: string | null;
  categoryName?: string | null;
  documentNo?: string | null;
  occurredAt: string;
  dueDate?: string | null;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  /** Independent of `quantity`/`unit` — lets one row carry both a kg and a dona amount. */
  quantityKg?: number | null;
  quantityDona?: number | null;
  debitAccountType: AccountType;
  debitAmount: number;
  creditAccountType: AccountType;
  creditAmount: number;
  currency: string;
  source: FundSource;
  clientLocalId?: string | null;
  status: TransactionStatus;
  /** Set on a reversing entry: the entry it cancels. */
  reversalOfId?: string | null;
  /** Set on a reversed entry: the entry that cancelled it. */
  reversedById?: string | null;
  reversalReason?: string | null;
}

/** Lifecycle of a ledger entry — see 0014_transaction_reversal.sql. */
export type TransactionStatus = 'draft' | 'posted' | 'reversed' | 'reversal';

export type AccountingPeriodStatus = 'open' | 'closed';

export type BalanceSide = 'debit' | 'credit';

export interface RunningBalanceEntry {
  transactionId: string;
  occurredAt: string;
  balance: number;
  side: BalanceSide;
}

/** Per-row Jami (running turnover) and Qoldi (running net balance), split by fund source. */
export interface SourceBalanceEntry {
  transactionId: string;
  fabrikaJami: number;
  shaxsiyJami: number;
  fabrikaQoldi: number;
  shaxsiyQoldi: number;
}

export type PeriodKind = 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface PeriodRange {
  /** Inclusive, ISO date (yyyy-mm-dd). */
  start: string;
  /** Inclusive, ISO date (yyyy-mm-dd). */
  end: string;
}

/** Quantity/amount turnover for one category+unit+kind combo within a period, e.g. "10000 kg sochiq (kirim)". */
export interface CategoryBreakdown {
  categoryName: string;
  unit: string | null;
  kind: 'kirim' | 'chiqim';
  totalQuantity: number;
  totalAmount: number;
  transactionCount: number;
}

export interface PeriodStats {
  range: PeriodRange;
  totalKirim: number;
  totalChiqim: number;
  net: number;
  transactionCount: number;
  byCategory: CategoryBreakdown[];
}

// ---------------------------------------------------------------------
// Sklad (warehouse) — Phase 1: product card + reference data + batches
// ---------------------------------------------------------------------

export type SkladLookupKind = 'mahsulot_turi' | 'ip_turi' | 'olcham' | 'sort' | 'rang' | 'pantone';

/** One admin-managed dropdown value (product type / yarn type / size / sort / color / pantone). */
export interface SkladLookup {
  id: string;
  orgId: string;
  kind: SkladLookupKind;
  name: string;
  createdAt: string;
}

/** Mahsulot kartasi — the reusable product definition, distinct from any physical lot of it. */
export interface SkladItem {
  id: string;
  orgId: string;
  artikul?: string | null;
  kod?: string | null;
  name: string;
  productTypeId?: string | null;
  yarnTypeId?: string | null;
  gsm?: number | null;
  sizeId?: string | null;
  sortId?: string | null;
  colorId?: string | null;
  pantoneId?: string | null;
  createdAt: string;
}

/** Buyurtma — mijoz reuses the existing Counterparty entity, not a separate customer table. */
export interface SkladOrder {
  id: string;
  orgId: string;
  orderNo?: string | null;
  orderName?: string | null;
  counterpartyId?: string | null;
  createdAt: string;
}

export type SkladBatchStatus =
  'tayyor' | 'qadoqlanmoqda' | 'omborda' | 'rezerv' | 'jonatildi' | 'qaytarildi' | 'brak';

/** Narxlar — kept in a separate table so RLS can hide it from non-admins row-for-row. */
export interface SkladBatchPrice {
  batchId: string;
  /** Absent on a list row: sklad_batch_page joins the price in but has no
   * reason to repeat the org id forty times per page. */
  orgId?: string;
  pricePerKg?: number | null;
  pricePerPiece?: number | null;
  pricePerSet?: number | null;
  totalAmount?: number | null;
  purchaseCost?: number | null;
  profitPercent?: number | null;
  profitAmount?: number | null;
  currency: string;
}

/** Ombor qoldig'i — one row per physical lot/batch of an item sitting in the warehouse. */
export interface SkladBatch {
  id: string;
  orgId: string;
  itemId: string;
  orderId?: string | null;
  bruttoKg?: number | null;
  nettoKg?: number | null;
  /** Generated column (brutto - netto) — never set directly. */
  taraKg?: number | null;
  donaSoni?: number | null;
  naborSoni?: number | null;
  palletSoni?: number | null;
  /** Generated column (netto / dona) — never set directly. */
  pieceWeightKg?: number | null;
  /** Derived from the batch's movements by trigger (0022) — never written by
   * the app. To change it, record a movement. */
  qoldiqDona?: number | null;
  ishlabChiqarilganSana?: string | null;
  omborgaKirganSana: string;
  status: SkladBatchStatus;
  qcCheckedBy?: string | null;
  qcCheckedAt?: string | null;
  defectType?: string | null;
  defectQty?: number | null;
  notes?: string | null;
  locationSector?: string | null;
  locationRow?: string | null;
  locationRack?: string | null;
  locationShelf?: string | null;
  createdAt: string;
  // Denormalized display fields, populated via embedded selects in useSkladBatches.
  itemName?: string;
  itemArtikul?: string | null;
  orderNo?: string | null;
  orderName?: string | null;
  counterpartyName?: string | null;
  price?: SkladBatchPrice | null;
}

/**
 * One row of the warehouse list, as `sklad_batch_page` (0023) returns it:
 * batch, product card, order and price flattened together with the lookup ids
 * already resolved to names.
 *
 * Distinct from SkladBatch on purpose. SkladBatch is the record you edit —
 * lookup *ids*, one batch at a time. This is the record you read — names,
 * derived remainders, and the totals for the whole filtered set. Collapsing
 * the two would mean the edit form carrying display strings it cannot save.
 *
 * Every price field is null for staff: the price row is invisible to them at
 * the RLS level, and the RPC runs with the caller's own rights.
 */
export interface SkladBatchRow {
  id: string;
  itemId: string;
  orderId?: string | null;
  artikul?: string | null;
  kod?: string | null;
  itemName: string;
  productType?: string | null;
  yarnType?: string | null;
  sizeName?: string | null;
  sortName?: string | null;
  colorName?: string | null;
  pantoneCode?: string | null;
  gsm?: number | null;
  bruttoKg?: number | null;
  nettoKg?: number | null;
  taraKg?: number | null;
  pieceWeightKg?: number | null;
  donaSoni?: number | null;
  naborSoni?: number | null;
  palletSoni?: number | null;
  qoldiqDona?: number | null;
  /** pieceWeightKg x qoldiqDona, computed in the database. */
  qoldiqKg?: number | null;
  ishlabChiqarilganSana?: string | null;
  omborgaKirganSana: string;
  status: SkladBatchStatus;
  orderNo?: string | null;
  orderName?: string | null;
  counterpartyName?: string | null;
  defectType?: string | null;
  defectQty?: number | null;
  notes?: string | null;
  locationSector?: string | null;
  locationRow?: string | null;
  locationRack?: string | null;
  locationShelf?: string | null;
  createdAt: string;
  price: SkladBatchPrice | null;
}

/** Totals across every batch matching the current filter, not just this page. */
export interface SkladBatchTotals {
  count: number;
  nettoKg: number;
  qoldiqDona: number;
  qoldiqKg: number;
  /** Null for staff — see SkladBatchRow. */
  totalAmount: number | null;
  /** The currency `totalAmount` is in. Null when the filtered batches are
   * priced in more than one, in which case the sum is not worth showing. */
  currency: string | null;
}

export interface SkladBatchPage {
  rows: SkladBatchRow[];
  totals: SkladBatchTotals;
}

export type SkladMovementKind = 'kirim' | 'chiqim' | 'qaytarish' | 'brak' | 'korrektirovka';

/** One physical event in a batch's life. `dona` is signed: what it did to the
 * stock, not how big it was. */
export interface SkladMovement {
  id: string;
  kind: SkladMovementKind;
  dona: number;
  kg?: number | null;
  occurredAt: string;
  counterpartyName?: string | null;
  orderNo?: string | null;
  note?: string | null;
  /** The batch's own receipt, written by trigger alongside the batch. */
  isInitial: boolean;
  createdByName?: string | null;
  createdAt: string;
}

/** Current stock per product card, across all its batches. */
export interface SkladStockRow {
  itemId: string;
  artikul?: string | null;
  itemName: string;
  productType?: string | null;
  sizeName?: string | null;
  colorName?: string | null;
  batchCount: number;
  totalDona: number;
  totalKg: number;
  /** Null for staff. */
  stockValue: number | null;
}

export type SkladAuditEntity = 'batch' | 'item' | 'price' | 'order';

export interface SkladAuditEntry {
  id: number;
  entity: SkladAuditEntity;
  entityId: string;
  action: 'insert' | 'update' | 'delete';
  changedAt: string;
  changedByName?: string | null;
  itemName?: string | null;
  artikul?: string | null;
  oldRow: Record<string, unknown> | null;
  newRow: Record<string, unknown> | null;
}
