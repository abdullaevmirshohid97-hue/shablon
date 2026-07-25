'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useModules,
  useCreateModule,
  useRenameModule,
  useDeleteModule,
} from '@mubosher/api-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

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

export function ModulesSettings({ orgId }: { orgId: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const { data: modules, isLoading } = useModules(supabase, orgId);
  const createModule = useCreateModule(supabase);
  const renameModule = useRenameModule(supabase);
  const deleteModule = useDeleteModule(supabase);

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setErrorMessage(null);
    try {
      await createModule.mutateAsync({ orgId, name });
      setNewName('');
      router.refresh();
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  function startEditing(id: string, currentName: string) {
    setEditingId(id);
    setEditingName(currentName);
  }

  async function confirmRename(id: string, oldName: string) {
    const newModuleName = editingName.trim();
    if (!newModuleName || newModuleName === oldName) {
      setEditingId(null);
      return;
    }
    setErrorMessage(null);
    try {
      await renameModule.mutateAsync({ orgId, moduleId: id, oldName, newName: newModuleName });
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(t('settings.deleteConfirm'))) return;
    setErrorMessage(null);
    try {
      await deleteModule.mutateAsync({ orgId, moduleId: id, name });
      router.refresh();
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  return (
    <Card className="p-4">
      <h2 className="text-base font-semibold text-slate-900">{t('settings.modulesTitle')}</h2>
      <p className="mt-1 text-sm text-slate-500">{t('settings.modulesDescription')}</p>

      <form onSubmit={handleCreate} className="mt-4 flex items-center gap-2">
        <Input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('settings.namePlaceholder')}
        />
        <Button type="submit" disabled={createModule.isPending || !newName.trim()}>
          {t('settings.addButton')}
        </Button>
      </form>
      {errorMessage && <p className="mt-2 text-sm text-rose-600">{errorMessage}</p>}

      <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
        {isLoading && <li className="py-3 text-sm text-slate-500">{t('common.loading')}</li>}
        {!isLoading && !modules?.length && (
          <li className="py-3 text-sm text-slate-500">{t('settings.empty')}</li>
        )}
        {modules?.map((m) => (
          <li key={m.id} className="flex items-center gap-2 py-2.5">
            {editingId === m.id ? (
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
                  onClick={() => confirmRename(m.id, m.name)}
                  title={t('settings.saveTooltip')}
                  className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"
                >
                  <CheckIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  title={t('settings.cancelTooltip')}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 truncate text-sm text-slate-900">{m.name}</span>
                <button
                  type="button"
                  onClick={() => startEditing(m.id, m.name)}
                  title={t('settings.renameTooltip')}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(m.id, m.name)}
                  title={t('settings.deleteTooltip')}
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
  );
}
