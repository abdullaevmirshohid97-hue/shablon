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
  /** Who looks after this client (0032) — distinct from the manager on any one
   * despatch, which answers who handled that. */
  managerId?: string | null;
  createdAt: string;
}

/**
 * One line of the client journal.
 *
 * Two debt figures, deliberately: totalDebt is the balance today, overdueAmount
 * is what was outstanding when the deadline passed less everything paid since.
 * Oldest debt settles first, so a payment lowers the overdue part and a new
 * sale raises only the total.
 */
export interface CounterpartyJournalRow {
  counterpartyId: string;
  name: string;
  phone?: string | null;
  currency: string;
  categories: string[];
  managerId?: string | null;
  managerName?: string | null;
  totalDebt: number;
  overdueAmount: number;
  /** Since when they have been late. */
  overdueDate?: string | null;
  /** The nearest deadline still ahead of them. */
  nextDueDate?: string | null;
  lastEntryAt?: string | null;
  entryCount: number;
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
  /** Kirim less chiqim on the receivable: how far the clients' debt moved over
   * the period. Not revenue, and not the debt itself — see computeTotalDebt. */
  net: number;
  transactionCount: number;
  byCategory: CategoryBreakdown[];
}

// ---------------------------------------------------------------------
// Sklad (warehouse) — Phase 1: product card + reference data + batches
// ---------------------------------------------------------------------

export type SkladLookupKind = 'mahsulot_turi' | 'ip_turi' | 'sort' | 'rang' | 'pantone';

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
  kod?: string | null;
  name: string;
  productTypeId?: string | null;
  yarnTypeId?: string | null;
  gsm?: number | null;
  /** Centimetres. Two numbers rather than a "70x130" lookup, so the list can
   * filter and sort on them. */
  widthCm?: number | null;
  lengthCm?: number | null;
  sortId?: string | null;
  colorId?: string | null;
  pantoneId?: string | null;
  /** The product barcode (0033): one per card, assigned once, never changed. */
  barcode?: string | null;
  createdAt: string;
}

/** Buyurtma — mijoz reuses the existing Counterparty entity, not a separate customer table. */
export interface SkladOrder {
  id: string;
  orgId: string;
  orderNo?: string | null;
  orderName?: string | null;
  counterpartyId?: string | null;
  /** Who is answerable for it (0024). */
  managerId?: string | null;
  deadline?: string | null;
  status: SkladOrderStatus;
  notes?: string | null;
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
  qopSoni?: number | null;
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
  itemKod?: string | null;
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
  kod?: string | null;
  itemName: string;
  productType?: string | null;
  yarnType?: string | null;
  widthCm?: number | null;
  lengthCm?: number | null;
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
  qopSoni?: number | null;
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
  kod?: string | null;
  itemName: string;
  productType?: string | null;
  widthCm?: number | null;
  lengthCm?: number | null;
  colorName?: string | null;
  batchCount: number;
  totalDona: number;
  totalKg: number;
  /** Null for staff. */
  stockValue: number | null;
}

// ---------------------------------------------------------------------
// Production chain (0024-0025): one order, written into by every shop from
// the loom to the loading bay.
// ---------------------------------------------------------------------

export type SkladOrderStatus = 'yangi' | 'ishlab_chiqarishda' | 'tayyor' | 'yuklandi' | 'yopilgan';

/** A shop floor. Ordered and renameable per org; exactly one is the finished
 * goods warehouse, whose output is what becomes shippable. */
export interface SkladStage {
  id: string;
  orgId: string;
  name: string;
  position: number;
  isFinal: boolean;
}

/** One row of an order — the unit each shop reports against. */
export interface SkladOrderLine {
  id: string;
  orgId: string;
  orderId: string;
  itemId?: string | null;
  position: number;
  description?: string | null;
  sizeText?: string | null;
  colorText?: string | null;
  plannedDona?: number | null;
  plannedKg?: number | null;
  notes?: string | null;
  createdAt: string;
}

/** What one shop did to one row on one day. Several per (line, stage) is
 * normal — a dye house rarely finishes a thousand towels in one pass. */
export interface SkladStageEntry {
  id: string;
  qtyIn?: number | null;
  qtyOut?: number | null;
  defectQty?: number | null;
  kg?: number | null;
  executorName?: string | null;
  occurredAt: string;
  note?: string | null;
  createdByName?: string | null;
  createdAt: string;
}

/** A row's standing: planned, made, shipped, still owed. */
export interface SkladLineProgress {
  lineId: string;
  position: number;
  description?: string | null;
  itemName?: string | null;
  kod?: string | null;
  sizeText?: string | null;
  colorText?: string | null;
  plannedDona?: number | null;
  plannedKg?: number | null;
  readyDona: number;
  defectDona: number;
  shippedDona: number;
  shippedKg: number;
  remainingDona: number;
}

/** One cell of the order x stage grid. Empty cells are the point of it. */
export interface SkladStageCell {
  lineId: string;
  stageId: string;
  stageName: string;
  stagePosition: number;
  isFinal: boolean;
  qtyIn?: number | null;
  qtyOut?: number | null;
  defectQty?: number | null;
  kg?: number | null;
  entryCount: number;
  lastOccurredAt?: string | null;
}

/** How much of one order has gone to one client. */
export interface SkladOrderClient {
  counterpartyId?: string | null;
  counterpartyName: string;
  shipmentCount: number;
  shippedDona: number;
  shippedKg: number;
  lastShippedAt?: string | null;
}

/** A line of the analytics screen: one order, end to end. */
export interface SkladOrderSummary {
  orderId: string;
  orderNo?: string | null;
  orderName?: string | null;
  status: SkladOrderStatus;
  deadline?: string | null;
  counterpartyId?: string | null;
  counterpartyName?: string | null;
  managerName?: string | null;
  lineCount: number;
  plannedDona: number;
  readyDona: number;
  shippedDona: number;
  remainingDona: number;
  /** The furthest shop that has reported output — as close to "where is it"
   * as a single word gets. */
  currentStage?: string | null;
  createdAt: string;
}

export interface SkladStageLoad {
  stageId: string;
  stageName: string;
  stagePosition: number;
  entryCount: number;
  qtyOut: number;
  defectQty: number;
  kg: number;
}

export interface SkladShipment {
  id: string;
  orgId: string;
  orderId?: string | null;
  counterpartyId?: string | null;
  managerId?: string | null;
  documentNo?: string | null;
  shippedAt: string;
  note?: string | null;
  createdAt: string;
}

/**
 * One typed line of a paper invoice, on its way to sklad_receive_rows.
 *
 * Every field is a string because every field is an input the storekeeper
 * types; the database parses and, for the reference values, creates what does
 * not exist yet. Sending numbers from here would mean the grid had to validate
 * before it could save, which is the opposite of typing an invoice.
 */
export interface SkladReceiveRow {
  kod?: string;
  name?: string;
  productType?: string;
  yarnType?: string;
  width?: string;
  length?: string;
  sort?: string;
  color?: string;
  pantone?: string;
  gsm?: string;
  brutto?: string;
  netto?: string;
  dona?: string;
  nabor?: string;
  qop?: string;
  producedAt?: string;
  notes?: string;
}

/** A batch with stock left on it, as the despatch grid offers it. */
export interface SkladIssuableBatch {
  batchId: string;
  itemId: string;
  kod?: string | null;
  itemName: string;
  productType?: string | null;
  widthCm?: number | null;
  lengthCm?: number | null;
  colorName?: string | null;
  sortName?: string | null;
  qoldiqDona: number;
  pieceWeightKg?: number | null;
  orderId?: string | null;
  orderNo?: string | null;
  omborgaKirganSana: string;
}

/**
 * One line of a despatch, on its way to sklad_issue_rows.
 *
 * Strings for the same reason SkladReceiveRow uses them: these are what the
 * storekeeper typed, and the database does the parsing.
 */
export interface SkladIssueRow {
  batchId?: string;
  orderLineId?: string;
  dona?: string;
  kg?: string;
  note?: string;
}

// ---------------------------------------------------------------------
// Sales invoices (0027): the paper a manager raises and the loading bay scans.
// ---------------------------------------------------------------------

export type SkladInvoiceStatus = 'yangi' | 'qisman' | 'bajarildi' | 'bekor';

/** One line of an invoice being raised. Strings, as everywhere the user types. */
export interface SkladInvoiceRow {
  itemId?: string;
  batchId?: string;
  dona?: string;
  kg?: string;
  unitPrice?: string;
  note?: string;
}

/** A row of the invoice queue on the despatch desk. */
export interface SkladInvoiceSummary {
  invoiceId: string;
  invoiceNo?: string | null;
  barcode?: string | null;
  status: SkladInvoiceStatus;
  issuedAt: string;
  dueDate?: string | null;
  counterpartyId?: string | null;
  counterpartyName: string;
  managerName?: string | null;
  orderNo?: string | null;
  currency: string;
  lineCount: number;
  orderedDona: number;
  shippedDona: number;
  totalAmount?: number | null;
}

/** One line of a scanned invoice, with what is still outstanding on it. */
export interface SkladInvoiceLine {
  lineId: string;
  itemId?: string | null;
  batchId?: string | null;
  kod?: string | null;
  itemName?: string | null;
  widthCm?: number | null;
  lengthCm?: number | null;
  colorName?: string | null;
  orderedDona: number;
  shippedDona: number;
  remainingDona: number;
  /** What the batch the line names actually holds — null when it names none. */
  batchQoldiqDona?: number | null;
  unitPrice?: number | null;
  amount?: number | null;
}

/** What a scan resolves to: the header, and the lines with their remainders. */
export interface SkladScannedInvoice {
  invoiceId: string;
  invoiceNo?: string | null;
  barcode?: string | null;
  status: SkladInvoiceStatus;
  issuedAt: string;
  counterpartyId?: string | null;
  counterpartyName: string;
  orderId?: string | null;
  managerId?: string | null;
  currency: string;
  note?: string | null;
  lines: SkladInvoiceLine[];
}

/** A despatch note, as it prints. */
export interface SkladShipmentNote {
  shipmentId: string;
  documentNo?: string | null;
  shippedAt: string;
  counterpartyName?: string | null;
  managerName?: string | null;
  orderNo?: string | null;
  invoiceId?: string | null;
  invoiceNo?: string | null;
  invoiceBarcode?: string | null;
  note?: string | null;
  lines: {
    lineId: string;
    kod?: string | null;
    itemName?: string | null;
    widthCm?: number | null;
    lengthCm?: number | null;
    colorName?: string | null;
    dona: number;
    kg?: number | null;
  }[];
}

export type SkladAuditEntity =
  | 'batch'
  | 'item'
  | 'price'
  | 'order'
  | 'line'
  | 'stage_entry'
  | 'shipment'
  | 'invoice'
  | 'package';

export interface SkladAuditEntry {
  id: number;
  entity: SkladAuditEntity;
  entityId: string;
  action: 'insert' | 'update' | 'delete';
  changedAt: string;
  changedByName?: string | null;
  itemName?: string | null;
  kod?: string | null;
  oldRow: Record<string, unknown> | null;
  newRow: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Sotuv bo'limi: the sack, and the two codes that identify what is in it.
// See 0033_sotuv_qop.sql — the barcode names the product, the QR names the sack.
// ---------------------------------------------------------------------------

export type SkladPackageStatus = 'tayyor' | 'jonatilgan' | 'bekor';

/** One line of a sack: this many of this product, out of this lot. */
export interface SkladPackageLine {
  lineId: string;
  itemId: string;
  batchId: string;
  /** The product barcode — what a scanner reads to tell red from yellow. */
  itemBarcode?: string | null;
  kod?: string | null;
  itemName?: string | null;
  widthCm?: number | null;
  lengthCm?: number | null;
  colorName?: string | null;
  dona: number;
  kg?: number | null;
  batchQoldiqDona?: number | null;
}

/** A sack in full — what the QR on its label opens. */
export interface SkladPackage {
  packageId: string;
  code?: string | null;
  barcode?: string | null;
  status: SkladPackageStatus;
  packedAt: string;
  grossKg?: number | null;
  note?: string | null;
  invoiceId?: string | null;
  invoiceNo?: string | null;
  counterpartyId?: string | null;
  counterpartyName?: string | null;
  shipmentId?: string | null;
  packedByName?: string | null;
  lines: SkladPackageLine[];
}

/** A sack as it appears in the list beside its invoice. */
export interface SkladPackageSummary {
  packageId: string;
  code?: string | null;
  barcode?: string | null;
  status: SkladPackageStatus;
  packedAt: string;
  grossKg?: number | null;
  note?: string | null;
  shipmentId?: string | null;
  totalDona: number;
  totalKg?: number | null;
  lineCount: number;
  /** "Qizil atirgul × 50, Sariq atirgul × 20" — the label's own summary. */
  contents?: string | null;
}

/** What a row of the sack builder holds before it is saved. */
export interface SkladPackageRow {
  itemId: string;
  batchId?: string | null;
  dona: string;
  kg?: string;
}

export type SkladScanKind = 'faktura' | 'qop' | 'mahsulot';

/** One code in, one answer out — see sklad_scan(). */
export interface SkladScanHit {
  kind: SkladScanKind;
  id: string;
  code?: string | null;
  label?: string | null;
  detail?: string | null;
  invoiceId?: string | null;
  counterpartyId?: string | null;
  counterpartyName?: string | null;
  itemId?: string | null;
  batchId?: string | null;
  availableDona?: number | null;
  status?: string | null;
}

/** The sales desk's first screen: a client, and what they have bought. */
export interface SkladSalesClient {
  counterpartyId: string;
  counterpartyName: string;
  phone?: string | null;
  invoiceCount: number;
  openCount: number;
  totalAmount?: number | null;
  orderedDona: number;
  shippedDona: number;
  packageCount: number;
  lastIssuedAt?: string | null;
  currency?: string | null;
}
