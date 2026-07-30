import { describe, expect, it } from 'vitest';
import { one } from './embed';

describe('one', () => {
  it('unwraps the object PostgREST actually returns for a to-one embed', () => {
    expect(one({ name: 'Mubosher' })).toEqual({ name: 'Mubosher' });
  });

  it('unwraps the array shape the hand-written types declare', () => {
    expect(one([{ name: 'Mubosher' }])).toEqual({ name: 'Mubosher' });
  });

  it('returns null for null, undefined and an empty array', () => {
    expect(one(null)).toBeNull();
    expect(one(undefined)).toBeNull();
    expect(one([])).toBeNull();
  });

  it('keeps a falsy-but-present scalar rather than collapsing it to null', () => {
    expect(one(0)).toBe(0);
    expect(one('')).toBe('');
  });
});
