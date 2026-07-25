'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { ToggleChip } from '@/components/ui/Badge';

interface CounterpartyRow {
  id: string;
  name: string;
  phone: string | null;
  categories: string[];
}

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

export function CounterpartyList({ counterparties }: { counterparties: CounterpartyRow[] }) {
  const { t } = useLocale();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

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

  const filtered =
    activeCategory === UNCATEGORIZED
      ? counterparties.filter((c) => !c.categories?.length)
      : activeCategory
        ? counterparties.filter((c) => c.categories?.includes(activeCategory))
        : counterparties;

  return (
    <div>
      {allCategories.length > 0 && (
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
          {filtered.map((c) => (
            <Link key={c.id} href={`/counterparty/${c.id}`}>
              <Card className="flex items-center gap-3 p-4 transition-shadow hover:shadow-popover">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${toneFor(c.name)}`}
                >
                  {initials(c.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{c.name}</span>
                  {(c.phone || c.categories?.length) && (
                    <span className="block truncate text-xs text-slate-500">
                      {[c.phone, c.categories?.join(', ')].filter(Boolean).join(' · ')}
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
          ))}
        </div>
      ) : (
        <Card className="px-4 py-10 text-center text-sm text-slate-500">
          {t('dashboard.empty')}
        </Card>
      )}
    </div>
  );
}
