import { forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md';

// Heights are fixed rather than derived from padding, so a button always lines
// up with an Input beside it in a toolbar or a form row.
const base =
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium ' +
  'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45';

const variants: Record<Variant, string> = {
  // The primary action should be the darkest thing on screen, not the most colourful.
  primary: 'bg-slate-900 text-white hover:bg-slate-800 active:bg-black',
  secondary:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 active:bg-slate-100',
  ghost: 'text-slate-600 hover:bg-slate-100 active:bg-slate-200',
  danger: 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 active:bg-rose-100',
  success: 'bg-emerald-700 text-white hover:bg-emerald-800 active:bg-emerald-900',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className = '', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
});
