'use client';

import { useCallback, useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const currencyFormatter = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 });

type AuditEntry = {
  id: number;
  transaction_id: string;
  action: 'update' | 'delete';
  changed_at: string;
  changed_by_name: string | null;
  counterparty_name: string | null;
  document_no: string | null;
  occurred_at: string | null;
  old_amount: number | null;
  new_amount: number | null;
  old_description: string | null;
  new_description: string | null;
};

/** "12 000,00 → 15 000,00", or just the old value for a delete. */
function AmountChange({ entry }: { entry: AuditEntry }) {
  const before = entry.old_amount != null ? currencyFormatter.format(entry.old_amount) : '—';
  if (entry.action === 'delete') {
    return <span className="tabular-nums text-slate-500 line-through">{before}</span>;
  }

  const after = entry.new_amount != null ? currencyFormatter.format(entry.new_amount) : '—';
  if (before === after) return <span className="tabular-nums text-slate-400">{before}</span>;

  return (
    <span className="tabular-nums">
      <span className="text-slate-400 line-through">{before}</span>
      <span className="mx-1 text-slate-400">→</span>
      <span className="font-medium text-slate-900">{after}</span>
    </span>
  );
}

/**
 * Who changed which ledger entry, and what it said before. Reads the
 * append-only log written by the `transactions_audit` trigger
 * (0013_transaction_audit.sql) — admin-only at the RLS level too, not just
 * by virtue of living on an admin page.
 */
export function AuditLog({ orgId }: { orgId: string }) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_transaction_audit', {
      target_org_id: orgId,
      p_limit: limit,
    });
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setErrorMessage(null);
    setEntries(data ?? []);
  }, [supabase, orgId, limit]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card className="p-4">
      <h2 className="text-fin-lg font-semibold text-slate-900">{t('audit.title')}</h2>
      <p className="mt-1 text-fin-md text-slate-500">{t('audit.description')}</p>

      {errorMessage && <p className="mt-3 text-fin-md text-rose-600">{errorMessage}</p>}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-fin-md">
          <thead>
            <tr className="border-b border-slate-200 text-left text-fin-sm text-slate-500">
              <th className="py-1.5 pr-3 font-medium">{t('audit.when')}</th>
              <th className="py-1.5 pr-3 font-medium">{t('audit.who')}</th>
              <th className="py-1.5 pr-3 font-medium">{t('audit.what')}</th>
              <th className="py-1.5 pr-3 font-medium">{t('export.client')}</th>
              <th className="py-1.5 font-medium">{t('audit.amountChange')}</th>
            </tr>
          </thead>
          <tbody>
            {entries?.map((entry) => (
              <tr key={entry.id} className="border-b border-slate-100">
                <td className="py-1.5 pr-3 tabular-nums text-slate-600">
                  {new Date(entry.changed_at).toLocaleString(dateLocale)}
                </td>
                <td className="py-1.5 pr-3 text-slate-900">{entry.changed_by_name ?? '—'}</td>
                <td className="py-1.5 pr-3">
                  <Badge tone={entry.action === 'delete' ? 'danger' : 'neutral'}>
                    {t(`audit.action_${entry.action}`)}
                  </Badge>
                  {entry.document_no && (
                    <span className="ml-1.5 text-fin-sm text-slate-400">{entry.document_no}</span>
                  )}
                </td>
                <td className="py-1.5 pr-3 text-slate-700">{entry.counterparty_name ?? '—'}</td>
                <td className="py-1.5">
                  <AmountChange entry={entry} />
                  {entry.old_description !== entry.new_description && (
                    <span className="block text-fin-sm text-slate-400">
                      {entry.old_description ?? '—'}
                      {entry.action === 'update' && ` → ${entry.new_description ?? '—'}`}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {entries?.length === 0 && (
          <p className="py-3 text-fin-md text-slate-500">{t('audit.empty')}</p>
        )}
      </div>

      {entries && entries.length >= limit && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => setLimit((n) => n + 50)}
        >
          {t('audit.loadMore')}
        </Button>
      )}
    </Card>
  );
}
