import { supabase } from '../supabase';
import { getLocalDb } from '../db/localDb';

const CODES_KEY = 'currency_codes';
const BASE_KEY = 'currency_base';

export interface CurrencyInfo {
  /** Every currency the org may transact in, base first. */
  codes: string[];
  /** The org's reporting currency — what an entry is converted to. */
  base: string;
}

const FALLBACK: CurrencyInfo = { codes: ['UZS'], base: 'UZS' };

/**
 * The currency list, cached in SQLite so the entry screen keeps working on a
 * phone with no signal — which is the whole reason the entry screen writes to
 * a local queue in the first place. A cold, offline start falls back to UZS
 * rather than leaving the picker empty and the form unusable.
 */
export async function loadCurrencies(orgId: string): Promise<CurrencyInfo> {
  const db = await getLocalDb();

  const [{ data: rows, error }, { data: org }] = await Promise.all([
    supabase.from('currencies').select('code').order('code'),
    supabase.from('organizations').select('base_currency').eq('id', orgId).maybeSingle(),
  ]);

  if (!error && rows?.length) {
    const base = org?.base_currency ?? 'UZS';
    // Base first: it is what most entries use, so it should need no scrolling.
    const codes = [base, ...rows.map((r) => r.code).filter((c) => c !== base)];

    await db.runAsync('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [
      CODES_KEY,
      JSON.stringify(codes),
    ]);
    await db.runAsync('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [
      BASE_KEY,
      base,
    ]);
    return { codes, base };
  }

  const cachedCodes = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM app_state WHERE key = ?',
    [CODES_KEY],
  );
  const cachedBase = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM app_state WHERE key = ?',
    [BASE_KEY],
  );

  if (!cachedCodes?.value) return FALLBACK;

  try {
    return {
      codes: JSON.parse(cachedCodes.value) as string[],
      base: cachedBase?.value ?? 'UZS',
    };
  } catch {
    return FALLBACK;
  }
}
