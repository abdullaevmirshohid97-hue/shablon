import { cookies } from 'next/headers';
import { dictionaries, DEFAULT_LOCALE, LOCALES, translate, type Locale } from '@mubosher/shared';

export const LOCALE_COOKIE = 'locale';

export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  return LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

export async function getServerTranslator() {
  const locale = await getServerLocale();
  const dict = dictionaries[locale];
  return { locale, t: (path: string) => translate(dict, path) };
}
