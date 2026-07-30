'use client';

import { useEffect, useState } from 'react';
import { useLocale } from '@/lib/i18n/LocaleProvider';

/**
 * Only ever visible in the print/PDF output (see `.print-only` in globals.css).
 * A journal printed straight from the browser used to arrive as an unlabeled
 * grid of numbers; this puts the client, the period and the print timestamp on
 * the page so the PDF is self-describing after it's been forwarded on.
 */
export function PrintHeader({
  title,
  subtitle,
  period,
}: {
  title: string;
  subtitle?: string | null;
  period?: string | null;
}) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';

  // Resolved after mount: rendering `new Date()` during SSR would make the
  // server and client markup disagree.
  const [printedAt, setPrintedAt] = useState<string | null>(null);
  useEffect(() => {
    setPrintedAt(new Date().toLocaleString(dateLocale));
  }, [dateLocale]);

  return (
    <div className="print-only mb-3 border-b border-slate-300 pb-2">
      <h1 className="text-base font-bold text-slate-900">{title}</h1>
      {subtitle && <p className="text-xs text-slate-600">{subtitle}</p>}
      <p className="text-[10px] text-slate-500">
        {period && (
          <>
            {t('export.period')}: {period}
          </>
        )}
        {period && printedAt && '   •   '}
        {printedAt && (
          <>
            {t('export.generatedAt')}: {printedAt}
          </>
        )}
      </p>
    </div>
  );
}
