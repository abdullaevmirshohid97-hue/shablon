'use client';

import { amountInWords, currencyWords, type CounterpartyStatement } from '@mubosher/shared';
import { useLocale } from '@/lib/i18n/LocaleProvider';

const money = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 });

/**
 * The reconciliation act — akt sverki — printed for a client to sign.
 *
 * It is not another view of the ledger. It is the document that settles an
 * argument: two parties put their own figure for the same period side by side,
 * and whoever disagrees writes theirs in the empty column. That empty column is
 * the whole point, which is why the client's side is left blank rather than
 * filled in with our numbers.
 *
 * Everything here comes from the same `buildStatement` the screen and the Excel
 * file read, so an act cannot state a balance the ledger behind it denies.
 */
export function ReconciliationAct({
  orgName,
  counterpartyName,
  statement,
  baseCurrency,
  periodLabel,
}: {
  orgName: string | null;
  counterpartyName: string;
  statement: CounterpartyStatement;
  baseCurrency: string;
  periodLabel: string;
}) {
  const { t, locale } = useLocale();
  const us = orgName ?? t('act.ourSideFallback');

  const asOf = new Date(statement.asOf).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'uz-UZ');
  const owesUs = statement.closingBalance >= 0;
  const closing = Math.abs(statement.closingBalance);

  const rows: { label: string; value: number; strong?: boolean }[] = [
    { label: t('export.openingBalance'), value: statement.openingBalance },
    { label: t('export.debitTurnover'), value: statement.debitTurnover },
    { label: t('export.creditTurnover'), value: statement.creditTurnover },
    { label: t('export.closingBalance'), value: statement.closingBalance, strong: true },
  ];

  return (
    <section className="print-only print-block">
      <header className="mb-4 text-center">
        <h1 className="text-fin-lg font-bold uppercase tracking-wide text-slate-900">
          {t('act.title')}
        </h1>
        <p className="mt-1 text-fin-sm text-slate-600">
          {t('act.subtitle').replace('{period}', periodLabel)}
        </p>
        <p className="text-fin-xs text-slate-500">
          {t('export.generatedAt')}: {asOf} · {t('export.baseCurrency')}: {baseCurrency}
        </p>
      </header>

      <p className="mb-4 text-fin leading-relaxed text-slate-800">
        {t('act.preamble')
          .replace('{org}', us)
          .replace('{client}', counterpartyName)
          .replace('{period}', periodLabel)}
      </p>

      <table className="mb-4 w-full border-collapse text-fin">
        <thead>
          <tr className="bg-slate-100 text-left">
            <th className="border border-slate-300 px-3 py-2 font-semibold">
              {t('act.indicator')}
            </th>
            <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
              {t('act.ourData').replace('{org}', us)}
            </th>
            <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
              {t('act.theirData').replace('{client}', counterpartyName)}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className={row.strong ? 'bg-slate-50 font-semibold' : ''}>
              <td className="border border-slate-300 px-3 py-2">{row.label}</td>
              <td className="border border-slate-300 px-3 py-2 text-right tabular-nums">
                {row.value < 0 ? '−' : ''}
                {money.format(Math.abs(row.value))}
              </td>
              {/* Left empty on purpose: this is the column the client fills in. */}
              <td className="border border-slate-300 px-3 py-2" />
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mb-1 text-fin leading-relaxed text-slate-900">
        {t(owesUs ? 'act.conclusionOwesUs' : 'act.conclusionWeOwe')
          .replace('{date}', asOf)
          .replace('{org}', us)
          .replace('{client}', counterpartyName)
          .replace('{amount}', `${money.format(closing)} ${baseCurrency}`)}
      </p>
      <p className="mb-4 text-fin-sm italic text-slate-600">
        {amountInWords(closing, locale, currencyWords(baseCurrency, locale))}
      </p>

      <p className="mb-4 text-fin-sm leading-relaxed text-slate-600">{t('act.disagreement')}</p>
    </section>
  );
}
