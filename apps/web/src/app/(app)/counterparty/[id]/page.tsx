import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerTranslator } from '@/lib/i18n/server';
import { CounterpartySettings } from '@/components/CounterpartySettings';
import { CounterpartyLedgerClient } from './ledger-client';

export default async function CounterpartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { t } = await getServerTranslator();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: counterparty, error } = await supabase
    .from('counterparties')
    .select('id, org_id, name, phone, currency, manager_id, notes')
    .eq('id', id)
    .single();

  // A failed query is not a missing client. Collapsing both into notFound()
  // turned any error here into a bare 404 with nothing in the logs to explain
  // it — which is exactly what an embedded organizations(name) select did
  // when it was folded into this query.
  if (error) throw new Error(`counterparty ${id} could not be loaded: ${error.message}`);
  if (!counterparty) notFound();

  // Decoration for the print header only. Fetched separately and allowed to
  // come back null, so it can never take the whole ledger page down with it.
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', counterparty.org_id)
    .maybeSingle();

  const orgName = org?.name ?? null;

  // Managers read; owner/admin edit. Same split as the client directory.
  const { data: memberships } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('org_id', counterparty.org_id);
  const role = memberships?.[0]?.role;
  const canWrite = role === 'owner' || role === 'admin';

  return (
    <div>
      <Link
        href="/clients"
        className="no-print mb-3 inline-flex items-center gap-1 text-fin-md text-slate-500 hover:text-slate-700"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path
            fillRule="evenodd"
            d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        {t('nav.allClients')}
      </Link>
      {/* On paper this heading is replaced by PrintHeader, which also carries
          the org, the period and the print timestamp. */}
      <h1 className="no-print mb-6 text-fin-2xl font-semibold tracking-tight text-slate-900">
        {counterparty.name}
      </h1>
      <div className="mb-4">
        <CounterpartySettings
          orgId={counterparty.org_id}
          counterpartyId={counterparty.id}
          canWrite={canWrite}
          initial={{
            name: counterparty.name,
            phone: counterparty.phone,
            currency: counterparty.currency,
            managerId: counterparty.manager_id,
            notes: counterparty.notes,
          }}
        />
      </div>

      <CounterpartyLedgerClient
        orgId={counterparty.org_id}
        orgName={orgName}
        counterpartyId={counterparty.id}
        counterpartyName={counterparty.name}
      />
    </div>
  );
}
