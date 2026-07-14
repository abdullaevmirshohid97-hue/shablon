export type AccountType = 'receivable' | 'cash' | 'sales' | 'inventory' | 'other';

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
  occurredAt: string;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  debitAccountType: AccountType;
  debitAmount: number;
  creditAccountType: AccountType;
  creditAmount: number;
  currency: string;
  clientLocalId?: string | null;
}

export type BalanceSide = 'debit' | 'credit';

export interface RunningBalanceEntry {
  transactionId: string;
  occurredAt: string;
  balance: number;
  side: BalanceSide;
}
