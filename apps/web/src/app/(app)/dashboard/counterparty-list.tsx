'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Badge, ToggleChip } from '@/components/ui/Badge';
import type { CounterpartyDebt } from '@/lib/counterpartyDebt';

interface CounterpartyRow {
  id: string;
  name: string;
  phone: string | null;
  categories: string[];
  /** The client's account currency. Null means they follow the org's base. */
  currency?: string | null;
}

const currencyFormatter = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 });

const AVATAR_TONES = [
  'bg-brand-100 text-brand-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
];

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

function toneFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = (hash * 31 + name.charCodeAt(i)) % AVATAR_TONES.length;
  return AVATAR_TONES[hash] ?? 'bg-slate-100 text-slate-700';
}

/** Sentinel filter value for counterparties that carry no category tag at all. */
const UNCATEGORIZED = '__uncategorized__';

export function CounterpartyList({
  counterparties,
  debtByCounterparty = {},
  /**
   * The chip row above the list. On a module's own page it narrows a list that
   * spans several tags; on the full directory it was a second navigation
   * offering the same destinations as the rail beside it, in front of the list
   * people came to read.
   */
  showCategoryFilter = true,
  baseCurrency = 'UZS',
}: {
  counterparties: CounterpartyRow[];
  debtByCounterparty?: Record<string, CounterpartyDebt>;
  showCategoryFilter?: boolean;
  /** What a client with no currency of their own is kept in. */
  baseCurrency?: string;
}) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeCurrency, setActiveCurrency] = useState<string | null>(null);

  const currencyOf = (c: CounterpartyRow) => c.currency || baseCurrency;

  // Built from the currencies actually in the book, with a count on each: a
  // row of buttons for currencies nobody trades in is a row of dead ends.
  const currencyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of counterparties) {
      const code = c.currency || baseCurrency;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [counterparties, baseCurrency]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const c of counterparties) {
      for (const cat of c.categories ?? []) set.add(cat);
    }
    return Array.from(set).sort();
  }, [counterparties]);

  const hasUncategorized = useMemo(
    () => counterparties.some((c) => !c.categories?.length),
    [counterparties],
  );

  const filtered = counterparties.filter((c) => {
    if (activeCurrency && currencyOf(c) !== activeCurrency) return false;
    if (activeCategory === UNCATEGORIZED) return !c.categories?.length;
    if (activeCategory) return c.categories?.includes(activeCategory) ?? false;
    return true;
  });

  return (
    <div>
      {/* Only when there is more than one: a single-currency book does not need
          to be told which currency it is in on every visit. */}
      {currencyCounts.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <ToggleChip active={activeCurrency === null} onClick={() => setActiveCurrency(null)}>
            {t('categories.all')}
            <span className="ml-1.5 tabular-nums opacity-60">{counterparties.length}</span>
          </ToggleChip>
          {currencyCounts.map(([code, count]) => (
            <ToggleChip
              key={code}
              active={activeCurrency === code}
              onClick={() => setActiveCurrency(activeCurrency === code ? null : code)}
            >
              {code}
              <span className="ml-1.5 tabular-nums opacity-60">{count}</span>
            </ToggleChip>
          ))}
        </div>
      )}

      {showCategoryFilter && allCategories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <ToggleChip active={activeCategory === null} onClick={() => setActiveCategory(null)}>
            {t('categories.all')}
          </ToggleChip>
          {allCategories.map((cat) => (
            <ToggleChip
              key={cat}
              active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </ToggleChip>
          ))}
          {hasUncategorized && (
            <ToggleChip
              active={activeCategory === UNCATEGORIZED}
              onClick={() => setActiveCategory(UNCATEGORIZED)}
            >
              {t('categories.uncategorized')}
            </ToggleChip>
          )}
        </div>
      )}

      {filtered.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((c) => {
            const debt = debtByCounterparty[c.id];
            return (
              <Link key={c.id} href={`/counterparty/${c.id}`}>
                <Card className="flex items-center gap-3 p-4 transition-shadow hover:shadow-popover">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fin-md font-semibold ${toneFor(c.name)}`}
                  >
                    {initials(c.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900">{c.name}</span>
                    {(c.phone || c.categories?.length) && (
                      <span className="block truncate text-fin-sm text-slate-500">
                        {[c.phone, c.categories?.join(', ')].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    {debt && (
                      <span className="mt-1 flex items-center gap-1.5">
                        <Badge tone="danger">
                          {t('dashboard.overdue')}:{' '}
                          {new Date(debt.overdueDate).toLocaleDateString(dateLocale)}
                        </Badge>
                        <span className="text-fin-sm font-semibold tabular-nums text-rose-600">
                          {currencyFormatter.format(debt.overdueAmount)}
                        </span>
                      </span>
                    )}
                  </span>
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4 shrink-0 text-slate-300"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card className="px-4 py-10 text-center text-fin-md text-slate-500">
          {t('dashboard.empty')}
        </Card>
      )}
    </div>
  );
}
