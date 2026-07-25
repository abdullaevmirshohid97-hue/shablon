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
}

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
