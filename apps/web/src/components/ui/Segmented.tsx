export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className = '',
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; activeClassName?: string }[];
  className?: string;
}) {
  return (
    <div
      className={`inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5 text-sm ${className}`}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
            value === opt.value
              ? (opt.activeClassName ?? 'bg-white text-slate-900 shadow-sm')
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
