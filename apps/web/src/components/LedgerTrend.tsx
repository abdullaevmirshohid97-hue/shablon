'use client';

import { useId, useMemo } from 'react';
import type { MonthlyPoint } from '@mubosher/api-client';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';

const full = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });

const W = 720;
const H = 150;
const PAD_X = 8;
const PAD_Y = 12;

function monthLabel(iso: string, dateLocale: string): string {
  return new Date(iso).toLocaleDateString(dateLocale, { month: 'short' });
}

/**
 * Where the book has been, in two pictures.
 *
 * Both are hand-drawn SVG rather than a charting library. Two charts do not
 * justify a hundred kilobytes, and more to the point every colour here has to
 * come from the theme tokens — the app has three palettes and a fourth
 * planned, and a library would need each of them wired in by hand anyway.
 */
export function LedgerTrend({
  points,
  currency,
  isLoading = false,
}: {
  points: MonthlyPoint[];
  /** Named on the card, because a month of dollars and a month of sums are different charts. */
  currency: string;
  isLoading?: boolean;
}) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  // A fixed id would collide the moment a second chart appeared on the page,
  // and the second one would silently borrow the first one's fill.
  const hatchId = useId();

  const debt = useMemo(() => {
    if (!points.length) return null;

    const values = points.map((p) => p.closingDebt);
    const top = Math.max(...values, 0);
    const bottom = Math.min(...values, 0);
    const span = top - bottom || 1;
    const step = points.length > 1 ? (W - PAD_X * 2) / (points.length - 1) : 0;

    const coords = points.map((p, i) => ({
      x: PAD_X + i * step,
      y: PAD_Y + (1 - (p.closingDebt - bottom) / span) * (H - PAD_Y * 2),
      point: p,
    }));

    return { coords, top, bottom, zeroY: PAD_Y + (1 - (0 - bottom) / span) * (H - PAD_Y * 2) };
  }, [points]);

  const flow = useMemo(() => {
    if (!points.length) return null;

    const peak = Math.max(...points.map((p) => Math.max(p.totalKirim, p.totalChiqim)), 1);
    const slot = (W - PAD_X * 2) / points.length;
    const barW = Math.max(4, slot * 0.34);
    const mid = H / 2;

    return { peak, slot, barW, mid };
  }, [points]);

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="mb-4 h-5 w-40 animate-pulse rounded bg-slate-100" />
        <div className="h-[150px] animate-pulse rounded bg-slate-50" />
        <div className="mt-4 h-[150px] animate-pulse rounded bg-slate-50" />
      </Card>
    );
  }

  if (!debt || !flow) {
    return (
      <Card className="p-4">
        <h2 className="text-fin-lg font-semibold text-slate-900">{t('analytics.trendTitle')}</h2>
        <p className="mt-2 text-fin-md text-slate-500">{t('analytics.noData')}</p>
      </Card>
    );
  }

  const last = debt.coords[debt.coords.length - 1]!;

  return (
    <Card className="flex flex-col gap-6 p-4">
      {/* ------------------------------------------------------------------
          The debt position at each month end. One series, so no legend — the
          heading names it, and only the latest point carries a number.
          ------------------------------------------------------------------ */}
      <section>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-fin-lg font-semibold text-slate-900">{t('analytics.trendTitle')}</h2>
          <span className="text-fin-sm text-slate-500">
            <span className="font-semibold tabular-nums text-slate-900">
              {full.format(last.point.closingDebt)}
            </span>{' '}
            {currency}
          </span>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[150px] w-full overflow-visible"
          role="img"
          aria-label={t('analytics.trendTitle')}
        >
          <line
            x1={0}
            x2={W}
            y1={debt.zeroY}
            y2={debt.zeroY}
            className="stroke-slate-200"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={debt.coords.map((c) => `${c.x},${c.y}`).join(' ')}
            fill="none"
            className="stroke-slate-900"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {debt.coords.map((c) => (
            <g key={c.point.month}>
              <circle
                cx={c.x}
                cy={c.y}
                r={c === last ? 4 : 2.5}
                className={c === last ? 'fill-slate-900' : 'fill-slate-400'}
              />
              {/* The hit area is deliberately far bigger than the dot. */}
              <rect x={c.x - flow.slot / 2} y={0} width={flow.slot} height={H} fill="transparent">
                <title>{`${monthLabel(c.point.month, dateLocale)}: ${full.format(
                  c.point.closingDebt,
                )} ${currency}`}</title>
              </rect>
            </g>
          ))}
        </svg>
      </section>

      {/* ------------------------------------------------------------------
          Turnover per month. Up is money billed, down is money received —
          direction carries the meaning, and colour only agrees with it. That
          is not decoration: emerald and rose are 2.7 apart for a deuteranope
          (measured), so a reader who cannot separate red from green reads this
          chart off the axis instead. The hatch on the lower bars does the same
          job again in greyscale and in print.
          ------------------------------------------------------------------ */}
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-4">
          <h3 className="text-fin-md font-semibold text-slate-900">{t('analytics.flowTitle')}</h3>
          <span className="flex items-center gap-1.5 text-fin-sm text-slate-500">
            <span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-600" />
            {t('analytics.totalKirim')}
          </span>
          <span className="flex items-center gap-1.5 text-fin-sm text-slate-500">
            <svg viewBox="0 0 10 10" className="h-2.5 w-2.5">
              <rect width="10" height="10" rx="2" className="fill-rose-600" />
              <path
                d="M-2 4 L4 -2 M-2 9 L9 -2 M1 12 L12 1"
                className="stroke-white"
                strokeWidth="1.5"
              />
            </svg>
            {t('analytics.totalChiqim')}
          </span>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[150px] w-full"
          role="img"
          aria-label={t('analytics.flowTitle')}
        >
          <defs>
            <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" className="fill-rose-600" />
              <path d="M0 6 L6 0" className="stroke-white" strokeWidth="1.6" opacity="0.55" />
            </pattern>
          </defs>

          {points.map((p, i) => {
            const centre = PAD_X + flow.slot * (i + 0.5);
            const up = (p.totalKirim / flow.peak) * (flow.mid - PAD_Y);
            const down = (p.totalChiqim / flow.peak) * (flow.mid - PAD_Y);
            return (
              <g key={p.month}>
                <rect
                  x={centre - flow.barW - 1}
                  y={flow.mid - up}
                  width={flow.barW}
                  height={Math.max(up, p.totalKirim > 0 ? 2 : 0)}
                  rx={2}
                  className="fill-emerald-600"
                />
                <rect
                  x={centre + 1}
                  y={flow.mid}
                  width={flow.barW}
                  height={Math.max(down, p.totalChiqim > 0 ? 2 : 0)}
                  rx={2}
                  fill={`url(#${hatchId})`}
                />
                <rect
                  x={centre - flow.slot / 2}
                  y={0}
                  width={flow.slot}
                  height={H}
                  fill="transparent"
                >
                  <title>{`${monthLabel(p.month, dateLocale)} — ${t(
                    'analytics.totalKirim',
                  )}: ${full.format(p.totalKirim)} · ${t('analytics.totalChiqim')}: ${full.format(
                    p.totalChiqim,
                  )}`}</title>
                </rect>
              </g>
            );
          })}

          <line
            x1={0}
            x2={W}
            y1={flow.mid}
            y2={flow.mid}
            className="stroke-slate-300"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="mt-1 flex justify-between text-fin-xs tabular-nums text-slate-400">
          {points.map((p) => (
            <span key={p.month} className="flex-1 text-center">
              {monthLabel(p.month, dateLocale)}
            </span>
          ))}
        </div>
        <p className="mt-2 text-fin-xs text-slate-400">
          {t('analytics.flowPeak').replace('{amount}', `${compact.format(flow.peak)} ${currency}`)}
        </p>
      </section>
    </Card>
  );
}
