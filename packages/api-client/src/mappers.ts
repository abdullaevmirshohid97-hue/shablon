import type { LedgerTransaction, Counterparty, AccountType } from '@mubosher/shared';
import type { Database } from './database.types';

type TransactionRow = Database['public']['Tables']['transactions']['Row'];
type CounterpartyRow = Database['public']['Tables']['counterparties']['Row'];
type AccountRow = Database['public']['Tables']['accounts']['Row'];

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

export function toLedgerTransaction(
  row: TransactionRow,
  accountsById: Map<string, AccountRow>,
): LedgerTransaction {
  const debitType: AccountType = accountsById.get(row.debit_account_id)?.type ?? 'other';
  const creditType: AccountType = accountsById.get(row.credit_account_id)?.type ?? 'other';

  return {
    id: row.id,
    orgId: row.org_id,
    counterpartyId: row.counterparty_id,
    categoryId: row.category_id,
    occurredAt: row.occurred_at,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    debitAccountType: debitType,
    debitAmount: row.debit_amount,
    creditAccountType: creditType,
    creditAmount: row.credit_amount,
    currency: row.currency,
    clientLocalId: row.client_local_id,
  };
}
