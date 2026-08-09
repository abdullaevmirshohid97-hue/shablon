'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  href: string;
  label: string;
  Icon: (props: { className?: string }) => React.ReactElement;
}

export interface NavGroup {
  /** Small uppercase heading above the group; omitted for the primary group. */
  title?: string;
  items: NavItem[];
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * The navigation for screens below `lg`, where both sidebars are hidden.
 * Without it a phone user who lands on /dashboard has no route to the client
 * directory, the modules or Settings at all — the sidebar was the only place
 * those links existed.
 *
 * Rendered by each sidebar so the drawer always lists exactly that section's
 * links (Finance vs Hub), with no cross-layout state to keep in sync.
 */
export function MobileNav({
  groups,
  title,
  footer,
}: {
  groups: NavGroup[];
  title: string;
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Route changes come from tapping a link inside the drawer — close behind them.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);

    // Stop the page behind the overlay from scrolling with the drawer.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div className="no-print lg:hidden">
      <div className="sticky top-[57px] z-30 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={title}
          aria-expanded={open}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          <MenuIcon className="h-4 w-4" />
          {title}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-scrim/45 backdrop-blur-sm"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className="relative flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto bg-white shadow-xl outline-none"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <span className="text-sm font-semibold text-slate-900">{title}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="close"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 space-y-0.5 p-3">
              {groups.map((group, gi) => (
                <div key={group.title ?? gi} className={gi > 0 ? 'pt-4' : undefined}>
                  {group.title && (
                    <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {group.title}
                    </p>
                  )}
                  {group.items.map(({ href, label, Icon }) => {
                    const active = pathname === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                          active
                            ? 'bg-brand-50 text-brand-700'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>

            {footer && <div className="border-t border-slate-200 p-3">{footer}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
