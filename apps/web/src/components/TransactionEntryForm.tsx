'use client';

import { useState } from 'react';
import { useCategoriesWithKind, useCreateTransaction } from '@mubosher/api-client';
import type { FundSource } from '@mubosher/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@mubosher/api-client';
import { Calculator } from './Calculator';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input, Select, Label } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';

export function TransactionEntryForm({
  supabase,
  orgId,
  counterpartyId,
}: {
  supabase: SupabaseClient<Database>;
  orgId: string;
  counterpartyId: string;
}) {
  const { t } = useLocale();
  const { data: categories } = useCategoriesWithKind(supabase, orgId);
  const createTransaction = useCreateTransaction(supabase);

  const [kind, setKind] = useState<'kirim' | 'chiqim'>('kirim');
  const [categoryId, setCategoryId] = useState('');
  const [source, setSource] = useState<FundSource>('fabrika');
  const [quantity, setQuantity] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [showCalculator, setShowCalculator] = useState(false);

  const matchingCategories = (categories ?? []).filter((c) => c.kind === kind);
  const selectedCategory =
    matchingCategories.find((c) => c.id === categoryId) ?? matchingCategories[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCategory || !amount) return;

    await createTransaction.mutateAsync({
      orgId,
      counterpartyId,
      categoryId: selectedCategory.id,
      occurredAt: new Date().toISOString(),
      dueDate: dueDate || undefined,
      description: description || undefined,
      quantity: quantity ? Number(quantity) : undefined,
      unit: selectedCategory.unit ?? undefined,
      amount: Number(amount),
      currency: 'UZS',
      source,
      clientLocalId: crypto.randomUUID(),
    });

    setQuantity('');
    setAmount('');
    setDueDate('');
    setDescription('');
  }

  return (
    <Card className="p-4">
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

          {selectedCategory?.unit && (
            <div>
              <Label>
                {t('transaction.quantity')} ({selectedCategory.unit})
              </Label>
              <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
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
                <span className="flex items-center justify-center text-[7px] leading-none">+</span>
                <span className="flex items-center justify-center text-[7px] leading-none">−</span>
                <span className="flex items-center justify-center text-[7px] leading-none">×</span>
                <span className="flex items-center justify-center text-[7px] leading-none">÷</span>
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label>{t('transaction.dueDate')}</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="col-span-2 sm:col-span-3">
            <Label>{t('transaction.description')}</Label>
            <Input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={createTransaction.isPending || !selectedCategory}>
            {createTransaction.isPending ? t('common.saving') : t('common.save')}
          </Button>
          {createTransaction.isError && (
            <p className="text-fin-md text-rose-600">
              {(createTransaction.error as Error).message}
            </p>
          )}
        </div>
      </form>
    </Card>
  );
}
