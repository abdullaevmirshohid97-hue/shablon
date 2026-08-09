'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useInvoicePackages,
  usePackBatch,
  useSavePackage,
  useSkladBatches,
} from '@mubosher/api-client';
import type { SkladScannedInvoice } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';
import { PackageLabel } from '../../package-label';

const qty = new Intl.NumberFormat('ru-RU');

/**
 * The sacks this invoice will travel in.
 *
 * A thousand pieces packed fifty to a sack is twenty sacks, and the office
 * should not have to create twenty of anything by hand — it states the two
 * numbers and gets twenty labels. A sack holding several models is built one
 * line at a time instead, on the sack's own page.
 *
 * Packing does not touch stock. These goods are still in the warehouse until
 * the sacks are despatched, which is the only ordering under which the
 * remainder stays true while sacks sit on the floor overnight.
 */
export function InvoicePackages({
  orgId,
  invoice,
}: {
  orgId: string;
  invoice: SkladScannedInvoice;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const { data: packages } = useInvoicePackages(supabase, orgId, invoice.invoiceId);
  const { data: batches } = useSkladBatches(supabase, orgId);
  const packBatch = usePackBatch(supabase);
  const savePackage = useSavePackage(supabase);

  const [open, setOpen] = useState(false);
  const [batchId, setBatchId] = useState('');
  const [perQop, setPerQop] = useState('50');
  const [totalDona, setTotalDona] = useState('');
  const [kgPerQop, setKgPerQop] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<number | null>(null);

  // The lots this invoice's own products came from, first — a manager packing
  // an invoice is almost never reaching for an unrelated lot.
  const relevantBatches = useMemo(() => {
    const itemIds = new Set(invoice.lines.map((l) => l.itemId).filter(Boolean));
    const all = batches ?? [];
    const mine = all.filter((b) => itemIds.has(b.itemId));
    return mine.length ? mine : all;
  }, [batches, invoice.lines]);

  const totals = (packages ?? []).reduce(
    (acc, p) => ({
      dona: acc.dona + p.totalDona,
      shipped: acc.shipped + (p.status === 'jonatilgan' ? p.totalDona : 0),
    }),
    { dona: 0, shipped: 0 },
  );

  async function handlePack() {
    setError(null);
    setMade(null);
    if (!batchId) {
      setError(t('sotuv.pickBatch'));
      return;
    }
    try {
      const count = await packBatch.mutateAsync({
        orgId,
        batchId,
        perQop: Number(perQop),
        totalDona: totalDona ? Number(totalDona) : null,
        kgPerQop: kgPerQop ? Number(kgPerQop) : null,
        invoiceId: invoice.invoiceId,
      });
      setMade(count);
      setTotalDona('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleNewMixed() {
    setError(null);
    const first = invoice.lines.find((l) => l.itemId);
    if (!first?.itemId) {
      setError(t('sotuv.pickBatch'));
      return;
    }
    try {
      // Starts as one line of one piece; the sack's own page is where the rest
      // of the models get added, with room to see them.
      const id = await savePackage.mutateAsync({
        orgId,
        invoiceId: invoice.invoiceId,
        rows: [{ itemId: first.itemId, dona: '1' }],
      });
      router.push(`/hub/sotuv/qop/${id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Card className="p-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{t('sotuv.qopTitle')}</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {t('sotuv.qopSummary')
              .replace('{n}', String(packages?.length ?? 0))
              .replace('{dona}', qty.format(totals.dona))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={handleNewMixed}>
            + {t('sotuv.qopMixed')}
          </Button>
          <Button type="button" size="sm" onClick={() => setOpen((v) => !v)}>
            {t('sotuv.qopPack')}
          </Button>
        </div>
      </div>

      {open && (
        <div className="no-print mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Label>{t('sotuv.batch')}</Label>
              <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                <option value="">—</option>
                {relevantBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.itemName ?? b.itemKod ?? b.id.slice(0, 8)} — {b.qoldiqDona ?? 0}{' '}
                    {t('sklad.item.donaLabel')}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t('sotuv.perQop')}</Label>
              <Input
                type="number"
                min={1}
                value={perQop}
                onChange={(e) => setPerQop(e.target.value)}
                className="text-right tabular-nums"
              />
            </div>
            <div>
              <Label>{t('sotuv.totalDonaOptional')}</Label>
              <Input
                type="number"
                min={1}
                value={totalDona}
                onChange={(e) => setTotalDona(e.target.value)}
                className="text-right tabular-nums"
              />
            </div>
            <div>
              <Label>{t('sotuv.kgPerQop')}</Label>
              <Input
                type="number"
                step="0.001"
                value={kgPerQop}
                onChange={(e) => setKgPerQop(e.target.value)}
                className="text-right tabular-nums"
              />
            </div>
          </div>

          <p className="mt-2 text-xs leading-snug text-slate-500">{t('sotuv.packHint')}</p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={handlePack} disabled={packBatch.isPending}>
              {packBatch.isPending ? t('common.saving') : t('sotuv.packButton')}
            </Button>
            {made != null && (
              <span className="text-sm text-emerald-700">
                {t('sotuv.packed').replace('{n}', String(made))}
              </span>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {packages?.length ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((p) => (
              <div key={p.packageId} className="flex flex-col gap-1">
                <PackageLabel
                  pkg={p}
                  invoiceNo={invoice.invoiceNo}
                  counterpartyName={invoice.counterpartyName}
                />
                <div className="no-print flex items-center justify-between gap-2 px-1">
                  <Badge tone={p.status === 'jonatilgan' ? 'success' : 'neutral'}>
                    {t(`sotuv.status.${p.status}`)}
                  </Badge>
                  <Link
                    href={`/hub/sotuv/qop/${p.packageId}`}
                    className="text-xs font-medium text-slate-500 hover:text-brand-600 hover:underline"
                  >
                    {t('sotuv.openQop')} →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <p className="no-print mt-4 text-xs text-slate-500 tabular-nums">
            {t('sotuv.qopShipped')
              .replace('{shipped}', qty.format(totals.shipped))
              .replace('{total}', qty.format(totals.dona))}
            {' · '}
            {new Date(packages[0]!.packedAt).toLocaleDateString(dateLocale)}
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-500">{t('sotuv.qopEmptyList')}</p>
      )}
    </Card>
  );
}
