'use client';

import { useState } from 'react';
import { useSkladAudit } from '@mubosher/api-client';
import type { SkladAuditEntry } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

/** Columns worth naming on screen. Anything else that changed is counted, not
 * listed — the log is for answering "who touched the stock and the money",
 * not for reconstructing every timestamp. */
const FIELD_LABELS: Record<string, string> = {
  status: 'sklad.batch.statusLabel',
  dona_soni: 'sklad.batch.donaLabel',
  netto_kg: 'sklad.batch.nettoLabel',
  brutto_kg: 'sklad.batch.bruttoLabel',
  notes: 'sklad.batch.notesLabel',
  defect_type: 'sklad.batch.defectTypeLabel',
  defect_qty: 'sklad.batch.defectQtyLabel',
  kod: 'sklad.item.kodLabel',
  name: 'sklad.item.nameLabel',
  gsm: 'sklad.item.gsmLabel',
  price_per_kg: 'sklad.price.pricePerKgLabel',
  price_per_piece: 'sklad.price.pricePerPieceLabel',
  price_per_set: 'sklad.price.pricePerSetLabel',
  total_amount: 'sklad.price.totalAmountLabel',
  purchase_cost: 'sklad.price.purchaseCostLabel',
  profit_percent: 'sklad.price.profitPercentLabel',
  profit_amount: 'sklad.price.profitAmountLabel',
  currency: 'sklad.price.currencyLabel',
  order_no: 'sklad.batch.orderNoLabel',
  order_name: 'sklad.batch.orderNameLabel',
};

const IGNORED_FIELDS = new Set(['id', 'org_id', 'created_at', 'created_by', 'batch_id']);

interface FieldChange {
  field: string;
  /** The i18n key for this column, when it is one worth naming. */
  labelKey?: string;
  before: string;
  after: string;
}

function display(value: unknown): string {
  if (value == null || value === '') return '—';
  return String(value);
}

function diff(entry: SkladAuditEntry): FieldChange[] {
  const before = entry.oldRow ?? {};
  const after = entry.newRow ?? {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: FieldChange[] = [];

  for (const key of keys) {
    if (IGNORED_FIELDS.has(key)) continue;
    if (display(before[key]) === display(after[key])) continue;
    changes.push({
      field: key,
      labelKey: FIELD_LABELS[key],
      before: display(before[key]),
      after: display(after[key]),
    });
  }

  // Named columns first, so the interesting ones survive the slice below.
  return changes.sort((a, b) => Number(!!b.labelKey) - Number(!!a.labelKey));
}

/**
 * Who changed which batch, product card, order or price.
 *
 * Finance has had this since 0013; the warehouse — where a disputed figure is
 * usually about physical goods and someone's shift — had nothing. Admin-only
 * at the RLS level, not merely by living on an admin page.
 */
export function SkladAuditLog({ orgId }: { orgId: string }) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [limit, setLimit] = useState(50);
  const { data: entries, error } = useSkladAudit(supabase, orgId, limit);

  return (
    <Card className="p-4">
      <h2 className="text-base font-semibold text-slate-900">{t('sklad.audit.title')}</h2>
      <p className="mt-1 text-sm text-slate-500">{t('sklad.audit.description')}</p>

      {error && <p className="mt-3 text-sm text-rose-600">{(error as Error).message}</p>}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1.5 pr-3 font-medium">{t('audit.when')}</th>
              <th className="py-1.5 pr-3 font-medium">{t('audit.who')}</th>
              <th className="py-1.5 pr-3 font-medium">{t('audit.what')}</th>
              <th className="py-1.5 pr-3 font-medium">{t('sklad.item.nameLabel')}</th>
              <th className="py-1.5 font-medium">{t('sklad.audit.change')}</th>
            </tr>
          </thead>
          <tbody>
            {entries?.map((entry) => {
              const changes = diff(entry);
              const shown = changes.slice(0, 3);
              return (
                <tr key={entry.id} className="border-b border-slate-100 align-top">
                  <td className="py-1.5 pr-3 tabular-nums text-slate-600">
                    {new Date(entry.changedAt).toLocaleString(dateLocale)}
                  </td>
                  <td className="py-1.5 pr-3 text-slate-900">{entry.changedByName ?? '—'}</td>
                  <td className="py-1.5 pr-3">
                    <Badge tone={entry.action === 'delete' ? 'danger' : 'neutral'}>
                      {t(`sklad.audit.entity_${entry.entity}`)}
                    </Badge>
                    <span className="ml-1.5 text-xs text-slate-400">
                      {t(`audit.action_${entry.action}`)}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-slate-700">
                    {entry.kod ? `${entry.kod} — ` : ''}
                    {entry.itemName ?? '—'}
                  </td>
                  <td className="py-1.5">
                    {shown.length === 0 && <span className="text-slate-400">—</span>}
                    {shown.map((c) => (
                      <span key={c.field} className="block text-xs">
                        <span className="text-slate-500">
                          {c.labelKey ? t(c.labelKey) : c.field}:
                        </span>{' '}
                        <span className="text-slate-400 line-through">{c.before}</span>
                        <span className="mx-1 text-slate-400">→</span>
                        <span className="font-medium text-slate-900">{c.after}</span>
                      </span>
                    ))}
                    {changes.length > shown.length && (
                      <span className="text-xs text-slate-400">
                        +{changes.length - shown.length}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {entries?.length === 0 && <p className="py-3 text-sm text-slate-500">{t('audit.empty')}</p>}
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
