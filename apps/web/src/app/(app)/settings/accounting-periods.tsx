'use client';

import { useCallback, useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { useOrgRole } from '@/lib/auth/OrgRoleProvider';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';

const currencyFormatter = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0 });

type Period = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: 'open' | 'closed';
  closed_at: string | null;
  closed_by_name: string | null;
  entry_count: number;
  draft_count: number;
  total_kirim: number;
  total_chiqim: number;
};

/**
 * Closing a month freezes it: nothing can be posted into, moved into, or
 * moved out of it afterwards. That is what stops last month's reported
 * figures from quietly changing when someone back-dates an entry.
 *
 * Closing runs oldest-first and reopening newest-first, both enforced in the
 * database — a month reported as final must not sit on top of an earlier one
 * that is still movable.
 */
export function AccountingPeriods({ orgId }: { orgId: string }) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const { role } = useOrgRole();
  const isOwner = role === 'owner';

  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [year, setYear] = useState(new Date().getFullYear());
  const [periods, setPeriods] = useState<Period[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_accounting_periods', {
      target_org_id: orgId,
      p_year: year,
    });
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setPeriods(data ?? []);
  }, [supabase, orgId, year]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: 'generate' | 'close' | 'reopen', periodId?: string) {
    setErrorMessage(null);
    setBusyId(periodId ?? 'generate');

    const { error } =
      action === 'generate'
        ? await supabase.rpc('generate_accounting_periods', {
            target_org_id: orgId,
            p_year: year,
          })
        : action === 'close'
          ? await supabase.rpc('close_accounting_period', { p_period_id: periodId! })
          : await supabase.rpc('reopen_accounting_period', { p_period_id: periodId! });

    setBusyId(null);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await load();
  }

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-fin-lg font-semibold text-slate-900">{t('periods.title')}</h2>
          <p className="mt-1 text-fin-md text-slate-500">{t('periods.description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-auto"
            aria-label={t('periods.year')}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busyId === 'generate'}
            onClick={() => run('generate')}
          >
            {t('periods.generate')}
          </Button>
        </div>
      </div>

      {errorMessage && <p className="mt-3 text-fin-md text-rose-600">{errorMessage}</p>}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-fin-md">
          <thead>
            <tr className="border-b border-slate-200 text-left text-fin-sm text-slate-500">
              <th className="py-1.5 pr-3 font-medium">{t('periods.period')}</th>
              <th className="py-1.5 pr-3 font-medium">{t('periods.status')}</th>
              <th className="py-1.5 pr-3 text-right font-medium">{t('export.entryCount')}</th>
              <th className="py-1.5 pr-3 text-right font-medium">{t('analytics.totalKirim')}</th>
              <th className="py-1.5 pr-3 text-right font-medium">{t('analytics.totalChiqim')}</th>
              <th className="py-1.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {periods?.map((p) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="py-1.5 pr-3 font-medium text-slate-900">{p.name}</td>
                <td className="py-1.5 pr-3">
                  <Badge tone={p.status === 'closed' ? 'neutral' : 'success'}>
                    {t(p.status === 'closed' ? 'periods.closed' : 'periods.open')}
                  </Badge>
                  {p.closed_by_name && (
                    <span className="ml-1.5 text-fin-sm text-slate-400">
                      {p.closed_by_name}
                      {p.closed_at && `, ${new Date(p.closed_at).toLocaleDateString(dateLocale)}`}
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {p.entry_count}
                  {p.draft_count > 0 && (
                    <span className="ml-1 text-fin-sm text-amber-600">
                      (+{p.draft_count} {t('periods.drafts')})
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-emerald-700">
                  {currencyFormatter.format(p.total_kirim)}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-rose-700">
                  {currencyFormatter.format(p.total_chiqim)}
                </td>
                <td className="py-1.5 text-right">
                  {p.status === 'open' ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busyId === p.id}
                      onClick={() => run('close', p.id)}
                    >
                      {t('periods.close')}
                    </Button>
                  ) : (
                    // Reopening makes finalised figures movable again — the
                    // one action here with no audit-safe undo, so it is the
                    // owner's call, enforced in the database too.
                    isOwner && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyId === p.id}
                        onClick={() => run('reopen', p.id)}
                      >
                        {t('periods.reopen')}
                      </Button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {periods?.length === 0 && (
          <p className="py-3 text-fin-md text-slate-500">{t('periods.empty')}</p>
        )}
      </div>
    </Card>
  );
}
