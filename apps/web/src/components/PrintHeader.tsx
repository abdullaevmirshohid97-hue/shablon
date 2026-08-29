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
  baseCurrency,
}: {
  title: string;
  subtitle?: string | null;
  period?: string | null;
  /** Named on the page, because every figure below it is stated in this currency. */
  baseCurrency?: string | null;
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
      <h1 className="text-fin-lg font-bold text-slate-900">{title}</h1>
      {subtitle && <p className="text-fin-sm text-slate-600">{subtitle}</p>}
      <p className="text-fin-xs text-slate-500">
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
        {baseCurrency && (
          <>
            {'   •   '}
            {t('export.baseCurrency')}: {baseCurrency}
          </>
        )}
      </p>
    </div>
  );
}

/**
 * The block that turns a printed statement into a document someone can sign.
 *
 * A ledger printed for a client to agree with — an akt sverki, in the words
 * everyone here uses for it — is worthless without somewhere to put the two
 * signatures and the stamp, and adding those by hand to every printout is how
 * it was being done.
 */
export function PrintSignatures({ counterpartyName }: { counterpartyName?: string | null }) {
  const { t } = useLocale();

  return (
    <div className="print-only print-block mt-6 border-t border-slate-300 pt-3">
      <p className="mb-3 text-fin-sm font-semibold text-slate-700">{t('print.signaturesTitle')}</p>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <SignatureLine label={t('print.signatureDirector')} />
          <SignatureLine label={t('print.signatureAccountant')} />
          <p className="mt-3 text-fin-xs text-slate-500">{t('print.signatureStamp')}</p>
        </div>
        <div>
          <SignatureLine label={counterpartyName || t('print.signatureClient')} />
          <p className="mt-3 text-fin-xs text-slate-500">{t('print.signatureStamp')}</p>
        </div>
      </div>
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div className="mb-5">
      <div className="h-6 border-b border-slate-400" />
      <p className="mt-1 text-fin-xs text-slate-500">{label}</p>
    </div>
  );
}
