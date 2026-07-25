import uz from './uz.json';
import ru from './ru.json';

export const dictionaries = { uz, ru } as const;

export type Locale = keyof typeof dictionaries;

export type Dictionary = typeof uz;

export const DEFAULT_LOCALE: Locale = 'uz';

export const LOCALES: Locale[] = ['uz', 'ru'];

/** Dot-path lookup into a Dictionary, e.g. t(dict, 'ledger.qarz'). Falls back to the key itself if missing. */
export function translate(dict: Dictionary, path: string): string {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, dict);

  return typeof value === 'string' ? value : path;
}
