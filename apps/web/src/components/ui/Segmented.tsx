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
      className={`inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-fin-md ${className}`}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`h-8 shrink-0 whitespace-nowrap rounded-[6px] px-3 font-medium transition-colors duration-150 ${
            value === opt.value
              ? // The selected segment is a raised white chip on the grey
                // track — the same idea as a native iOS/macOS control, which
                // reads as selected without needing a colour to say so.
                (opt.activeClassName ?? 'bg-white text-slate-900 shadow-card')
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
