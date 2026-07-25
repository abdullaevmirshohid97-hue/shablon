type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'brand';

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  success: 'bg-emerald-50 text-emerald-700',
  danger: 'bg-rose-50 text-rose-700',
  warning: 'bg-amber-50 text-amber-700',
  brand: 'bg-brand-50 text-brand-700',
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
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
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
      className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}
