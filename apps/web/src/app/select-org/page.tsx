import { getOrgContext, safeNext } from '@/lib/auth/activeOrg';
import { getServerTranslator } from '@/lib/i18n/server';
import { OrgPicker } from './org-picker';

/**
 * Which business are we in?
 *
 * The step between picking a module and reaching its data. Everything below it
 * — the ledger, the warehouse, the roster and the PIN that guards them — is
 * per-organization, so the organization has to be settled before any of it is
 * asked for. It is also where a new one is created, which needs no privileged
 * endpoint: the insert policy allows any signed-in user and a trigger makes
 * them its owner (0007).
 */
export default async function SelectOrgPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const { t } = await getServerTranslator();
  const { options, active } = await getOrgContext();
  const destination = safeNext(next);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-fin-2xl font-semibold tracking-tight text-slate-900">
        {t('org.selectTitle')}
      </h1>
      <p className="mb-6 mt-1 text-fin-md text-slate-500">
        {options.length ? t('org.selectHint') : t('org.emptyHint')}
      </p>

      <OrgPicker options={options} activeOrgId={active?.orgId ?? null} next={destination} />
    </div>
  );
}
