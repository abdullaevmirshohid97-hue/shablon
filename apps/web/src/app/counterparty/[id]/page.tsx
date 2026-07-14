import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CounterpartyLedgerClient } from './ledger-client';

export default async function CounterpartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
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
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-xl font-semibold">{counterparty.name}</h1>
      <div className="mt-6 rounded border border-slate-200 bg-white p-4">
        <CounterpartyLedgerClient orgId={counterparty.org_id} counterpartyId={counterparty.id} />
      </div>
    </main>
  );
}
