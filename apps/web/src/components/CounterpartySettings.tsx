'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useModules, useUpdateCounterparty } from '@mubosher/api-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Input, Label, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ToggleChip } from '@/components/ui/Badge';

const textareaClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-fin-md text-slate-900 ' +
  'placeholder:text-slate-400 transition-shadow focus:border-brand-500';

/** Tags are a set, not a list: reordering them is not an edit. */
function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
}

/**
 * The client's own details, on their page.
 *
 * Currency sits first because it governs how every figure below it reads: a
 * client who trades in dollars has their account kept in dollars, and the
 * ledger, the analytics and the journal all take the code from here. Changing
 * it is a decision about the account, not a display preference, which is why
 * it is at the top rather than buried with the phone number.
 *
 * Notes get their own field and their own room. They were a column on the
 * table that nothing ever wrote to — the place where "pays late, always
 * settles" or "call the warehouse before delivering" has to live, and a
 * single-line input is not that place.
 *
 * The name is here too, and was the omission that mattered most: it could be
 * set once when the client was created and never again. A client mistyped at
 * seven in the morning stayed mistyped on every invoice, every despatch note
 * and every ledger export from then on, and the only remedy in the product was
 * to create a second client and leave the first one sitting there. Correcting
 * it is one column and it belongs at the top.
 */
export function CounterpartySettings({
  orgId,
  counterpartyId,
  initial,
  canWrite,
  onSaved,
}: {
  orgId: string;
  counterpartyId: string;
  initial: {
    name: string;
    phone?: string | null;
    currency?: string | null;
    managerId?: string | null;
    notes?: string | null;
    categories?: string[];
  };
  canWrite: boolean;
  /** Called once a save has gone through — the dialog this sits in closes on it. */
  onSaved?: () => void;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const update = useUpdateCounterparty(supabase);
  const { data: modules } = useModules(supabase, orgId);

  const initialCategories = initial.categories ?? [];
  const [name, setName] = useState(initial.name);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [currency, setCurrency] = useState(initial.currency ?? '');
  const [managerId, setManagerId] = useState(initial.managerId ?? '');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [roster, setRoster] = useState<
    { user_id: string; full_name: string | null; email: string | null }[]
  >([]);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void supabase
      .from('currencies')
      .select('code')
      .order('code')
      .then(({ data }) => setCurrencies((data ?? []).map((c) => c.code)));
    void supabase
      .rpc('list_org_roster', { target_org_id: orgId })
      .then(({ data }) => setRoster(data ?? []));
  }, [supabase, orgId]);

  // Edits here are not drafted anywhere — the saved values live on the server
  // and restoring a stale copy would quietly overwrite someone else's change.
  // So the form says out loud that it is dirty, and the browser asks before
  // the tab closes on top of it.
  const isDirty =
    name !== initial.name ||
    !sameSet(categories, initialCategories) ||
    currency !== (initial.currency ?? '') ||
    managerId !== (initial.managerId ?? '') ||
    phone !== (initial.phone ?? '') ||
    notes !== (initial.notes ?? '');

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  function toggleCategory(label: string) {
    setCategories((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSaved(false);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage(t('counterparty.nameRequired'));
      return;
    }

    try {
      await update.mutateAsync({
        orgId,
        counterpartyId,
        name: trimmedName,
        categories,
        phone: phone.trim() || null,
        // Empty means "follow the organisation's own currency", which is what
        // the journal falls back to — not a client trading in nothing.
        currency: currency || null,
        managerId: managerId || null,
        notes: notes.trim() || null,
      });
      // What was sent is what was saved, so the fields hold the trimmed value
      // too — otherwise trailing whitespace leaves the form comparing itself
      // to the server and calling that unsaved work.
      setName(trimmedName);
      setPhone(phone.trim());
      setNotes(notes.trim());
      setSaved(true);
      onSaved?.();
      // The name is printed by the page heading, the ledger header and the
      // print header, all rendered on the server — none of which knows the
      // form just changed it.
      router.refresh();
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  // No card of its own: this lives inside a dialog now, and a card inside a
  // dialog is a border drawn on top of a border.
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <Label>{t('addCounterparty.nameLabel')}</Label>
        <Input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!canWrite}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label>{t('counterparty.currencyLabel')}</Label>
          <Select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={!canWrite}
          >
            <option value="">{t('counterparty.currencyDefault')}</option>
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-fin-xs leading-snug text-slate-400">
            {t('counterparty.currencyHint')}
          </p>
        </div>
        <div>
          <Label>{t('overview.manager')}</Label>
          <Select
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
            disabled={!canWrite}
          >
            <option value="">—</option>
            {roster.map((r) => (
              <option key={r.user_id} value={r.user_id}>
                {r.full_name ?? r.email}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>{t('addCounterparty.phoneLabel')}</Label>
          <Input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={!canWrite}
          />
        </div>
      </div>

      <div>
        <Label>{t('addCounterparty.categoriesLabel')}</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {(modules ?? []).map((m) => (
            <ToggleChip
              key={m.id}
              active={categories.includes(m.name)}
              onClick={() => canWrite && toggleCategory(m.name)}
            >
              {m.name}
            </ToggleChip>
          ))}
          {/* A tag the client carries that no module declares any more —
                shown so it can be taken off, rather than silently kept. */}
          {categories
            .filter((c) => !modules?.some((m) => m.name === c))
            .map((c) => (
              <ToggleChip key={c} active onClick={() => canWrite && toggleCategory(c)}>
                {c} ×
              </ToggleChip>
            ))}
        </div>
      </div>

      <div>
        <Label>{t('counterparty.notesLabel')}</Label>
        <textarea
          className={textareaClass}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('counterparty.notesPlaceholder')}
          disabled={!canWrite}
        />
      </div>

      {errorMessage && <p className="text-fin-md text-rose-600">{errorMessage}</p>}

      {canWrite && (
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={update.isPending}>
            {update.isPending ? t('common.saving') : t('common.save')}
          </Button>
          {saved && !isDirty && (
            <span className="text-fin-md text-emerald-700">{t('counterparty.saved')}</span>
          )}
          {isDirty && (
            <span className="text-fin-sm text-amber-700">{t('ledger.draftUnsaved')}</span>
          )}
        </div>
      )}
    </form>
  );
}
