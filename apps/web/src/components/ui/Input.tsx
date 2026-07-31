import { forwardRef } from 'react';

// Same 40px height as a md Button, so a field and its action sit on one line
// without either being nudged. Focus is handled by the global focus-visible
// ring — a second border colour on top of it just doubled the outline.
const baseInput =
  'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 transition-colors hover:border-slate-400 ' +
  'disabled:bg-slate-100 disabled:text-slate-400';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...props }, ref) {
    return <input ref={ref} className={`${baseInput} ${className}`} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...props }, ref) {
    return (
      <select ref={ref} className={`${baseInput} ${className}`} {...props}>
        {children}
      </select>
    );
  },
);

export function Label({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`mb-1.5 block text-xs font-medium text-slate-600 ${className}`}>
      {children}
    </label>
  );
}

export function Field({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}
