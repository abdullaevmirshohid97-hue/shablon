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
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        // Neutral ramp. Tailwind's stock slate is blue-tinted and cold; this
        // is a true neutral that reads as ink on paper rather than as screen.
        //
        // The surface end (50-300) carries canvas, fills and hairlines and is
        // left alone. The ink end (400-900) is where text lives, and it is
        // pulled deliberately dark: the previous ramp topped out at #18181B
        // with secondary text at #71717A, which read as grey on a screen full
        // of figures. Primary text is now actually black and every muted step
        // moved down with it, so "quiet" still means quiet but never washed.
        slate: {
          50: '#FAFAFA', // page canvas — never pure white, which glares
          100: '#F4F4F5', // hover fills, subtle bands
          200: '#E9E9EB', // hairlines
          300: '#D8D8DC', // input borders
          400: '#8A8A93', // placeholders, muted meta
          500: '#5C5C64', // secondary text
          600: '#3F3F46',
          700: '#2A2A30',
          800: '#141417',
          900: '#000000', // primary ink — pure black
        },
        // Graphite, not indigo. A saturated brand hue on every button and
        // active nav item is the loudest thing on the page, and it is chrome.
        brand: {
          50: '#F4F4F5',
          100: '#E9E9EB',
          200: '#D8D8DC',
          300: '#8A8A93',
          400: '#5C5C64',
          500: '#3F3F46',
          600: '#141417',
          700: '#000000',
          800: '#000000',
          900: '#000000',
        },
        // Kirim. Desaturated forest instead of Tailwind's electric emerald.
        emerald: {
          50: '#F2F7F3',
          100: '#DFEBE2',
          200: '#C6DCCB',
          300: '#9CBFA5',
          400: '#6B9A78',
          500: '#437A54',
          600: '#2E7D48',
          700: '#236038',
          800: '#1B4A2B',
          900: '#153A22',
        },
        // Chiqim. Tailwind's rose-600 (#e11d48) is a hot pink-red and was the
        // single biggest source of glare — 29 usages, nearly all on numbers.
        rose: {
          50: '#FBF3F3',
          100: '#F5E3E3',
          200: '#EACCCC',
          300: '#D9A8A8',
          400: '#C08080',
          500: '#AE5757',
          600: '#A33A3A',
          700: '#873030',
          800: '#6B2626',
          900: '#571F1F',
        },
        // Muddat / ogohlantirish. Ochre rather than school-bus amber.
        amber: {
          50: '#FBF7EF',
          100: '#F4EBD9',
          200: '#E6D6B2',
          300: '#D2B87E',
          400: '#BC9750',
          500: '#A47B2C',
          600: '#9A6B18',
          700: '#7C5514',
          800: '#634311',
          900: '#4F360F',
        },
      },
      boxShadow: {
        // Barely there. Depth comes from the hairline border, not from a halo.
        card: '0 1px 2px 0 rgb(24 24 27 / 0.04)',
        popover: '0 8px 24px -6px rgb(24 24 27 / 0.12), 0 2px 6px -2px rgb(24 24 27 / 0.06)',
      },
      borderRadius: {
        lg: '0.5rem',
        xl: '0.75rem',
      },
      letterSpacing: {
        tightest: '-0.02em',
      },
    },
  },
  plugins: [],
} satisfies Config;
