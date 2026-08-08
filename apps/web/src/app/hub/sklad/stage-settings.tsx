'use client';

import { useState } from 'react';
import { useSkladStages, useSaveSkladStage, useDeleteSkladStage } from '@mubosher/api-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const FK_VIOLATION = '23503';

/**
 * The route an order takes through the factory.
 *
 * Seeded with this one's shops (0024) and editable, because no two textile
 * plants run the same sequence and a hard-coded list would be wrong for the
 * second customer. Exactly one stage is the finished-goods warehouse: its
 * output is what counts as ready to ship, so marking a new one unmarks the old.
 */
export function StageSettings({ orgId }: { orgId: string }) {
  const { t } = useLocale();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const { data: stages } = useSkladStages(supabase, orgId);
  const saveStage = useSaveSkladStage(supabase);
  const deleteStage = useDeleteSkladStage(supabase);

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setErrorMessage(null);
    try {
      await action();
    } catch (err) {
      const code = (err as { code?: string }).code;
      setErrorMessage(
        code === FK_VIOLATION ? t('sklad.stageSettings.deleteInUse') : (err as Error).message,
      );
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const position = ((stages ?? []).at(-1)?.position ?? 0) + 10;
    await run(() => saveStage.mutateAsync({ orgId, name, position, isFinal: false }));
    setNewName('');
  }

  /** Moves a stage one place in the sequence by swapping positions with its
   * neighbour — simpler to reason about than renumbering the whole list. */
  async function move(stageId: string, direction: -1 | 1) {
    const list = stages ?? [];
    const index = list.findIndex((s) => s.id === stageId);
    const current = list[index];
    const neighbour = list[index + direction];
    if (!current || !neighbour) return;

    await run(async () => {
      await saveStage.mutateAsync({
        orgId,
        stageId: current.id,
        name: current.name,
        position: neighbour.position,
        isFinal: current.isFinal,
      });
      await saveStage.mutateAsync({
        orgId,
        stageId: neighbour.id,
        name: neighbour.name,
        position: current.position,
        isFinal: neighbour.isFinal,
      });
    });
  }

  async function setFinal(stageId: string) {
    const list = stages ?? [];
    await run(async () => {
      for (const s of list) {
        const shouldBeFinal = s.id === stageId;
        if (s.isFinal === shouldBeFinal) continue;
        await saveStage.mutateAsync({
          orgId,
          stageId: s.id,
          name: s.name,
          position: s.position,
          isFinal: shouldBeFinal,
        });
      }
    });
  }

  return (
    <Card className="p-4">
      <h2 className="text-base font-semibold text-slate-900">{t('sklad.stageSettings.title')}</h2>
      <p className="mt-1 text-sm text-slate-500">{t('sklad.stageSettings.description')}</p>

      <form onSubmit={handleCreate} className="mt-4 flex max-w-md items-center gap-2">
        <Input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('sklad.stageSettings.namePlaceholder')}
        />
        <Button type="submit" disabled={saveStage.isPending || !newName.trim()}>
          {t('sklad.lookups.addButton')}
        </Button>
      </form>

      {errorMessage && <p className="mt-2 text-sm text-rose-600">{errorMessage}</p>}

      <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
        {(stages ?? []).map((s, index) => (
          <li key={s.id} className="flex items-center gap-2 py-2.5">
            <span className="w-6 text-xs tabular-nums text-slate-400">{index + 1}</span>

            {editingId === s.id ? (
              <>
                <Input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  autoFocus
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={async () => {
                    const name = editingName.trim();
                    if (name) {
                      await run(() =>
                        saveStage.mutateAsync({
                          orgId,
                          stageId: s.id,
                          name,
                          position: s.position,
                          isFinal: s.isFinal,
                        }),
                      );
                    }
                    setEditingId(null);
                  }}
                >
                  {t('common.save')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditingId(null)}
                >
                  {t('common.cancel')}
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 truncate text-sm text-slate-900">{s.name}</span>
                {s.isFinal ? (
                  <Badge tone="success">{t('sklad.stageSettings.final')}</Badge>
                ) : (
                  <button
                    type="button"
                    onClick={() => void setFinal(s.id)}
                    className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    {t('sklad.stageSettings.markFinal')}
                  </button>
                )}
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => void move(s.id, -1)}
                  className="rounded-md px-1.5 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === (stages?.length ?? 0) - 1}
                  onClick={() => void move(s.id, 1)}
                  className="rounded-md px-1.5 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(s.id);
                    setEditingName(s.name);
                  }}
                  className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  {t('common.edit')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm(t('sklad.stageSettings.deleteConfirm'))) return;
                    void run(() => deleteStage.mutateAsync({ orgId, stageId: s.id }));
                  }}
                  className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  {t('common.delete')}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
