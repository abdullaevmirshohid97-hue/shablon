import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/Badge';
import { fmt } from '../ui';
import { subscriptionLabel, subscriptionTone, type SubscriptionStatus } from '../status';

export const dynamic = 'force-dynamic';

// Kichik jadvallar (memberships/counterparties) uchun org_id'ni bir marta olib,
// JS'da sanaymiz. Katta o'lchamda (ko'p tranzaksiya) buni RPC/view'ga ko'chirish kerak.
function tally(rows: { org_id: string }[] | null | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows ?? []) m.set(r.org_id, (m.get(r.org_id) ?? 0) + 1);
  return m;
}

const cell = 'px-4 py-3 text-sm';

export default async function OrganizationsPage() {
  const supabase = await createSupabaseServerClient();

  const [orgsRes, memRes, cpRes, txRes] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, slug, subscription_status, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('memberships').select('org_id'),
    supabase.from('counterparties').select('org_id'),
    supabase.from('transactions').select('org_id'),
  ]);

  const orgs = orgsRes.data ?? [];
  const members = tally(memRes.data);
  const counterparties = tally(cpRes.data);
  const transactions = tally(txRes.data);
  const dateLocale = 'ru-RU';

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Tashkilotlar</h1>
        <span className="text-sm text-slate-400">{fmt(orgs.length)} ta</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
              <th className={cell}>Tashkilot</th>
              <th className={cell}>Holat</th>
              <th className={`${cell} text-right`}>A&apos;zolar</th>
              <th className={`${cell} text-right`}>Kontragentlar</th>
              <th className={`${cell} text-right`}>Tranzaksiyalar</th>
              <th className={`${cell} text-right`}>Yaratilgan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {orgs.map((org) => (
              <tr key={org.id} className="transition-colors hover:bg-slate-800/50">
                <td className={cell}>
                  <Link href={`/admin/organizations/${org.id}`} className="block">
                    <span className="font-medium text-slate-100 hover:text-brand-400">
                      {org.name}
                    </span>
                    <span className="block text-xs text-slate-500">/{org.slug}</span>
                  </Link>
                </td>
                <td className={cell}>
                  <Badge tone={subscriptionTone(org.subscription_status as SubscriptionStatus)}>
                    {subscriptionLabel(org.subscription_status as SubscriptionStatus)}
                  </Badge>
                </td>
                <td className={`${cell} text-right tabular-nums text-slate-300`}>
                  {fmt(members.get(org.id))}
                </td>
                <td className={`${cell} text-right tabular-nums text-slate-300`}>
                  {fmt(counterparties.get(org.id))}
                </td>
                <td className={`${cell} text-right tabular-nums text-slate-300`}>
                  {fmt(transactions.get(org.id))}
                </td>
                <td className={`${cell} text-right text-xs text-slate-500`}>
                  {new Date(org.created_at).toLocaleDateString(dateLocale)}
                </td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  Hozircha tashkilot yo&apos;q.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
