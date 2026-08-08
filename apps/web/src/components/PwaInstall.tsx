'use client';

import { useEffect, useState } from 'react';
import { useLocale } from '@/lib/i18n/LocaleProvider';

/** Chrome's install event. Not in lib.dom yet, so it is named here. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS predates the media query and puts it here instead.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isApple(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M10 2a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 10.586V3a1 1 0 011-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Registers the service worker and offers to install the app.
 *
 * Nobody has to be sent a file: the site installs itself from the browser, and
 * afterwards opens without an address bar, from the home screen or the Start
 * menu, like anything else on the device.
 *
 * Chrome fires `beforeinstallprompt` when it decides the site qualifies —
 * manifest, icons, a service worker that handles fetch — and the button below
 * simply replays it. Safari on iOS has no such event and never will, so there
 * the button explains the two taps Apple requires instead of pretending it can
 * do it for them. Once installed, the whole thing disappears.
 */
export function PwaInstall({ className = '' }: { className?: string }) {
  const { t } = useLocale();
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(true);
  const [showAppleHelp, setShowAppleHelp] = useState(false);
  const [apple, setApple] = useState(false);

  useEffect(() => {
    // In development the /_next/static/ paths carry no content hash, so a
    // caching worker would serve yesterday's bundle through a hot reload.
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }

    setInstalled(isStandalone());
    setApple(isApple());

    function onBeforeInstallPrompt(event: Event) {
      // Without this Chrome shows its own mini-infobar and never fires again,
      // which takes the choice of where the button lives away from us.
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setPrompt(null);
      setInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    // The event is single-use either way; a dismissed prompt is offered again
    // by the browser on a later visit, not by us on this one.
    setPrompt(null);
    if (outcome === 'accepted') setInstalled(true);
  }

  if (installed) return null;

  // Chrome, Edge, Android: one button, one tap.
  if (prompt) {
    return (
      <button
        type="button"
        onClick={() => void handleInstall()}
        className={`no-print inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 ${className}`}
      >
        <DownloadIcon className="h-3.5 w-3.5" />
        {t('pwa.install')}
      </button>
    );
  }

  // iOS: Apple gives no programmatic route, so say what to press.
  if (apple) {
    return (
      <div className={`no-print relative ${className}`}>
        <button
          type="button"
          onClick={() => setShowAppleHelp((open) => !open)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
        >
          <DownloadIcon className="h-3.5 w-3.5" />
          {t('pwa.install')}
        </button>

        {showAppleHelp && (
          <>
            <button
              type="button"
              aria-label="close"
              onClick={() => setShowAppleHelp(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-popover">
              <p className="text-sm font-semibold text-slate-900">{t('pwa.appleTitle')}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-slate-600">
                <li>{t('pwa.appleStep1')}</li>
                <li>{t('pwa.appleStep2')}</li>
              </ol>
            </div>
          </>
        )}
      </div>
    );
  }

  // Any other browser: no install route, so nothing to promise.
  return null;
}
