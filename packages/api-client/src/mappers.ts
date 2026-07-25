import type {
  LedgerTransaction,
  Counterparty,
  TransactionCategory,
  Module,
  AccountType,
} from '@mubosher/shared';
import type { Database } from './database.types';

type TransactionRow = Database['public']['Tables']['transactions']['Row'];
type CounterpartyRow = Database['public']['Tables']['counterparties']['Row'];
type AccountRow = Database['public']['Tables']['accounts']['Row'];
type CategoryRow = Database['public']['Tables']['transaction_categories']['Row'];
type ModuleRow = Database['public']['Tables']['modules']['Row'];

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
