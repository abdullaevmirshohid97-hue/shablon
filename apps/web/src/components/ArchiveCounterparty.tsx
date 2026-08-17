'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ontology } from '@mubosher/shared';
import {
  useArchiveCounterparty,
  useCounterpartyReferences,
  useRestoreCounterparty,
} from '@mubosher/api-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

/**
 * Putting this client away, from their own page.
 *
 * There is nothing to check. Archiving destroys nothing — the entries, the
 * invoices and the despatch notes stay where they are, the name leaves the
 * lists, and one click in the archive brings it back. So what stands between
 * the button and the deed is a warning about what is being hidden, not a rule
 * about whether hiding it is allowed.
 *
 * The warning names what is attached rather than counting it vaguely, and the
 * names come from the ontology: a module added later that starts referencing
 * clients appears here without this file being touched.
 */
export function ArchiveCounterparty({
  orgId,
  counterpartyId,
  counterpartyName,
  archivedAt,
}: {
  orgId: string;
  counterpartyId: string;
  counterpartyName: string;
  archivedAt: string | null;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const references = useCounterpartyReferences(supabase, orgId, counterpartyId);
  const archive = useArchiveCounterparty(supabase);
  const restore = useRestoreCounterparty(supabase);

  const [confirming, setConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const attached = references.data ?? [];
  const pending = archive.isPending || restore.isPending;

  async function run(action: 'archive' | 'restore') {
    setErrorMessage(null);
    try {
      await (action === 'archive' ? archive : restore).mutateAsync({ orgId, counterpartyId });
      setConfirming(false);
      if (action === 'archive') {
        router.push('/clients');
      }
      router.refresh();
    } catch (err) {
      setErrorMessage((err as Error).message);
      setConfirming(false);
    }
  }

  if (archivedAt) {
    return (
      <Card className="no-print border-amber-200 p-4">
        <h2 className="text-fin-md font-semibold text-slate-900">
          {t('counterparty.archivedTitle')}
        </h2>
        <p className="mt-1 text-fin-md text-slate-600">
          {t('counterparty.archivedHint').replace('{date}', archivedAt.slice(0, 10))}
        </p>
        {errorMessage && <p className="mt-2 text-fin-md text-rose-600">{errorMessage}</p>}
        <div className="mt-3">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => void run('restore')}
          >
            {pending ? t('common.saving') : t('clientsAdmin.restore')}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="no-print border-rose-200 p-4">
      <h2 className="text-fin-md font-semibold text-slate-900">{t('counterparty.deleteTitle')}</h2>
      <p className="mt-1 text-fin-md text-slate-600">{t('counterparty.archiveHint')}</p>

      {attached.length > 0 && (
        <p className="mt-1 text-fin-md text-amber-700">
          {t('counterparty.archiveWarning')}{' '}
          <span className="font-medium">
            {attached
              .map(
                (ref) => `${ref.count} ta ${ontology.objectType(ref.entity)?.title ?? ref.entity}`,
              )
              .join(', ')}
          </span>
          .
        </p>
      )}

      {errorMessage && <p className="mt-2 text-fin-md text-rose-600">{errorMessage}</p>}

      <div className="mt-3">
        {confirming ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-fin-md text-slate-700">
              {t('counterparty.archiveConfirm').replace('{name}', counterpartyName)}
            </span>
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() => void run('archive')}
            >
              {pending ? t('common.saving') : t('clientsAdmin.archiveAction')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
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
    </Card>
  );
}
