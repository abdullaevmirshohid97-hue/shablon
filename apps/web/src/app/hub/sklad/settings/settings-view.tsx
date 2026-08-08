'use client';

import { useState } from 'react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Segmented } from '@/components/ui/Segmented';
import { StageSettings } from '../stage-settings';
import { LookupSettings } from '../lookup-settings';
import { ItemsList } from '../items-list';
import { SkladAuditLog } from '../sklad-audit-log';

type Section = 'stages' | 'lookups' | 'items' | 'audit';

/**
 * Everything an admin sets up or looks back at, behind one entry in the rail.
 *
 * Product cards were a top-level destination and did not deserve one: they are
 * master data, edited when a new cloth is introduced and not otherwise. Moving
 * them here — with the stage route, the dropdown lists and the change log —
 * takes the warehouse from five permanent destinations down to four, and every
 * one that remains is somewhere a person goes to do their job rather than to
 * configure the system.
 */
export function SkladSettingsView({ orgId }: { orgId: string }) {
  const { t } = useLocale();
  const [section, setSection] = useState<Section>('stages');

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t('sklad.nav.settings')}
        </h1>
        <p className="text-sm text-slate-500">{t('sklad.settings.description')}</p>
      </div>

      <Segmented
        value={section}
        onChange={setSection}
        options={[
          { value: 'stages', label: t('sklad.settings.stages') },
          { value: 'lookups', label: t('sklad.settings.lookups') },
          { value: 'items', label: t('sklad.settings.items') },
          { value: 'audit', label: t('sklad.settings.audit') },
        ]}
        className="self-start"
      />

      {section === 'stages' && <StageSettings orgId={orgId} />}
      {section === 'lookups' && <LookupSettings orgId={orgId} />}
      {section === 'items' && <ItemsList orgId={orgId} isOrgAdmin />}
      {section === 'audit' && <SkladAuditLog orgId={orgId} />}
    </div>
  );
}
