'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

/**
 * The two codes a warehouse document carries.
 *
 * They are read by different things, which is why there are two. A phone
 * camera reads the QR and lands on the document itself — useful for a manager
 * checking on a sale from the floor. The wired scanner on the despatch desk
 * reads the barcode and types it into whatever field has focus, which is how
 * the storekeeper pulls the invoice up without touching a keyboard.
 *
 * Both are rendered client-side from strings this component is handed; nothing
 * is fetched, so the printed sheet is identical to what is on screen.
 */
export function DocumentCodes({
  /** Numeric code for the 1D barcode — what the desk scanner reads. */
  barcode,
  /** Path the QR should open, e.g. /hub/sklad/faktura/<id>. */
  path,
  className = '',
}: {
  barcode?: string | null;
  path: string;
  className?: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    // The origin is read at render rather than baked in: the same build serves
    // two domains, and a QR pointing at the wrong one is worse than no QR.
    const target = `${window.location.origin}${path}`;
    let active = true;
    void QRCode.toDataURL(target, { margin: 1, width: 320, errorCorrectionLevel: 'M' }).then(
      (result) => {
        if (active) setQrDataUrl(result);
      },
    );
    return () => {
      active = false;
    };
  }, [path]);

  useEffect(() => {
    if (!barcodeRef.current || !barcode) return;
    JsBarcode(barcodeRef.current, barcode, {
      format: 'CODE128',
      displayValue: true,
      fontSize: 13,
      height: 48,
      margin: 4,
      // Black on white regardless of theme: a scanner reads contrast, and a
      // printer that drops background colours would otherwise ruin it.
      lineColor: '#000000',
      background: '#ffffff',
    });
  }, [barcode]);

  return (
    <div className={`flex items-start gap-4 ${className}`}>
      {qrDataUrl ? (
        <img src={qrDataUrl} alt="QR" className="h-24 w-24 shrink-0" />
      ) : (
        <div className="h-24 w-24 shrink-0 animate-pulse rounded bg-slate-100" />
      )}
      {barcode && <svg ref={barcodeRef} className="h-24" />}
    </div>
  );
}

/** Prints the page. Chrome (sidebar, buttons) is hidden by `no-print` in
 * globals.css, so what comes out is the document and nothing else. */
export function PrintButton({ label, className = '' }: { label: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`no-print rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${className}`}
    >
      {label}
    </button>
  );
}
