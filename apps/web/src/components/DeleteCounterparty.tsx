'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ontology } from '@mubosher/shared';
import { useCounterpartyReferences, useDeleteCounterparty } from '@mubosher/api-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

/**
 * Removing a client, and being told plainly when you cannot.
 *
 * A client with history is not deleted — the ledger says a posted entry is
 * cancelled by an opposite entry and never erased (0014), and a client is the
 * subject of those entries. So this screen asks the database what points at
 * them first and, when something does, replaces the button with the count.
 * "14 ta tranzaksiya, 2 ta faktura" is an answer; a greyed-out button is not.
 *
 * The names come from the ontology, so a new module that starts referencing
 * clients names itself here without this file being touched.
 */
export function DeleteCounterparty({
  orgId,
  counterpartyId,
  counterpartyName,
}: {
  orgId: string;
  counterpartyId: string;
  counterpartyName: string;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const references = useCounterpartyReferences(supabase, orgId, counterpartyId);
  const remove = useDeleteCounterparty(supabase);

  const [confirming, setConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const blockers = references.data ?? [];
  const blocked = blockers.length > 0;

  async function handleDelete() {
    setErrorMessage(null);
    try {
      await remove.mutateAsync({ orgId, counterpartyId });
      router.push('/clients');
      router.refresh();
    } catch (err) {
      // Whatever the server says, it says in the terms of the business — the
      // refusal is written in 0034, not assembled here.
      setErrorMessage((err as Error).message);
      setConfirming(false);
    }
  }

  return (
    <Card className="no-print border-rose-200 p-4">
      <h2 className="text-fin-md font-semibold text-slate-900">{t('counterparty.deleteTitle')}</h2>

      {references.isPending ? (
        <p className="mt-1 text-fin-md text-slate-400">{t('common.loading')}</p>
      ) : blocked ? (
        <p className="mt-1 text-fin-md text-slate-600">
          {t('counterparty.deleteBlocked')}{' '}
          <span className="font-medium text-slate-900">
            {blockers
              .map(
                (ref) => `${ref.count} ta ${ontology.objectType(ref.entity)?.title ?? ref.entity}`,
              )
              .join(', ')}
          </span>
          . {t('counterparty.deleteBlockedHint')}
        </p>
      ) : (
        <p className="mt-1 text-fin-md text-slate-600">{t('counterparty.deleteHint')}</p>
      )}

      {errorMessage && <p className="mt-2 text-fin-md text-rose-600">{errorMessage}</p>}

      {!blocked && !references.isPending && (
        <div className="mt-3">
          {confirming ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-fin-md text-slate-700">
                {t('counterparty.deleteConfirm').replace('{name}', counterpartyName)}
              </span>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={remove.isPending}
                onClick={() => void handleDelete()}
              >
                {remove.isPending ? t('common.saving') : t('common.delete')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={remove.isPending}
                onClick={() => setConfirming(false)}
              >
                {t('common.cancel')}
              </Button>
            </div>
          ) : (
            <Button type="button" size="sm" variant="danger" onClick={() => setConfirming(true)}>
              {t('common.delete')}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
