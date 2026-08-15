import type { PropertyDef } from '@mubosher/shared';

/**
 * A value printed the way its property says it should be.
 *
 * The ontology already knows whether a number is money, a weight or a count, so
 * the explorer does not have to guess from the column name — which is exactly
 * the guess that prints a barcode with thousands separators in it.
 *
 * `ru-RU` grouping matches the rest of the app, and the em dash is deliberate:
 * an empty cell reads as a rendering fault, a dash reads as "nothing here".
 */
const decimal = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 });
const money = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const EMPTY = '—';

export function formatValue(property: PropertyDef, value: unknown): string {
  if (value == null || value === '') return EMPTY;

  // Postgres arrays arrive as arrays — counterparties.categories is one.
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : EMPTY;

  if (typeof value === 'boolean') return value ? 'Ha' : 'Yo‘q';

  switch (property.kind) {
    case 'money': {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? money.format(parsed) : String(value);
    }
    case 'quantity':
    case 'number': {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return String(value);
      const printed = decimal.format(parsed);
      return property.unit ? `${printed} ${property.unit}` : printed;
    }
    case 'date':
      // Dates come back as `2026-08-14` or a full timestamp; the day is the
      // part anyone reads off a warehouse screen.
      return String(value).slice(0, 10);
    // A code is a code: never grouped, never rounded, never localised.
    case 'code':
    case 'ref':
    case 'status':
    case 'text':
    default:
      return String(value);
  }
}

/** Numbers and money line up on the right; words do not. */
export function alignsRight(property: PropertyDef): boolean {
  return property.kind === 'money' || property.kind === 'number' || property.kind === 'quantity';
}
