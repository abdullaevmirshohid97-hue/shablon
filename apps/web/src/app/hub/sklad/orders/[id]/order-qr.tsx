'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Button } from '@/components/ui/Button';

/**
 * The order's QR code — a printable label for the travelling paperwork.
 *
 * It encodes the absolute address of this page, so scanning it on the shop
 * floor opens the order itself rather than yielding a number someone then has
 * to search for. The link is not a secret: it lands on the normal page, which
 * still requires signing in, so a label left on a pallet gives away nothing.
 *
 * The origin is read at render rather than baked in, because the same build
 * serves two domains.
 */
export function OrderQr({ orderId, label }: { orderId: string; label: string }) {
  const { t } = useLocale();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [url, setUrl] = useState('');

  useEffect(() => {
    const target = `${window.location.origin}/hub/sklad/orders/${orderId}`;
    setUrl(target);

    let active = true;
    void QRCode.toDataURL(target, { margin: 1, width: 320, errorCorrectionLevel: 'M' }).then(
      (result) => {
        if (active) setDataUrl(result);
      },
    );
    return () => {
      active = false;
    };
  }, [orderId]);

  function handlePrint() {
    const win = window.open('', '_blank', 'width=420,height=560');
    if (!win || !dataUrl) return;
    // A self-contained document: the print window has no access to the app's
    // stylesheet, and a label is three elements anyway.
    win.document.write(
      `<!doctype html><html><head><title>${label}</title></head>` +
        `<body style="font-family:system-ui,sans-serif;text-align:center;padding:24px">` +
        `<h2 style="font-size:18px;margin:0 0 4px">${label}</h2>` +
        `<p style="font-size:12px;color:#64748b;margin:0 0 16px">${url}</p>` +
        `<img src="${dataUrl}" alt="QR" style="width:280px;height:280px" />` +
        `</body></html>`,
    );
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 p-3">
      {dataUrl ? (
        // A generated data: URI — next/image would only wrap a loader around a
        // string this component just produced in memory.
        <img src={dataUrl} alt={t('sklad.order.qrAlt')} className="h-32 w-32" />
      ) : (
        <div className="h-32 w-32 animate-pulse rounded bg-slate-100" />
      )}
      <Button type="button" variant="secondary" size="sm" onClick={handlePrint}>
        {t('sklad.order.qrPrint')}
      </Button>
    </div>
  );
}
