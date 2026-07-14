import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('memberships')
    .select('org_id, role, organizations(name, slug)')
    .eq('user_id', user.id);

  const org = memberships?.[0];

  if (!org) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-xl font-semibold">Xush kelibsiz</h1>
        <p className="mt-2 text-slate-600">
          Sizga hali birorta tashkilotga a&apos;zolik berilmagan. Super-admin bilan bog&apos;laning.
        </p>
      </main>
    );
  }

  const { data: counterparties } = await supabase
    .from('counterparties')
    .select('id, name, categories')
    .eq('org_id', org.org_id)
    .order('name');

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold">Kontragentlar</h1>
      <ul className="mt-4 divide-y divide-slate-200 rounded border border-slate-200 bg-white">
        {counterparties?.map((c) => (
          <li key={c.id}>
            <Link href={`/counterparty/${c.id}`} className="block px-4 py-3 hover:bg-slate-50">
              <span className="font-medium">{c.name}</span>
              {c.categories?.length ? (
                <span className="ml-2 text-sm text-slate-500">{c.categories.join(', ')}</span>
              ) : null}
            </Link>
          </li>
        ))}
        {!counterparties?.length && (
          <li className="px-4 py-3 text-sm text-slate-500">Hozircha kontragentlar yo&apos;q</li>
        )}
      </ul>
    </main>
  );
}
