import { describe, expect, it } from 'vitest';
import { amountInWords, integerInWords } from './amountInWords';

describe('integerInWords — uz', () => {
  it.each([
    [0, 'nol'],
    [1, 'bir'],
    [15, "o'n besh"],
    [40, 'qirq'],
    [99, "to'qson to'qqiz"],
    [100, 'bir yuz'],
    [305, 'uch yuz besh'],
    [1000, 'bir ming'],
    [4_250_000, "to'rt million ikki yuz ellik ming"],
    [1_000_000_000, 'bir milliard'],
    // A zero group is skipped rather than spelled: not "bir million nol ming bir".
    [1_000_001, 'bir million bir'],
  ])('%i', (n, expected) => {
    expect(integerInWords(n, 'uz')).toBe(expected);
  });
});

describe('integerInWords — ru', () => {
  it.each([
    [0, 'ноль'],
    [11, 'одиннадцать'],
    [21, 'двадцать один'],
    [100, 'сто'],
    [999, 'девятьсот девяносто девять'],
    // Thousands are feminine and take one of three plural forms.
    [1000, 'одна тысяча'],
    [2000, 'две тысячи'],
    [5000, 'пять тысяч'],
    [11_000, 'одиннадцать тысяч'],
    [21_000, 'двадцать одна тысяча'],
    [1_000_000, 'один миллион'],
    [2_000_000, 'два миллиона'],
    [5_000_000, 'пять миллионов'],
    [4_250_000, 'четыре миллиона двести пятьдесят тысяч'],
  ])('%i', (n, expected) => {
    expect(integerInWords(n, 'ru')).toBe(expected);
  });
});

describe('amountInWords', () => {
  it('spells the sum and leaves the tiyin in digits', () => {
    expect(amountInWords(4_250_000.5, 'uz', { unit: "so'm", subUnit: 'tiyin' })).toBe(
      "To'rt million ikki yuz ellik ming so'm 50 tiyin",
    );
  });

  it('pads a single-digit fraction', () => {
    expect(amountInWords(12.05, 'uz', { unit: "so'm", subUnit: 'tiyin' })).toBe(
      "O'n ikki so'm 05 tiyin",
    );
  });

  it('carries a fraction that rounds to a whole unit', () => {
    expect(amountInWords(4.999, 'uz', { unit: "so'm", subUnit: 'tiyin' })).toBe(
      "Besh so'm 00 tiyin",
    );
  });

  it('says so when the balance is the other way round', () => {
    expect(amountInWords(-300, 'uz', { unit: "so'm" })).toBe("Minus uch yuz so'm");
    expect(amountInWords(-300, 'ru', { unit: 'сум' })).toBe('Минус триста сум');
  });

  it('leaves the case alone when asked', () => {
    expect(amountInWords(7, 'uz', { capitalize: false })).toBe('yetti');
  });
});
