'use client';

import { useLocale } from '@/lib/i18n/LocaleProvider';
import { THEMES, useTheme, type Theme } from '@/lib/prefs/ThemeProvider';

function IceIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <path d="M10 2.5v15M3.5 6.25l13 7.5M16.5 6.25l-13 7.5" strokeLinecap="round" />
      <path
        d="M10 5.5 8.4 7.1M10 5.5l1.6 1.6M10 14.5l-1.6-1.6M10 14.5l1.6-1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M10 4.5a.75.75 0 01-.75-.75V2.25a.75.75 0 011.5 0v1.5A.75.75 0 0110 4.5zM14.5 10a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM15.303 5.757a.75.75 0 010-1.06l1.06-1.061a.75.75 0 111.061 1.06l-1.06 1.061a.75.75 0 01-1.061 0zM16.25 10a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5H17a.75.75 0 01-.75-.75zM15.303 14.243a.75.75 0 011.06 0l1.061 1.06a.75.75 0 11-1.06 1.061l-1.061-1.06a.75.75 0 010-1.061zM10 15.5a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75zM3.636 15.303a.75.75 0 010-1.06l1.06-1.061a.75.75 0 111.061 1.06l-1.06 1.061a.75.75 0 01-1.061 0zM1.25 10a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5H2a.75.75 0 01-.75-.75zM4.697 5.757a.75.75 0 01-1.06-1.06l1.06-1.061a.75.75 0 111.06 1.06L4.697 5.757z" />
    </svg>
  );
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={className}
    >
      <rect x="2.25" y="3.75" width="15.5" height="12.5" rx="2" />
      <path d="m5.75 8 2.25 2-2.25 2M10.5 12.5h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const icons: Record<Theme, (props: { className?: string }) => React.ReactElement> = {
  ice: IceIcon,
  light: SunIcon,
  dark: TerminalIcon,
};

/**
 * Three backgrounds, one row of icons. Deliberately not a dropdown: the whole
 * point of a theme switch is that you try all three in two seconds and keep
 * the one your eyes prefer, which a menu makes into four clicks.
 */
export function ThemeSwitcher({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const { t } = useLocale();

  return (
    <div
      role="group"
      aria-label={t('theme.label')}
      className={`inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 ${className}`}
    >
      {THEMES.map((value) => {
        const Icon = icons[value];
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={active}
            title={t(`theme.${value}`)}
            aria-label={t(`theme.${value}`)}
            className={`flex h-8 w-8 items-center justify-center rounded-[6px] transition-colors duration-150 sm:w-9 ${
              active ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
