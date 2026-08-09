'use client';

import { useCallback, useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';

type Rate = {
  id: string;
  from_code: string;
  to_code: string;
  rate: number;
  effective_date: string;
};

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Rates are dated, and an entry is converted at the rate in force on *its
 * own* date — so a report run next year still shows what an entry was worth
 * when it happened, not what it would be worth today. Quoting one direction
 * is enough; the inverse is derived.
 */
export function ExchangeRates({ orgId, baseCurrency }: { orgId: string; baseCurrency: string }) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const [codes, setCodes] = useState<string[]>([]);
  const [rates, setRates] = useState<Rate[] | null>(null);
  const [fromCode, setFromCode] = useState('USD');
  const [rate, setRate] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: currencyRows }, { data: rateRows }] = await Promise.all([
      supabase.from('currencies').select('code').order('code'),
      supabase
        .from('exchange_rates')
        .select('id, from_code, to_code, rate, effective_date')
        .eq('org_id', orgId)
        .order('effective_date', { ascending: false })
        .limit(50),
    ]);
    setCodes((currencyRows ?? []).map((c) => c.code));
    setRates(rateRows ?? []);
  }, [supabase, orgId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSaving(true);

    const { error } = await supabase.from('exchange_rates').upsert(
      {
        org_id: orgId,
        from_code: fromCode,
        to_code: baseCurrency,
        rate: Number(rate),
        effective_date: effectiveDate,
      },
      { onConflict: 'org_id,from_code,to_code,effective_date' },
    );

    setSaving(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setRate('');
    await load();
  }

  return (
    <Card className="p-4">
      <h2 className="text-fin-lg font-semibold text-slate-900">{t('rates.title')}</h2>
      <p className="mt-1 text-fin-md text-slate-500">
        {t('rates.description')} ({t('rates.baseCurrency')}: {baseCurrency})
      </p>

      <form onSubmit={handleSave} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <Label>{t('rates.currency')}</Label>
          <Select value={fromCode} onChange={(e) => setFromCode(e.target.value)}>
            {codes
              .filter((c) => c !== baseCurrency)
              .map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
          </Select>
        </div>
        <div>
          <Label>
            1 {fromCode} = ? {baseCurrency}
          </Label>
          <Input
            type="number"
            step="any"
            required
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="tabular-nums"
          />
        </div>
        <div>
          <Label>{t('rates.effectiveDate')}</Label>
          <Input
            type="date"
            required
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={saving || !rate} className="w-full">
            {t('rates.save')}
          </Button>
        </div>
        {errorMessage && <p className="text-fin-md text-rose-600 sm:col-span-4">{errorMessage}</p>}
      </form>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-fin-md">
          <thead>
            <tr className="border-b border-slate-200 text-left text-fin-sm text-slate-500">
              <th className="py-1.5 pr-3 font-medium">{t('rates.effectiveDate')}</th>
              <th className="py-1.5 pr-3 font-medium">{t('rates.pair')}</th>
              <th className="py-1.5 text-right font-medium">{t('rates.rate')}</th>
            </tr>
          </thead>
          <tbody>
            {rates?.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="py-1.5 pr-3 tabular-nums text-slate-600">
                  {new Date(r.effective_date).toLocaleDateString(dateLocale)}
                </td>
                <td className="py-1.5 pr-3 text-slate-900">
                  {r.from_code} → {r.to_code}
                </td>
                <td className="py-1.5 text-right tabular-nums">{r.rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rates?.length === 0 && (
          <p className="py-3 text-fin-md text-slate-500">{t('rates.empty')}</p>
        )}
      </div>
    </Card>
  );
}
