'use client';

import { useLocale } from '@/lib/i18n/LocaleProvider';
import {
  DEFAULT_TEXT_SIZE,
  MAX_TEXT_SIZE,
  MIN_TEXT_SIZE,
  useFinanceTextScale,
} from '@/lib/prefs/FinanceTextScale';

/**
 * The Finance module's own type-size setting, living inside the module it
 * governs rather than in a global preferences page — because that is the only
 * honest place to promise that it changes nothing outside Finance.
 */
export function FinanceTextSizeControl({ className = '' }: { className?: string }) {
  const { t } = useLocale();
  const { size, setSize, isDefault } = useFinanceTextScale();

  const step = (delta: number) => () => setSize(size + delta);

  const button =
    'flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white ' +
    'text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900 ' +
    'disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className={`no-print ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
            <path d="M2.5 16.5 6.7 4.2h1.9l4.2 12.3h-1.8l-1.06-3.3H5.34l-1.04 3.3H2.5zm3.32-4.75h3.6L7.62 6.1h-.09L5.82 11.75zM13.6 16.5l2.6-7.6h1.35l2.6 7.6h-1.32l-.63-2.02h-2.66l-.62 2.02H13.6zm2.28-3.2h2l-.98-3.16h-.05l-.97 3.16z" />
          </svg>
          {t('textSize.label')}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={step(-1)}
            disabled={size <= MIN_TEXT_SIZE}
            className={button}
            title={t('textSize.decrease')}
            aria-label={t('textSize.decrease')}
          >
            <span className="text-[11px] font-semibold leading-none">A−</span>
          </button>
          <span className="w-8 text-center text-xs tabular-nums text-slate-500">{size}</span>
          <button
            type="button"
            onClick={step(1)}
            disabled={size >= MAX_TEXT_SIZE}
            className={button}
            title={t('textSize.increase')}
            aria-label={t('textSize.increase')}
          >
            <span className="text-[11px] font-semibold leading-none">A+</span>
          </button>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-[11px] leading-tight text-slate-400">{t('textSize.hint')}</p>
        {!isDefault && (
          <button
            type="button"
            onClick={() => setSize(DEFAULT_TEXT_SIZE)}
            className="shrink-0 text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            {t('textSize.reset')}
          </button>
        )}
      </div>
    </div>
  );
}
