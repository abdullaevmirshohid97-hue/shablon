'use client';

import { useState } from 'react';
import { useCategoriesWithKind, useUpdateTransaction } from '@mubosher/api-client';
import type { FundSource, LedgerTransaction } from '@mubosher/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@mubosher/api-client';
import { Calculator } from './Calculator';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Input, Select, Label } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditTransactionModal({
  supabase,
  orgId,
  counterpartyId,
  transaction,
  onClose,
}: {
  supabase: SupabaseClient<Database>;
  orgId: string;
  counterpartyId: string;
  transaction: LedgerTransaction;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const { data: categories } = useCategoriesWithKind(supabase, orgId);
  const updateTransaction = useUpdateTransaction(supabase);

  const initialKind: 'kirim' | 'chiqim' =
    transaction.debitAccountType === 'receivable' ? 'kirim' : 'chiqim';
  const initialAmount =
    transaction.debitAccountType === 'receivable'
      ? transaction.debitAmount
      : transaction.creditAmount;

  const [kind, setKind] = useState<'kirim' | 'chiqim'>(initialKind);
  const [categoryId, setCategoryId] = useState(transaction.categoryId ?? '');
  const [source, setSource] = useState<FundSource>(transaction.source);
  const [occurredAt, setOccurredAt] = useState(toDatetimeLocal(transaction.occurredAt));
  const [quantity, setQuantity] = useState(
    transaction.quantity ? String(transaction.quantity) : '',
  );
  const [amount, setAmount] = useState(String(initialAmount));
  const [dueDate, setDueDate] = useState(transaction.dueDate ?? '');
  const [description, setDescription] = useState(transaction.description ?? '');
  const [showCalculator, setShowCalculator] = useState(false);

  const matchingCategories = (categories ?? []).filter((c) => c.kind === kind);
  const selectedCategory =
    matchingCategories.find((c) => c.id === categoryId) ?? matchingCategories[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCategory || !amount) return;

    await updateTransaction.mutateAsync({
      id: transaction.id,
      orgId,
      counterpartyId,
      categoryId: selectedCategory.id,
      occurredAt: new Date(occurredAt).toISOString(),
      dueDate: dueDate || undefined,
      description: description || undefined,
      quantity: quantity ? Number(quantity) : undefined,
      unit: selectedCategory.unit ?? undefined,
      amount: Number(amount),
      currency: transaction.currency,
      source,
    });

    onClose();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-popover">
        <h2 className="mb-4 text-base font-semibold text-slate-900">{t('ledger.editTitle')}</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              {
                value: 'kirim',
                label: t('ledger.kirim'),
                activeClassName: 'bg-emerald-600 text-white shadow-sm',
              },
              {
                value: 'chiqim',
                label: t('ledger.chiqim'),
                activeClassName: 'bg-rose-600 text-white shadow-sm',
              },
            ]}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('transaction.type')}</Label>
              <Select
                value={selectedCategory?.id ?? ''}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {matchingCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label>{t('transaction.source')}</Label>
              <Select value={source} onChange={(e) => setSource(e.target.value as FundSource)}>
                <option value="fabrika">{t('ledger.fabrika')}</option>
                <option value="shaxsiy">{t('ledger.shaxsiy')}</option>
              </Select>
            </div>

            <div>
              <Label>{t('transaction.date')}</Label>
              <Input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </div>

            {selectedCategory?.unit && (
              <div>
                <Label>
                  {t('transaction.quantity')} ({selectedCategory.unit})
                </Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            )}

            <div className="relative">
              <Label>{t('transaction.amount')}</Label>
              <div className="relative">
                <Input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pr-8 tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => setShowCalculator((v) => !v)}
                  className="absolute right-1.5 top-1/2 grid h-4 w-4 -translate-y-1/2 grid-cols-2 grid-rows-2 overflow-hidden rounded-[3px] border border-slate-400 text-slate-500 hover:border-brand-500 hover:text-brand-600"
                  title={t('transaction.calculator')}
                >
                  <span className="flex items-center justify-center text-[7px] leading-none">
                    +
                  </span>
                  <span className="flex items-center justify-center text-[7px] leading-none">
                    −
                  </span>
                  <span className="flex items-center justify-center text-[7px] leading-none">
                    ×
                  </span>
                  <span className="flex items-center justify-center text-[7px] leading-none">
                    ÷
                  </span>
                </button>
              </div>
              {showCalculator && (
                <Calculator
                  initialValue={amount ? Number(amount) : undefined}
                  onApply={(value) => {
                    setAmount(String(value));
                    setShowCalculator(false);
                  }}
                  onClose={() => setShowCalculator(false)}
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('transaction.dueDate')}</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>{t('transaction.description')}</Label>
              <Input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {updateTransaction.isError && (
            <p className="text-sm text-rose-600">{(updateTransaction.error as Error).message}</p>
          )}

          <div className="mt-1 flex gap-2">
            <Button type="submit" disabled={updateTransaction.isPending || !selectedCategory}>
              {updateTransaction.isPending ? t('common.saving') : t('common.save')}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
