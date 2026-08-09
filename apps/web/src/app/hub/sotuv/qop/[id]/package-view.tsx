'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useDeletePackage,
  useSavePackage,
  useSkladItems,
  useSkladPackage,
} from '@mubosher/api-client';
import { formatSize, type SkladPackageRow } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';
import { PackageLabel } from '../../package-label';
import { PrintButton } from '../../../document-codes';

const qty = new Intl.NumberFormat('ru-RU');

/**
 * One sack, as its QR opens it.
 *
 * Read on a phone at the pallet, so what is inside comes first and the
 * paperwork second. It stays editable — five models packed into one sack is
 * exactly the case somebody gets wrong on the first pass — right up until the
 * sack ships, at which point its contents are a stock movement that has
 * already happened and the database refuses the change.
 */
export function PackageView({ orgId, code }: { orgId: string; code: string }) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const { data: pkg, isLoading } = useSkladPackage(supabase, orgId, code);
  const { data: items } = useSkladItems(supabase, orgId);
  const savePackage = useSavePackage(supabase);
  const deletePackage = useDeletePackage(supabase);

  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<SkladPackageRow[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // The draft is seeded from the saved sack whenever editing opens, so
  // cancelling is simply closing it — no half-applied state to unwind.
  useEffect(() => {
    if (!editing || !pkg) return;
    setRows(
      pkg.lines.map((l) => ({
        itemId: l.itemId,
        batchId: l.batchId,
        dona: String(l.dona),
        kg: l.kg == null ? '' : String(l.kg),
      })),
    );
    setNote(pkg.note ?? '');
  }, [editing, pkg]);

  if (isLoading) return <p className="py-6 text-sm text-slate-500">{t('common.loading')}</p>;
  if (!pkg) return <p className="py-6 text-sm text-slate-500">{t('sotuv.qopNotFound')}</p>;

  const shipped = pkg.status === 'jonatilgan';
  const totalDona = pkg.lines.reduce((sum, l) => sum + l.dona, 0);
  const totalKg = pkg.lines.reduce((sum, l) => sum + (l.kg ?? 0), 0);

  async function handleSave() {
    setError(null);
    try {
      await savePackage.mutateAsync({
        orgId,
        packageId: pkg!.packageId,
        invoiceId: pkg!.invoiceId ?? null,
        rows: rows.filter((r) => r.itemId && Number(r.dona) > 0),
        note: note.trim() || null,
      });
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('sotuv.deleteConfirm'))) return;
    setError(null);
    try {
      await deletePackage.mutateAsync({ orgId, packageId: pkg!.packageId });
      router.push(pkg!.invoiceId ? `/hub/sotuv/faktura/${pkg!.invoiceId}` : '/hub/sotuv');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          href={pkg.invoiceId ? `/hub/sotuv/faktura/${pkg.invoiceId}` : '/hub/sotuv'}
          className="text-sm text-slate-500 hover:text-brand-600"
        >
          ← {pkg.invoiceNo ?? t('sotuv.clientsTitle')}
        </Link>
        <div className="flex items-center gap-2">
          {!shipped && !editing && (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>
                {t('common.edit')}
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleDelete}
                disabled={deletePackage.isPending}
              >
                {t('common.delete')}
              </Button>
            </>
          )}
          <PrintButton label={t('sotuv.printLabel')} />
        </div>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {pkg.code ?? '—'}
            </h1>
            <p className="mt-1 text-sm text-slate-500 tabular-nums">
              {new Date(pkg.packedAt).toLocaleDateString(dateLocale)}
              {pkg.packedByName ? ` · ${pkg.packedByName}` : ''}
            </p>
            {pkg.counterpartyName && (
              <p className="mt-2 text-base font-medium text-slate-900">{pkg.counterpartyName}</p>
            )}
            {pkg.invoiceId && (
              <Link
                href={`/hub/sotuv/faktura/${pkg.invoiceId}`}
                className="text-sm text-slate-500 hover:text-brand-600 hover:underline"
              >
                {pkg.invoiceNo ?? t('sklad.faktura.title')}
              </Link>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone={shipped ? 'success' : 'neutral'}>
                {t(`sotuv.status.${pkg.status}`)}
              </Badge>
              <span className="text-sm font-semibold tabular-nums text-slate-900">
                {qty.format(totalDona)} {t('sklad.item.donaLabel')}
              </span>
              {totalKg > 0 && (
                <span className="text-sm tabular-nums text-slate-500">{totalKg} kg</span>
              )}
            </div>
          </div>

          <PackageLabel
            className="w-72 shrink-0"
            invoiceNo={pkg.invoiceNo}
            counterpartyName={pkg.counterpartyName}
            pkg={{
              packageId: pkg.packageId,
              code: pkg.code,
              barcode: pkg.barcode,
              status: pkg.status,
              packedAt: pkg.packedAt,
              grossKg: pkg.grossKg,
              note: pkg.note,
              shipmentId: pkg.shipmentId,
              totalDona,
              totalKg: totalKg || null,
              lineCount: pkg.lines.length,
              contents: pkg.lines
                .map(
                  (l) =>
                    `${l.itemName ?? l.kod ?? '?'}${l.colorName ? ` / ${l.colorName}` : ''} × ${l.dona}`,
                )
                .join(', '),
            }}
          />
        </div>

        {pkg.note && <p className="mt-4 text-sm text-slate-600">{pkg.note}</p>}

        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium">{t('sotuv.itemBarcode')}</th>
                <th className="py-2 pr-3 font-medium">{t('sklad.item.nameLabel')}</th>
                <th className="py-2 pr-3 font-medium">{t('sklad.item.sizeLabel')}</th>
                <th className="py-2 pr-3 font-medium">{t('sklad.item.colorLabel')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('sklad.item.donaLabel')}</th>
                <th className="py-2 text-right font-medium">{t('sklad.item.kgLabel')}</th>
              </tr>
            </thead>
            <tbody>
              {pkg.lines.map((line) => (
                <tr key={line.lineId} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-mono text-xs tabular-nums text-slate-500">
                    {line.itemBarcode ?? '—'}
                  </td>
                  <td className="py-2 pr-3 font-medium text-slate-900">
                    {line.itemName ?? line.kod ?? '—'}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {formatSize(line.widthCm, line.lengthCm)}
                  </td>
                  <td className="py-2 pr-3">{line.colorName ?? '—'}</td>
                  <td className="py-2 pr-3 text-right font-semibold tabular-nums">
                    {qty.format(line.dona)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-500">{line.kg ?? '—'}</td>
                </tr>
              ))}
              {!pkg.lines.length && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
                    {t('sotuv.qopEmpty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <Card className="no-print p-5">
          <h2 className="text-base font-semibold text-slate-900">{t('sotuv.editContents')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('sotuv.mixedHint')}</p>

          <div className="mt-4 flex flex-col gap-2">
            {rows.map((row, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2">
                <div className="min-w-[220px] flex-1">
                  <Label>{t('sklad.item.nameLabel')}</Label>
                  <Select
                    value={row.itemId}
                    onChange={(e) =>
                      setRows((r) =>
                        r.map((x, i) =>
                          i === index ? { ...x, itemId: e.target.value, batchId: null } : x,
                        ),
                      )
                    }
                  >
                    <option value="">—</option>
                    {(items ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {item.kod ? ` (${item.kod})` : ''}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="w-28">
                  <Label>{t('sklad.item.donaLabel')}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={row.dona}
                    onChange={(e) =>
                      setRows((r) =>
                        r.map((x, i) => (i === index ? { ...x, dona: e.target.value } : x)),
                      )
                    }
                    className="text-right tabular-nums"
                  />
                </div>
                <div className="w-28">
                  <Label>{t('sklad.item.kgLabel')}</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={row.kg ?? ''}
                    onChange={(e) =>
                      setRows((r) =>
                        r.map((x, i) => (i === index ? { ...x, kg: e.target.value } : x)),
                      )
                    }
                    className="text-right tabular-nums"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setRows((r) => r.filter((_, i) => i !== index))}
                >
                  ✕
                </Button>
              </div>
            ))}

            <div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setRows((r) => [...r, { itemId: '', dona: '', kg: '' }])}
              >
                + {t('sotuv.addItem')}
              </Button>
            </div>

            <div className="mt-2">
              <Label>{t('sotuv.note')}</Label>
              <Input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

          <div className="mt-4 flex items-center gap-2">
            <Button type="button" onClick={handleSave} disabled={savePackage.isPending}>
              {savePackage.isPending ? t('common.saving') : t('common.save')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
