'use client';

import type { CurrencyTotalsRow } from '@mubosher/api-client';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { ToggleChip } from '@/components/ui/Badge';

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

/**
 * The book, currency by currency, with nothing converted.
 *
 * Every other figure on this dashboard is stated in the org's base currency,
 * because that is the only way to add a dollar entry to a sum entry. The cost
 * of that is a business holding dollar accounts never sees what those accounts
 * did — the conversion happens before anyone looks. This is the view without
 * it, and the figures across rows are deliberately not comparable: they are
 * different money.
 *
 * Not a pie chart. Three currencies are three amounts in three units; a pie
 * would ask the reader to compare slice areas of quantities that cannot be
 * added in the first place.
 */
export function CurrencyBreakdown({
  rows,
  selected,
  onSelect,
  baseCurrency,
  asOf = null,
  isLoading = false,
}: {
  rows: CurrencyTotalsRow[];
  /** null = the consolidated view, in base currency. */
  selected: string | null;
  onSelect: (currency: string | null) => void;
  baseCurrency: string;
  /** The date the debt figures are stated at — the period end, or today. */
  asOf?: string | null;
  isLoading?: boolean;
}) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const asOfLabel = `${new Date(asOf ?? Date.now()).toLocaleDateString(dateLocale)} ${t(
    'analytics.asOf',
  )}`;

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="mb-3 h-5 w-40 animate-pulse rounded bg-slate-100" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-50" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-fin-lg font-semibold text-slate-900">
          {t('analytics.byCurrencyTitle')}
        </h2>
        {/* The chips pick what the charts below are drawn from, not what this
            card shows — every currency stays listed either way. */}
        <div className="flex flex-wrap gap-1.5">
          <ToggleChip active={selected === null} onClick={() => onSelect(null)}>
            {t('analytics.consolidated').replace('{code}', baseCurrency)}
          </ToggleChip>
          {rows.map((row) => (
            <ToggleChip
              key={row.currency}
              active={selected === row.currency}
              onClick={() => onSelect(selected === row.currency ? null : row.currency)}
            >
              {row.currency}
            </ToggleChip>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-fin-md text-slate-500">{t('analytics.noData')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <div
              key={row.currency}
              className={`rounded-lg border p-3 transition-colors ${
                selected === row.currency
                  ? 'border-slate-400 bg-slate-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-fin-md font-semibold text-slate-900">{row.currency}</span>
                <span className="text-fin-xs text-slate-400">
                  {t('overview.clientCount')}: {row.counterpartyCount}
                </span>
              </div>

              <dl className="mt-2 space-y-1 text-fin-sm">
                <Line label={t('analytics.totalKirim')} value={row.totalKirim} tone="success" />
                <Line label={t('analytics.totalChiqim')} value={row.totalChiqim} tone="danger" />
                <div className="flex items-baseline justify-between gap-2 border-t border-slate-100 pt-1 font-semibold">
                  {/* A position, not a flow like the two above it — so it is
                      stated as of a date rather than "for the period", and the
                      date is the period's end when one is chosen. */}
                  <dt className="text-slate-600">
                    {t('analytics.totalDebt')}
                    <span className="ml-1 font-normal text-fin-xs text-slate-400">{asOfLabel}</span>
                  </dt>
                  <dd className="tabular-nums text-slate-900">{money.format(row.totalDebt)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Line({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'danger';
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`tabular-nums ${tone === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
        {money.format(value)}
      </dd>
    </div>
  );
}
