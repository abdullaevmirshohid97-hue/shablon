'use client';

import { useEffect, useId, useRef } from 'react';
import { useLocale } from '@/lib/i18n/LocaleProvider';

/**
 * The dialog shell, once.
 *
 * The same markup — a scrim, a centred white panel, `role="dialog"` — had been
 * written out by hand in nine places. Two of them closed on Escape, one moved
 * focus into the panel, none of them gave focus back to whatever opened them
 * or stopped the page scrolling underneath. Behaviour that is retyped is
 * behaviour that is retyped differently.
 *
 * A dialog is mounted when it is open and unmounted when it is not, which is
 * how every caller here already works — so there is no `open` prop to keep in
 * sync with the thing that decides.
 */

const widths = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  '2xl': 'max-w-4xl',
} as const;

export function Modal({
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
}: {
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Pinned to the bottom of the panel, outside the scrolling body. */
  footer?: React.ReactNode;
  width?: keyof typeof widths;
}) {
  const { t } = useLocale();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    // Whatever had focus is what should get it back — usually the button that
    // opened this, which is where the reader's attention was.
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);

    // The page behind a dialog scrolling under the pointer is the small thing
    // that makes a modal feel like a floating div rather than a mode.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="no-print fixed inset-0 z-30 flex items-center justify-center bg-scrim/50 p-4 backdrop-blur-sm"
      // mousedown, not click: a drag that starts inside the panel and ends on
      // the scrim is a text selection, not a request to close.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`flex max-h-[calc(100vh-2rem)] w-full ${widths[width]} flex-col rounded-xl bg-white shadow-popover outline-none`}
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-fin-lg font-semibold text-slate-900">
              {title}
            </h2>
            {description && <p className="mt-1 text-fin-md text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.closeDialog')}
            className="-mr-1 -mt-1 shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Only the body scrolls: the heading stays put, and so does whatever
            the footer is asking the reader to decide. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>

        {footer && <div className="border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
