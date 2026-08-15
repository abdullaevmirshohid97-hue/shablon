'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCounterpartyDirectory,
  useDeleteCounterparty,
  useUpdateCounterparty,
  type CounterpartyDirectoryRow,
} from '@mubosher/api-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PeriodFilter, usePeriodFilter } from '@/components/PeriodFilter';

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

type Roster = { user_id: string; full_name: string | null; email: string | null }[];

/**
 * The client register, kept where the rest of Finance is configured.
 *
 * The directory at /clients answers "who do we trade with"; this answers "is
 * this list right" — the same names with their manager, what went through each
 * account this period, and where the account stands. Adding, correcting and
 * closing all happen in the row rather than three screens away, because
 * tidying a register is one sitting of small edits, not one edit.
 *
 * An account can be closed when it is square: nothing owed in either
 * direction. Not "no history" — a client who traded all year and settled up is
 * exactly the one that should be able to leave the list. The balance the
 * button reads is the same figure the database re-checks before it obeys, and
 * the entries go with the client, because a ledger entry belonging to nobody
 * is not a record of anything. See 0035.
 */
export function CounterpartiesSettings({ orgId }: { orgId: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const period = usePeriodFilter('all');

  const directory = useCounterpartyDirectory(supabase, orgId, period.range);
  const update = useUpdateCounterparty(supabase);
  const remove = useDeleteCounterparty(supabase);

  const [roster, setRoster] = useState<Roster>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [draft, setDraft] = useState({ name: '', phone: '', managerId: '' });
  const [adding, setAdding] = useState({ name: '', phone: '', managerId: '' });
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void supabase
      .rpc('list_org_roster', { target_org_id: orgId })
      .then(({ data }) => setRoster(data ?? []));
  }, [supabase, orgId]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = directory.data ?? [];
    if (!needle) return all;
    return all.filter(
      (row) =>
        row.name.toLowerCase().includes(needle) || (row.phone ?? '').toLowerCase().includes(needle),
    );
  }, [directory.data, search]);

  function startEdit(row: CounterpartyDirectoryRow) {
    setErrorMessage(null);
    setConfirming(null);
    setEditing(row.counterpartyId);
    setDraft({ name: row.name, phone: row.phone ?? '', managerId: row.managerId ?? '' });
  }

  async function saveEdit(counterpartyId: string) {
    const name = draft.name.trim();
    if (!name) {
      setErrorMessage(t('counterparty.nameRequired'));
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    try {
      await update.mutateAsync({
        orgId,
        counterpartyId,
        name,
        phone: draft.phone.trim() || null,
        managerId: draft.managerId || null,
      });
      setEditing(null);
      router.refresh();
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function addCounterparty() {
    const name = adding.name.trim();
    if (!name) {
      setErrorMessage(t('counterparty.nameRequired'));
      return;
    }
    setSaving(true);
    setErrorMessage(null);

    const { error } = await supabase.from('counterparties').insert({
      org_id: orgId,
      name,
      phone: adding.phone.trim() || null,
      manager_id: adding.managerId || null,
      categories: [],
    });

    setSaving(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setAdding({ name: '', phone: '', managerId: '' });
    setAddOpen(false);
    await directory.refetch();
    router.refresh();
  }

  async function handleDelete(counterpartyId: string) {
    setSaving(true);
    setErrorMessage(null);
    try {
      await remove.mutateAsync({ orgId, counterpartyId });
      setConfirming(null);
      router.refresh();
    } catch (err) {
      // Whatever the server refuses with, it refuses in the terms of the
      // business — 0035 writes the sentence, not this file.
      setErrorMessage((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-fin-lg font-semibold text-slate-900">{t('clientsAdmin.title')}</h2>
          <p className="mt-0.5 text-fin-sm text-slate-500">{t('clientsAdmin.subtitle')}</p>
        </div>
        <Button type="button" size="sm" onClick={() => setAddOpen((open) => !open)}>
          {addOpen ? t('common.cancel') : t('addCounterparty.submit')}
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <PeriodFilter state={period} />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('sotuv.searchPlaceholder')}
          className="w-auto max-w-[14rem]"
        />
      </div>

      {addOpen && (
        <div className="mb-3 grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-4">
          <Input
            autoFocus
            value={adding.name}
            onChange={(e) => setAdding({ ...adding, name: e.target.value })}
            placeholder={t('addCounterparty.namePlaceholder')}
          />
          <Input
            value={adding.phone}
            onChange={(e) => setAdding({ ...adding, phone: e.target.value })}
            placeholder={t('addCounterparty.phonePlaceholder')}
          />
          <Select
            value={adding.managerId}
            onChange={(e) => setAdding({ ...adding, managerId: e.target.value })}
          >
            <option value="">{t('overview.manager')} —</option>
            {roster.map((r) => (
              <option key={r.user_id} value={r.user_id}>
                {r.full_name ?? r.email}
              </option>
            ))}
          </Select>
          <Button type="button" disabled={saving} onClick={() => void addCounterparty()}>
            {saving ? t('common.saving') : t('addCounterparty.submit')}
          </Button>
        </div>
      )}

      {errorMessage && <p className="mb-2 text-fin-md text-rose-600">{errorMessage}</p>}

      {directory.isPending ? (
        <p className="text-fin-md text-slate-400">{t('common.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-fin-md text-slate-500">{t('sotuv.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-fin-md">
            <thead>
              <tr className="border-b border-slate-200 text-left text-fin-sm text-slate-500">
                <th className="px-2 py-2 font-medium">{t('clientsAdmin.name')}</th>
                <th className="px-2 py-2 font-medium">{t('addCounterparty.phoneLabel')}</th>
                <th className="px-2 py-2 font-medium">{t('overview.manager')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('clientsAdmin.turnover')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('clientsAdmin.debt')}</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isEditing = editing === row.counterpartyId;
                // Square in both directions, and no warehouse or sales paper
                // naming them. Either one is a reason the server would refuse.
                const settled = Math.abs(row.balance) < 0.01;
                const canDelete = settled && row.docCount === 0;

                return (
                  <tr
                    key={row.counterpartyId}
                    className="border-b border-slate-100 align-middle last:border-0"
                  >
                    <td className="px-2 py-1.5">
                      {isEditing ? (
                        <Input
                          autoFocus
                          value={draft.name}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        />
                      ) : (
                        <Link
                          href={`/counterparty/${row.counterpartyId}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {row.name}
                        </Link>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-slate-700">
                      {isEditing ? (
                        <Input
                          value={draft.phone}
                          onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                        />
                      ) : (
                        (row.phone ?? '—')
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-slate-700">
                      {isEditing ? (
                        <Select
                          value={draft.managerId}
                          onChange={(e) => setDraft({ ...draft, managerId: e.target.value })}
                        >
                          <option value="">—</option>
                          {roster.map((r) => (
                            <option key={r.user_id} value={r.user_id}>
                              {r.full_name ?? r.email}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        (row.managerName ?? '—')
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">
                      {money.format(row.turnover)}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right tabular-nums ${
                        row.balance > 0
                          ? 'text-rose-700'
                          : row.balance < 0
                            ? 'text-emerald-700'
                            : 'text-slate-400'
                      }`}
                    >
                      {/* Negative is shown as it is: the company owing the
                          client is not "no debt", and closing that account
                          would erase an obligation. */}
                      {money.format(row.balance)}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {isEditing ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              disabled={saving}
                              onClick={() => void saveEdit(row.counterpartyId)}
                            >
                              {saving ? t('common.saving') : t('common.save')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditing(null)}
                            >
                              {t('common.cancel')}
                            </Button>
                          </>
                        ) : confirming === row.counterpartyId ? (
                          <>
                            <span className="text-fin-sm text-slate-600">
                              {t('clientsAdmin.confirm')}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              disabled={saving}
                              onClick={() => void handleDelete(row.counterpartyId)}
                            >
                              {t('common.delete')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirming(null)}
                            >
                              {t('common.cancel')}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => startEdit(row)}
                            >
                              {t('common.edit')}
                            </Button>
                            {canDelete ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="danger"
                                onClick={() => {
                                  setErrorMessage(null);
                                  setConfirming(row.counterpartyId);
                                }}
                              >
                                {t('common.delete')}
                              </Button>
                            ) : (
                              // A disabled button with no reason beside it is
                              // the same as a broken one.
                              <span className="text-fin-sm text-slate-400">
                                {settled
                                  ? t('clientsAdmin.hasDocuments')
                                  : t('clientsAdmin.hasDebt')}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
