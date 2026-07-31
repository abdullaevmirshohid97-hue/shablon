/**
 * A card is a hairline and a white surface — nothing more. Depth used to come
 * from a two-layer shadow; at this density (several cards per screen, each
 * full of figures) that reads as clutter, so the border carries the edge and
 * the shadow only lifts it off the canvas.
 */
export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-card ${className}`}>
      {children}
    </div>
  );
}

/**
 * A figure with a label, the way the dashboard states totals. The accent is a
 * 2px rule down the left edge rather than a filled panel: three filled cards
 * side by side turned the summary into a traffic light.
 */
export function StatCard({
  label,
  value,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'danger';
  hint?: string;
}) {
  const rule =
    tone === 'success' ? 'bg-emerald-600' : tone === 'danger' ? 'bg-rose-600' : 'bg-slate-300';
  const figure =
    tone === 'success'
      ? 'text-emerald-700'
      : tone === 'danger'
        ? 'text-rose-700'
        : 'text-slate-900';

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white py-3.5 pl-4 pr-3.5 shadow-card">
      <span className={`absolute inset-y-0 left-0 w-[2px] ${rule}`} aria-hidden />
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold tabular-nums ${figure}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
