type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'brand';

// Hairline outline rather than a filled pill: badges sit inside dense table
// rows, and a solid block of colour there competes with the figures beside it.
const tones: Record<Tone, string> = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  brand: 'border-slate-300 bg-slate-100 text-slate-800',
};

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-fin-xs font-medium leading-4 ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function ToggleChip({
  active,
  onClick,
  children,
  type = 'button',
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-fin-md font-medium transition-colors ${
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}
