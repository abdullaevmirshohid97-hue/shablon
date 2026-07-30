'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LedgerTransaction } from '@mubosher/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@mubosher/api-client';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Input, Label } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const currencyFormatter = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 });

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Reversing replaces deleting: the original stays in the ledger and a mirror
 * entry cancels it. The reversal is dated independently because the original's
 * month is often already closed — posting the correction into the open month
 * is the whole point, not a workaround.
 */
export function ReverseTransactionModal({
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
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [reversalDate, setReversalDate] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const amount =
    transaction.debitAccountType === 'receivable'
      ? transaction.debitAmount
      : transaction.creditAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    const { error } = await supabase.rpc('reverse_transaction', {
      p_transaction_id: transaction.id,
      p_reversal_date: reversalDate,
      p_reason: reason || null,
    });

    setSubmitting(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['transactions', orgId, counterpartyId] });
    await queryClient.invalidateQueries({ queryKey: ['org-overview', orgId] });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('ledger.reverseTitle')}
        tabIndex={-1}
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-popover outline-none"
      >
        <h2 className="text-base font-semibold text-slate-900">{t('ledger.reverseTitle')}</h2>
        <p className="mt-1 text-sm text-slate-500">{t('ledger.reverseDescription')}</p>

        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">{transaction.documentNo}</span>
            <span className="tabular-nums font-semibold text-slate-900">
              {currencyFormatter.format(amount)}
            </span>
          </div>
          <div className="mt-0.5 flex justify-between gap-3 text-xs text-slate-500">
            <span className="truncate">{transaction.description}</span>
            <span className="shrink-0">
              {new Date(transaction.occurredAt).toLocaleDateString(dateLocale)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div>
            <Label>{t('ledger.reverseDate')}</Label>
            <Input
              type="date"
              required
              value={reversalDate}
              onChange={(e) => setReversalDate(e.target.value)}
            />
          </div>
          <div>
            <Label>{t('ledger.reverseReason')}</Label>
            <Input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('ledger.reverseReasonPlaceholder')}
            />
          </div>

          {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}

          <div className="mt-1 flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? t('common.saving') : t('ledger.reverseSubmit')}
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
