'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import type { SkladPackageSummary } from '@mubosher/shared';

/**
 * The label that goes on the sack.
 *
 * Three things, in the order somebody standing at a pallet needs them:
 *
 *   the QR, which a phone camera resolves to this sack's own page and its
 *   contents — the answer to "what is in this one" without opening it;
 *
 *   the contents in words, because the answer must survive a flat battery and
 *   a warehouse with no signal;
 *
 *   the barcode, which the wired scanner at the despatch desk reads to put
 *   this sack on a despatch without anybody typing.
 *
 * Black on white, always. A scanner reads contrast, and a printer that drops
 * background colours would otherwise ruin the one thing on the sheet that has
 * to work.
 */
export function PackageLabel({
  pkg,
  invoiceNo,
  counterpartyName,
  className = '',
}: {
  pkg: SkladPackageSummary;
  invoiceNo?: string | null;
  counterpartyName?: string | null;
  className?: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    // The origin is read at render rather than baked in: the same build serves
    // two domains, and a QR pointing at the wrong one is worse than no QR.
    const target = `${window.location.origin}/hub/sotuv/qop/${pkg.packageId}`;
    let active = true;
    void QRCode.toDataURL(target, { margin: 1, width: 320, errorCorrectionLevel: 'M' }).then(
      (result) => {
        if (active) setQrDataUrl(result);
      },
    );
    return () => {
      active = false;
    };
  }, [pkg.packageId]);

  useEffect(() => {
    if (!barcodeRef.current || !pkg.barcode) return;
    JsBarcode(barcodeRef.current, pkg.barcode, {
      format: 'CODE128',
      displayValue: true,
      fontSize: 12,
      height: 36,
      margin: 2,
      lineColor: '#000000',
      background: '#ffffff',
    });
  }, [pkg.barcode]);

  return (
    <div
      className={`flex break-inside-avoid flex-col gap-2 rounded-lg border border-slate-300 bg-white p-3 ${className}`}
    >
      <div className="flex items-start gap-3">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="QR" className="h-20 w-20 shrink-0" />
        ) : (
          <div className="h-20 w-20 shrink-0 animate-pulse rounded bg-slate-100" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold tracking-tight text-slate-900">
            {pkg.code ?? '—'}
          </p>
          {counterpartyName && (
            <p className="truncate text-xs text-slate-600">{counterpartyName}</p>
          )}
          {invoiceNo && <p className="truncate text-xs text-slate-500">{invoiceNo}</p>}
          <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
            {pkg.totalDona} dona
            {pkg.totalKg ? ` · ${pkg.totalKg} kg` : ''}
          </p>
        </div>
      </div>

      {pkg.contents && (
        <p className="border-t border-slate-200 pt-1.5 text-xs leading-snug text-slate-700">
          {pkg.contents}
        </p>
      )}

      {pkg.barcode && <svg ref={barcodeRef} className="h-14 w-full" />}
    </div>
  );
}
