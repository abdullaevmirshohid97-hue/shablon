'use client';

import { useState, useTransition } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { OrgOption } from '@/lib/auth/activeOrg';
import { chooseOrg } from './actions';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

/** A slug the database will accept: lowercase, ASCII, no doubled dashes. */
function slugify(name: string): string {
  const map: Record<string, string> = {
    ʻ: '',
    "'": '',
    '’': '',
    ў: 'u',
    қ: 'q',
    ғ: 'g',
    ҳ: 'h',
  };
  return name
    .toLowerCase()
    .replace(/[ʻ'’ўқғҳ]/g, (ch) => map[ch] ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function OrgPicker({
  options,
  activeOrgId,
  next,
  canCreate = true,
}: {
  options: OrgOption[];
  activeOrgId?: string | null;
  next: string;
  canCreate?: boolean;
}) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function pick(orgId: string) {
    startTransition(() => {
      void chooseOrg(orgId, next);
    });
  }

  /**
   * The org is inserted straight from the browser: `organizations_insert`
   * allows any signed-in user, and the 0007 trigger makes the creator its
   * owner, so no privileged endpoint is involved. The slug is unique, so a
   * collision gets one numbered retry rather than an error the user cannot act
   * on — two businesses may legitimately want the same name.
   */
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSaving(true);

    const supabase = createSupabaseBrowserClient();
    const base = slugify(name) || 'org';

    try {
      let created: string | null = null;
      for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
        const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
        const { data, error } = await supabase
          .from('organizations')
          .insert({ name: name.trim(), slug })
          .select('id')
          .single();

        if (!error) {
          created = data.id;
          break;
        }
        // 23505 = unique violation on the slug; anything else is real.
        if (error.code !== '23505') throw error;
      }

      if (!created) throw new Error(t('org.slugTaken'));

      setCreating(false);
      // chooseOrg redirects, so there is nothing here to refresh into.
      startTransition(() => {
        void chooseOrg(created!, next);
      });
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((org) => (
          <li key={org.orgId}>
            <button
              type="button"
              onClick={() => pick(org.orgId)}
              disabled={pending}
              className="w-full text-left disabled:opacity-60"
            >
              <Card className="flex h-full items-center gap-3 p-4 transition-shadow hover:shadow-popover">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-fin-lg font-bold text-white">
                  {org.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{org.name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <Badge tone={org.role === 'staff' ? 'neutral' : 'brand'}>
                      {t(`role.${org.role}`)}
                    </Badge>
                    <span className="text-fin-xs text-slate-400">{org.baseCurrency}</span>
                  </span>
                </span>
                {org.orgId === activeOrgId && <Badge tone="success">{t('org.current')}</Badge>}
              </Card>
            </button>
          </li>
        ))}
      </ul>

      {canCreate && (
        <div className="mt-4">
          <Button type="button" variant="secondary" onClick={() => setCreating(true)}>
            {t('org.createCta')}
          </Button>
        </div>
      )}

      {creating && (
        <Modal
          onClose={() => setCreating(false)}
          title={t('org.createTitle')}
          description={t('org.createHint')}
        >
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div>
              <Label>{t('org.nameLabel')}</Label>
              <Input
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('org.namePlaceholder')}
              />
              {name.trim() && (
                <p className="mt-1 text-fin-xs text-slate-400">/{slugify(name) || 'org'}</p>
              )}
            </div>

            {errorMessage && <p className="text-fin-md text-rose-600">{errorMessage}</p>}

            <div className="mt-1 flex gap-2">
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? t('common.saving') : t('common.save')}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
