'use client';

import { useMemo, useState } from 'react';
import {
  useSkladLookups,
  useCreateSkladLookup,
  useRenameSkladLookup,
  useDeleteSkladLookup,
} from '@mubosher/api-client';
import type { SkladLookupKind } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';

const KINDS: SkladLookupKind[] = ['mahsulot_turi', 'ip_turi', 'sort', 'rang', 'pantone'];

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.5 8.5a1 1 0 01-.464.263l-3 .75a.5.5 0 01-.606-.606l.75-3a1 1 0 01.263-.464l8.5-8.5z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M8 2a1 1 0 00-1 1v1H4a1 1 0 000 2h.5l.7 9.1A2 2 0 007.2 17h5.6a2 2 0 001.99-1.9L15.5 6h.5a1 1 0 100-2h-3V3a1 1 0 00-1-1H8zm1 4a1 1 0 012 0v6a1 1 0 11-2 0V6zm-2 1a1 1 0 011 1v5a1 1 0 11-2 0V8a1 1 0 011-1zm6 0a1 1 0 011 1v5a1 1 0 11-2 0V8a1 1 0 011-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 010 1.415l-7.5 7.5a1 1 0 01-1.415 0l-3.5-3.5a1 1 0 111.415-1.414L8.5 12.086l6.79-6.795a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function LookupSettings({ orgId }: { orgId: string }) {
  const { t } = useLocale();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const { data: lookups } = useSkladLookups(supabase, orgId);
  const createLookup = useCreateSkladLookup(supabase);
  const renameLookup = useRenameSkladLookup(supabase);
  const deleteLookup = useDeleteSkladLookup(supabase);

  const [kind, setKind] = useState<SkladLookupKind>('mahsulot_turi');
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const items = useMemo(() => (lookups ?? []).filter((l) => l.kind === kind), [lookups, kind]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setErrorMessage(null);
    try {
      await createLookup.mutateAsync({ orgId, kind, name });
      setNewName('');
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  async function confirmRename(lookupId: string) {
    const name = editingName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    setErrorMessage(null);
    try {
      await renameLookup.mutateAsync({ orgId, lookupId, name });
      setEditingId(null);
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  async function handleDelete(lookupId: string) {
    if (!window.confirm(t('sklad.lookups.deleteConfirm'))) return;
    setErrorMessage(null);
    try {
      await deleteLookup.mutateAsync({ orgId, lookupId });
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  return (
    <div className="max-w-2xl">
      {/* No heading of its own: this is a section of the settings screen now,
          and the segmented control above it already names it. */}
      <Card className="p-4">
        <p className="mb-4 text-sm text-slate-500">{t('sklad.lookups.description')}</p>
        <Segmented
          value={kind}
          onChange={(v) => {
            setKind(v);
            setEditingId(null);
          }}
          options={KINDS.map((k) => ({ value: k, label: t(`sklad.lookups.${toCamelKind(k)}`) }))}
        />

        <form onSubmit={handleCreate} className="mt-4 flex items-center gap-2">
          <Input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('sklad.lookups.namePlaceholder')}
          />
          <Button type="submit" disabled={createLookup.isPending || !newName.trim()}>
            {t('sklad.lookups.addButton')}
          </Button>
        </form>
        {errorMessage && <p className="mt-2 text-sm text-rose-600">{errorMessage}</p>}

        <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
          {!items.length && (
            <li className="py-3 text-sm text-slate-500">{t('sklad.lookups.empty')}</li>
          )}
          {items.map((l) => (
            <li key={l.id} className="flex items-center gap-2 py-2.5">
              {editingId === l.id ? (
                <>
                  <Input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    autoFocus
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => confirmRename(l.id)}
                    title={t('sklad.lookups.saveTooltip')}
                    className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"
                  >
                    <CheckIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    title={t('sklad.lookups.cancelTooltip')}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 truncate text-sm text-slate-900">{l.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(l.id);
                      setEditingName(l.name);
                    }}
                    title={t('sklad.lookups.renameTooltip')}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(l.id)}
                    title={t('sklad.lookups.deleteTooltip')}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function toCamelKind(kind: SkladLookupKind): string {
  const map: Record<SkladLookupKind, string> = {
    mahsulot_turi: 'productType',
    ip_turi: 'yarnType',
    sort: 'sort',
    rang: 'color',
    pantone: 'pantone',
  };
  return map[kind];
}
