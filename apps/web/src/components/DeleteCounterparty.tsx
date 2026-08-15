'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ontology } from '@mubosher/shared';
import {
  useCounterpartyDirectory,
  useCounterpartyReferences,
  useDeleteCounterparty,
} from '@mubosher/api-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

/**
 * Closing this client's account, from their own page.
 *
 * The same rule the register in Settings applies, read from the same figures:
 * an account that is square can be closed, and their entries go with them.
 * Two screens offering a delete under two different rules is how one of them
 * ends up lying, so neither decides anything here — the balance comes from
 * counterparty_directory and the refusal comes from the database.
 *
 * Warehouse and sales documents still block it, and are named rather than
 * merely counted. The names come from the ontology, so a module added later
 * that references clients names itself here without this file being touched.
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
  const directory = useCounterpartyDirectory(supabase, orgId);
  const references = useCounterpartyReferences(supabase, orgId, counterpartyId);
  const remove = useDeleteCounterparty(supabase);

  const [confirming, setConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const row = directory.data?.find((entry) => entry.counterpartyId === counterpartyId);
  const loading = directory.isPending || references.isPending;

  const settled = row ? Math.abs(row.balance) < 0.01 : false;
  // Everything except the client's own ledger entries: those leave with them.
  const documents = (references.data ?? []).filter((ref) => ref.entity !== 'tranzaksiya');
  const canDelete = !loading && settled && documents.length === 0;

  async function handleDelete() {
    setErrorMessage(null);
    try {
      await remove.mutateAsync({ orgId, counterpartyId });
      router.push('/clients');
      router.refresh();
    } catch (err) {
      setErrorMessage((err as Error).message);
      setConfirming(false);
    }
  }

  return (
    <Card className="no-print border-rose-200 p-4">
      <h2 className="text-fin-md font-semibold text-slate-900">{t('counterparty.deleteTitle')}</h2>

      {loading ? (
        <p className="mt-1 text-fin-md text-slate-400">{t('common.loading')}</p>
      ) : !settled ? (
        <p className="mt-1 text-fin-md text-slate-600">
          {t('counterparty.deleteHasBalance')}{' '}
          <span className="font-medium tabular-nums text-slate-900">
            {money.format(row?.balance ?? 0)}
          </span>
          . {t('counterparty.deleteHasBalanceHint')}
        </p>
      ) : documents.length > 0 ? (
        <p className="mt-1 text-fin-md text-slate-600">
          {t('counterparty.deleteBlocked')}{' '}
          <span className="font-medium text-slate-900">
            {documents
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

      {canDelete && (
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
