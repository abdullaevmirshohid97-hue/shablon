import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerTranslator } from '@/lib/i18n/server';
import { CounterpartyLedgerClient } from './ledger-client';

export default async function CounterpartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { t } = await getServerTranslator();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: counterparty } = await supabase
    .from('counterparties')
    .select('id, org_id, name')
    .eq('id', id)
    .single();

  if (!counterparty) notFound();

  return (
    <div>
      <Link
        href="/clients"
        className="no-print mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
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
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-slate-900">
        {counterparty.name}
      </h1>
      <CounterpartyLedgerClient
        orgId={counterparty.org_id}
        counterpartyId={counterparty.id}
        counterpartyName={counterparty.name}
      />
    </div>
  );
}
