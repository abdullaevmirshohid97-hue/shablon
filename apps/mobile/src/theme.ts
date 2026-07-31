import { useWindowDimensions } from 'react-native';

/**
 * The same palette the web app uses (apps/web/tailwind.config.ts), restated
 * here because React Native has no Tailwind to read it from.
 *
 * Same governing rule: **colour means money direction, and nothing else.**
 * Chrome is graphite; only an amount may be green or red, and both are
 * desaturated so a column of figures reads as a column rather than as alarms.
 */
export const color = {
  // Neutral ramp — a true neutral, not Tailwind's blue-tinted slate.
  canvas: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceMuted: '#F4F4F5',
  line: '#E9E9EB',
  lineStrong: '#D8D8DC',
  textMuted: '#A1A1A8',
  textSecondary: '#71717A',
  textBody: '#3F3F46',
  ink: '#18181B',

  kirim: '#2E7D48',
  kirimSoft: '#F2F7F3',
  chiqim: '#A33A3A',
  chiqimSoft: '#FBF3F3',
  chiqimLine: '#EACCCC',
  warning: '#7C5514',
  warningSoft: '#FBF7EF',
  warningLine: '#E6D6B2',

  onInk: '#FFFFFF',
} as const;

export const radius = { sm: 8, md: 10, lg: 12, xl: 14, pill: 999 } as const;

/**
 * Phone vs tablet. 768dp is where a single column of ledger rows stops using
 * the width well and a two-up layout starts paying for itself — the same
 * breakpoint the web app calls `md`.
 */
export const TABLET_MIN_WIDTH = 768;

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= TABLET_MIN_WIDTH;

  return {
    width,
    height,
    isTablet,
    isLandscape: width > height,
    /** Wide screens get roomier padding; phones keep every pixel for content. */
    gutter: isTablet ? 24 : 16,
    /** Text stops being readable past ~70 characters, however wide the tablet is. */
    maxContentWidth: isTablet ? 1100 : undefined,
    /** The client list goes two-up on a tablet, one-up on a phone. */
    listColumns: isTablet ? 2 : 1,
  };
}
