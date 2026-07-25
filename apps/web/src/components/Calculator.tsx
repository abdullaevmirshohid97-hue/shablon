'use client';

import { useEffect, useState } from 'react';
import { useLocale } from '@/lib/i18n/LocaleProvider';

type Operator = '+' | '-' | '*' | '/';

function compute(a: number, b: number, op: Operator): number {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return b !== 0 ? a / b : a;
  }
}

const OPERATOR_LABEL: Record<Operator, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

export function Calculator({
  initialValue,
  onApply,
  onClose,
}: {
  initialValue?: number;
  onApply: (value: number) => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [display, setDisplay] = useState(initialValue ? String(initialValue) : '0');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [resetNext, setResetNext] = useState(false);

  function inputDigit(d: string) {
    if (resetNext || display === '0') {
      setDisplay(d);
      setResetNext(false);
    } else {
      setDisplay(display + d);
    }
  }

  function inputDot() {
    if (resetNext) {
      setDisplay('0.');
      setResetNext(false);
      return;
    }
    if (!display.includes('.')) setDisplay(display + '.');
  }

  function applyOperator(op: Operator) {
    const current = parseFloat(display);
    if (prevValue !== null && operator) {
      const result = compute(prevValue, current, operator);
      setPrevValue(result);
      setDisplay(String(result));
    } else {
      setPrevValue(current);
    }
    setOperator(op);
    setResetNext(true);
  }

  function equals() {
    const current = parseFloat(display);
    if (prevValue !== null && operator) {
      const result = compute(prevValue, current, operator);
      setDisplay(String(result));
      setPrevValue(null);
      setOperator(null);
      setResetNext(true);
    }
  }

  function clear() {
    setDisplay('0');
    setPrevValue(null);
    setOperator(null);
    setResetNext(false);
  }

  function backspace() {
    setDisplay((d) => (d.length > 1 ? d.slice(0, -1) : '0'));
  }

  // Lets a physical keyboard drive the popup: digits, . , operators, Enter/=,
  // Backspace, Escape to close, Esc/C to clear.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        inputDigit(e.key);
        return;
      }
      switch (e.key) {
        case '.':
        case ',':
          e.preventDefault();
          inputDot();
          break;
        case '+':
          e.preventDefault();
          applyOperator('+');
          break;
        case '-':
          e.preventDefault();
          applyOperator('-');
          break;
        case '*':
          e.preventDefault();
          applyOperator('*');
          break;
        case '/':
          e.preventDefault();
          applyOperator('/');
          break;
        case 'Enter':
        case '=':
          e.preventDefault();
          equals();
          break;
        case 'Backspace':
          e.preventDefault();
          backspace();
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const btn = 'rounded-md bg-slate-100 py-2 text-sm font-medium hover:bg-slate-200';
  const btnOp = 'rounded-md bg-slate-800 py-2 text-sm font-medium text-white hover:bg-slate-700';

  return (
    <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-popover">
      <div className="mb-2 rounded-md bg-slate-50 px-2 py-2 text-right font-mono text-lg tabular-nums">
        {display}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <button type="button" className={btn} onClick={clear}>
          C
        </button>
        <button type="button" className={btn} onClick={backspace}>
          ⌫
        </button>
        <button type="button" className={btnOp} onClick={() => applyOperator('/')}>
          ÷
        </button>
        <button type="button" className={btnOp} onClick={() => applyOperator('*')}>
          ×
        </button>

        {(['7', '8', '9'] as const).map((d) => (
          <button key={d} type="button" className={btn} onClick={() => inputDigit(d)}>
            {d}
          </button>
        ))}
        <button type="button" className={btnOp} onClick={() => applyOperator('-')}>
          −
        </button>

        {(['4', '5', '6'] as const).map((d) => (
          <button key={d} type="button" className={btn} onClick={() => inputDigit(d)}>
            {d}
          </button>
        ))}
        <button type="button" className={btnOp} onClick={() => applyOperator('+')}>
          +
        </button>

        {(['1', '2', '3'] as const).map((d) => (
          <button key={d} type="button" className={btn} onClick={() => inputDigit(d)}>
            {d}
          </button>
        ))}
        <button
          type="button"
          className="row-span-2 rounded-md bg-brand-600 text-sm font-medium text-white hover:bg-brand-700"
          onClick={equals}
        >
          =
        </button>

        <button type="button" className={`col-span-2 ${btn}`} onClick={() => inputDigit('0')}>
          0
        </button>
        <button type="button" className={btn} onClick={inputDot}>
          .
        </button>
      </div>

      {operator && (
        <p className="mt-1 text-center text-xs text-slate-400">
          {prevValue} {OPERATOR_LABEL[operator]}
        </p>
      )}

      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          className="flex-1 rounded-md bg-brand-600 py-1.5 text-sm text-white hover:bg-brand-700"
          onClick={() => onApply(parseFloat(display) || 0)}
        >
          {t('common.apply')}
        </button>
        <button
          type="button"
          className="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200"
          onClick={onClose}
        >
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}
