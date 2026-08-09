'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useIssuePackages, useSkladPackage, useSkladScan } from '@mubosher/api-client';
import type { SkladPackage, SkladScanHit } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';

const qty = new Intl.NumberFormat('ru-RU');

/** A sack that has been scanned onto this despatch. */
interface Loaded {
  packageId: string;
  code?: string | null;
  contents?: string | null;
  dona: number;
}

/**
 * The despatch desk: one box, anything scanned into it.
 *
 * A wired scanner types digits and presses Enter — it cannot choose a tab, and
 * the person holding it has both hands full. So there is one field, always
 * focused, and the database says what arrived:
 *
 *   an invoice  → this is the sale we are loading; its client is now the
 *                 despatch's client
 *   a sack      → put it on the lorry
 *   a product   → not loadable on its own, but it names the model and, if one
 *                 is open, the invoice waiting for it — which is how a barcode
 *                 scan finds the client without anybody typing a name
 *
 * Confirming writes the despatch, the stock movements and the sacks' new state
 * in one call. Half a despatch is not a state this desk can be left in.
 */
export function ScanDesk({ orgId }: { orgId: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const scan = useSkladScan(supabase);
  const issue = useIssuePackages(supabase);

  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [hit, setHit] = useState<SkladScanHit | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [invoice, setInvoice] = useState<{ id: string; label: string; client: string } | null>(
    null,
  );
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [carrier, setCarrier] = useState('');
  const [trackingNo, setTrackingNo] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // The scanned sack is fetched by the same lookup its QR uses, so a sack put
  // on the lorry here and a sack opened on a phone are the same record.
  const [pendingCode, setPendingCode] = useState<string | undefined>();
  const { data: pending } = useSkladPackage(supabase, orgId, pendingCode);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!pending) return;
    addPackage(pending);
    setPendingCode(undefined);
    // addPackage is defined in this closure and depends only on setState
    // setters, which React guarantees are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  function addPackage(pkg: SkladPackage) {
    if (pkg.status === 'jonatilgan') {
      setError(t('sotuv.qopAlreadyShipped').replace('{code}', pkg.code ?? ''));
      return;
    }
    setLoaded((rows) => {
      if (rows.some((r) => r.packageId === pkg.packageId)) return rows;
      return [
        ...rows,
        {
          packageId: pkg.packageId,
          code: pkg.code,
          dona: pkg.lines.reduce((sum, l) => sum + l.dona, 0),
          contents: pkg.lines
            .map(
              (l) =>
                `${l.itemName ?? l.kod ?? '?'}${l.colorName ? ` / ${l.colorName}` : ''} × ${l.dona}`,
            )
            .join(', '),
        },
      ];
    });
    if (pkg.invoiceId && !invoice) {
      setInvoice({
        id: pkg.invoiceId,
        label: pkg.invoiceNo ?? '',
        client: pkg.counterpartyName ?? '',
      });
    }
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const value = code.trim();
    if (!value) return;
    setError(null);
    setNotFound(false);
    setCode('');

    try {
      const result = await scan.mutateAsync({ orgId, code: value });
      setHit(result);
      if (!result) {
        setNotFound(true);
        return;
      }

      if (result.kind === 'faktura') {
        setInvoice({
          id: result.id,
          label: result.code ?? '',
          client: result.counterpartyName ?? result.label ?? '',
        });
        return;
      }

      if (result.kind === 'qop') {
        // Loading the full sack gives its lines, which is what the list shows.
        setPendingCode(result.id);
        return;
      }

      // A product scan: names the model, and points at the invoice waiting for
      // it if there is one. It does not load anything by itself — goods leave
      // this building in sacks.
      if (result.kind === 'mahsulot' && result.invoiceId && !invoice) {
        setInvoice({
          id: result.invoiceId,
          label: '',
          client: result.counterpartyName ?? '',
        });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      inputRef.current?.focus();
    }
  }

  async function handleConfirm() {
    setError(null);
    if (!loaded.length) {
      setError(t('sotuv.nothingLoaded'));
      return;
    }
    try {
      const shipmentId = await issue.mutateAsync({
        orgId,
        packageIds: loaded.map((r) => r.packageId),
        invoiceId: invoice?.id ?? null,
        carrier: carrier.trim() || null,
        trackingNo: trackingNo.trim() || null,
        note: note.trim() || null,
      });
      router.push(`/hub/sotuv/chiqim/${shipmentId}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const totalDona = loaded.reduce((sum, r) => sum + r.dona, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t('sotuv.scanTitle')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('sotuv.scanDescription')}</p>
      </div>

      <Card className="p-5">
        <form onSubmit={handleScan} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <Label>{t('sotuv.scanLabel')}</Label>
            <Input
              ref={inputRef}
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('sotuv.scanPlaceholder')}
              autoComplete="off"
              className="font-mono"
            />
          </div>
          <Button type="submit" disabled={scan.isPending}>
            {scan.isPending ? t('sotuv.scanning') : t('sotuv.scanButton')}
          </Button>
        </form>

        {notFound && <p className="mt-3 text-sm text-rose-600">{t('sotuv.notFound')}</p>}

        {hit && !notFound && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <Badge tone="brand">{t(`sotuv.kind.${hit.kind}`)}</Badge>
            <span className="text-sm font-medium text-slate-900">{hit.label || hit.code}</span>
            {hit.detail && <span className="text-sm text-slate-500">{hit.detail}</span>}
            {hit.kind === 'mahsulot' && (
              <span className="text-sm tabular-nums text-slate-500">
                {t('sotuv.inStock').replace('{n}', qty.format(hit.availableDona ?? 0))}
              </span>
            )}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{t('sotuv.despatch')}</h2>
            {invoice ? (
              <p className="mt-0.5 text-sm text-slate-600">
                <span className="font-medium text-slate-900">{invoice.client}</span>
                {invoice.label ? ` · ${invoice.label}` : ''}
                {' · '}
                <Link
                  href={`/hub/sotuv/faktura/${invoice.id}`}
                  className="text-slate-500 hover:text-brand-600 hover:underline"
                >
                  {t('sotuv.openInvoice')}
                </Link>
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-slate-500">{t('sotuv.noInvoiceYet')}</p>
            )}
          </div>
          <p className="text-sm font-semibold tabular-nums text-slate-900">
            {loaded.length} {t('sotuv.qopShort')} · {qty.format(totalDona)}{' '}
            {t('sklad.item.donaLabel')}
          </p>
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          {loaded.map((row) => (
            <li
              key={row.packageId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
            >
              <div className="min-w-0">
                <Link
                  href={`/hub/sotuv/qop/${row.packageId}`}
                  className="font-medium text-slate-900 hover:text-brand-600 hover:underline"
                >
                  {row.code}
                </Link>
                {row.contents && <p className="text-xs text-slate-500">{row.contents}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">{qty.format(row.dona)}</span>
                <button
                  type="button"
                  onClick={() =>
                    setLoaded((rows) => rows.filter((r) => r.packageId !== row.packageId))
                  }
                  className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-rose-600"
                >
                  {t('common.delete')}
                </button>
              </div>
            </li>
          ))}
          {!loaded.length && (
            <li className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
              {t('sotuv.scanSacksHint')}
            </li>
          )}
        </ul>

        {/* Who carried it. The sale is not finished when the paper is signed,
            it is finished when somebody took the goods away. */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label>{t('sotuv.carrier')}</Label>
            <Input
              type="text"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder={t('sotuv.carrierPlaceholder')}
            />
          </div>
          <div>
            <Label>{t('sotuv.trackingNo')}</Label>
            <Input
              type="text"
              value={trackingNo}
              onChange={(e) => setTrackingNo(e.target.value)}
              className="font-mono"
            />
          </div>
          <div>
            <Label>{t('sotuv.note')}</Label>
            <Input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="success"
            onClick={handleConfirm}
            disabled={issue.isPending || !loaded.length}
          >
            {issue.isPending ? t('common.saving') : t('sotuv.confirmSale')}
          </Button>
          <p className="text-xs leading-snug text-slate-500">{t('sotuv.confirmHint')}</p>
        </div>
      </Card>
    </div>
  );
}
