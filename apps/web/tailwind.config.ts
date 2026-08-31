import type { Config } from 'tailwindcss';

/**
 * The palette is overridden at the token level rather than per component, so
 * every existing `slate-500` / `rose-600` in the app picks up the new value
 * without a sweep through thirty files.
 *
 * The governing rule: **colour means money direction, and nothing else.**
 * The chrome — nav, buttons, headings, borders — is graphite. Only an amount
 * is allowed to be green or red. That is what stops six saturated hues from
 * competing for attention on a screen whose actual content is numbers.
 *
 * Every token below resolves to a CSS variable declared in globals.css, one
 * set per theme (light / ice / dark). That is what lets three themes exist
 * without a single `dark:` prefix in a component: the *names* stay put and
 * only their values move. The neutral ramp deliberately **inverts** in dark
 * mode — `slate-900` is ink in every theme, which happens to be near-white on
 * a terminal-grey surface — so `bg-slate-900 text-white` keeps meaning "the
 * strongest possible contrast pair" rather than "black on white".
 */
const c = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const ramp = (name: string) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((step) => [step, c(`${name}-${step}`)]),
  ) as Record<string, string>;

/**
 * Finance-only type scale. Every size is derived from a single variable that
 * the Finance module sets on its own wrapper (see FinanceTextScaleProvider),
 * so the CEO can grow the figures on the ledger without touching the warehouse
 * screens. Outside that wrapper the variable is undefined and the fallback —
 * the default 13px — applies.
 *
 * `max(11px, …)` is the floor: nothing in the Finance module is ever allowed
 * back down to the 8-10px labels this scale was introduced to replace.
 */
const finBase = 'var(--fin-font, 13px)';
const finSize = (delta: number) => {
  if (delta === 0) return finBase;
  return delta < 0 ? `max(11px, calc(${finBase} - ${-delta}px))` : `calc(${finBase} + ${delta}px)`;
};

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Both resolve to variables so a theme can change the typeface, not only
      // the palette — see the :root block at the top of globals.css. The
      // inline fallbacks mean a missing variable degrades to the same stack
      // that was hardcoded here before, rather than to Times New Roman.
      fontFamily: {
        sans: ['var(--font-ui, Inter, -apple-system, "Segoe UI", Roboto, Arial, sans-serif)'],
        mono: ['var(--font-numeric, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)'],
      },
      colors: {
        // Surface and ink poles. Both are variables so that `bg-white` means
        // "the card surface" and `text-white` means "text that sits on ink",
        // in every theme, instead of two literal colours.
        white: c('white'),
        black: c('black'),
        // The colours that do *not* follow the theme, for the few surfaces
        // that are dark by design rather than by preference — a modal scrim,
        // the login brand panel. Everything else inverts with the ramp; these
        // would turn into a white wall if they did.
        scrim: c('scrim'),
        ink: c('ink'),
        paper: c('paper'),
        slate: ramp('slate'),
        brand: ramp('brand'),
        emerald: ramp('emerald'),
        rose: ramp('rose'),
        amber: ramp('amber'),
      },
      fontSize: {
        'fin-xs': [finSize(-2), { lineHeight: '1.4' }],
        'fin-sm': [finSize(-1), { lineHeight: '1.45' }],
        fin: [finSize(0), { lineHeight: '1.5' }],
        'fin-md': [finSize(1), { lineHeight: '1.5' }],
        'fin-lg': [finSize(3), { lineHeight: '1.4' }],
        'fin-xl': [finSize(6), { lineHeight: '1.3' }],
        'fin-2xl': [finSize(11), { lineHeight: '1.25' }],
      },
      boxShadow: {
        // Barely there. Depth comes from the hairline border, not from a halo.
        card: '0 1px 2px 0 rgb(var(--c-shadow) / 0.05)',
        popover:
          '0 8px 24px -6px rgb(var(--c-shadow) / 0.16), 0 2px 6px -2px rgb(var(--c-shadow) / 0.08)',
      },
      // Same idea as the fonts: the app's two shape decisions — how round a
      // control is and how round a card is — become theme-settable without a
      // sweep through every rounded-lg in the codebase.
      borderRadius: {
        md: 'var(--radius-sm, 0.375rem)',
        lg: 'var(--radius-control, 0.5rem)',
        xl: 'var(--radius-card, 0.75rem)',
      },
      letterSpacing: {
        tightest: '-0.02em',
      },
    },
  },
  plugins: [],
} satisfies Config;
