import type { Locale } from './i18n/index';

/**
 * A sum spelled out, the way every invoice, act and payment order in this
 * region carries it under the figure.
 *
 * It is not decoration. The words are what makes a printed document hard to
 * alter after signing — a digit can have a zero added to it, "to'rt million"
 * cannot — which is exactly why the forms have carried the line for a century.
 */

const UZ_ONES = ['', 'bir', 'ikki', 'uch', "to'rt", 'besh', 'olti', 'yetti', 'sakkiz', "to'qqiz"];
const UZ_TENS = [
  '',
  "o'n",
  'yigirma',
  "o'ttiz",
  'qirq',
  'ellik',
  'oltmish',
  'yetmish',
  'sakson',
  "to'qson",
];
/** Thousand, million, milliard — Uzbek takes no plural or gender agreement. */
const UZ_SCALES = ['', 'ming', 'million', 'milliard', 'trillion'];

const RU_ONES = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const RU_ONES_FEMININE = ['', 'одна', 'две', ...RU_ONES.slice(3)];
const RU_TEENS = [
  'десять',
  'одиннадцать',
  'двенадцать',
  'тринадцать',
  'четырнадцать',
  'пятнадцать',
  'шестнадцать',
  'семнадцать',
  'восемнадцать',
  'девятнадцать',
];
const RU_TENS = [
  '',
  '',
  'двадцать',
  'тридцать',
  'сорок',
  'пятьдесят',
  'шестьдесят',
  'семьдесят',
  'восемьдесят',
  'девяносто',
];
const RU_HUNDREDS = [
  '',
  'сто',
  'двести',
  'триста',
  'четыреста',
  'пятьсот',
  'шестьсот',
  'семьсот',
  'восемьсот',
  'девятьсот',
];
/** [one, few, many] for each scale; thousands are feminine, the rest masculine. */
const RU_SCALES: [string, string, string][] = [
  ['', '', ''],
  ['тысяча', 'тысячи', 'тысяч'],
  ['миллион', 'миллиона', 'миллионов'],
  ['миллиард', 'миллиарда', 'миллиардов'],
  ['триллион', 'триллиона', 'триллионов'],
];

/** Russian picks one of three forms by the last digits of the count. */
function ruPlural(n: number, forms: [string, string, string]): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  const mod10 = n % 10;
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

function uzGroup(n: number): string[] {
  const words: string[] = [];
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const ones = n % 10;

  if (hundreds) words.push(UZ_ONES[hundreds]!, 'yuz');
  if (tens) words.push(UZ_TENS[tens]!);
  if (ones) words.push(UZ_ONES[ones]!);

  return words;
}

function ruGroup(n: number, feminine: boolean): string[] {
  const words: string[] = [];
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;

  if (hundreds) words.push(RU_HUNDREDS[hundreds]!);
  if (remainder >= 10 && remainder <= 19) {
    words.push(RU_TEENS[remainder - 10]!);
  } else {
    const tens = Math.floor(remainder / 10);
    const ones = remainder % 10;
    if (tens) words.push(RU_TENS[tens]!);
    if (ones) words.push((feminine ? RU_ONES_FEMININE : RU_ONES)[ones]!);
  }

  return words;
}

/** Splits into groups of three, least significant first. */
function groupsOfThree(n: number): number[] {
  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  return groups.length ? groups : [0];
}

/** The whole part of a number, in words. Negative and fractional parts are the caller's business. */
export function integerInWords(value: number, locale: Locale): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return locale === 'ru' ? 'ноль' : 'nol';

  const groups = groupsOfThree(n);
  const words: string[] = [];

  // Most significant group first.
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const group = groups[i]!;
    if (group === 0) continue;

    if (locale === 'ru') {
      words.push(...ruGroup(group, i === 1));
      if (i > 0) words.push(ruPlural(group, RU_SCALES[i]!));
    } else {
      words.push(...uzGroup(group));
      if (i > 0) words.push(UZ_SCALES[i]!);
    }
  }

  return words.join(' ');
}

/**
 * What a currency's units are called, for the spelled-out line.
 *
 * Only the base currency of this region gets real words; anything else uses
 * its ISO code, which is honest — "besh yuz USD" reads as intended, while
 * inventing Uzbek names for every currency in the table would not.
 */
export function currencyWords(
  code: string,
  locale: Locale,
): { unit: string; subUnit: string | null } {
  if (code === 'UZS') {
    return locale === 'ru' ? { unit: 'сум', subUnit: 'тийин' } : { unit: "so'm", subUnit: 'tiyin' };
  }
  return { unit: code, subUnit: null };
}

export interface AmountInWordsOptions {
  /** Major unit, e.g. "so'm" / "сум". Omit for the bare number. */
  unit?: string | null;
  /** Minor unit, e.g. "tiyin" / "тийин". When set, the fraction is spelled as two digits. */
  subUnit?: string | null;
  /** Capitalise the first letter, as the printed forms do. */
  capitalize?: boolean;
}

/**
 * "4 250 000,50" → "To'rt million ikki yuz ellik ming so'm 50 tiyin".
 *
 * The minor unit stays in digits, which is how the forms are actually filled
 * in: spelling out the tiyin would be longer than the sum it qualifies.
 */
export function amountInWords(
  amount: number,
  locale: Locale,
  options: AmountInWordsOptions = {},
): string {
  const { unit = null, subUnit = null, capitalize = true } = options;

  const negative = amount < 0;
  const absolute = Math.abs(amount);
  const whole = Math.floor(absolute);
  const fraction = Math.round((absolute - whole) * 100);
  // 4.999 rounds its fraction to 100; the carry belongs to the whole part.
  const carried = fraction === 100;
  const wholePart = carried ? whole + 1 : whole;
  const fractionPart = carried ? 0 : fraction;

  const parts = [integerInWords(wholePart, locale)];
  if (unit) parts.push(unit);
  if (subUnit) parts.push(String(fractionPart).padStart(2, '0'), subUnit);

  let text = parts.join(' ');
  if (negative) text = `${locale === 'ru' ? 'минус' : 'minus'} ${text}`;
  if (capitalize) text = text.charAt(0).toUpperCase() + text.slice(1);

  return text;
}
