import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/Badge';
import { StatTile, Panel, fmt } from './ui';
import {
  SUBSCRIPTION_STATUSES,
  subscriptionLabel,
  subscriptionTone,
  type SubscriptionStatus,
} from './status';

// Har doim yangi ma'lumot (operator jonli holatni ko'radi).
export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const supabase = await createSupabaseServerClient();

  // platform_admin RLS bo'yicha barcha org'larni ko'ra oladi (is_org_member => true).
  const [orgsRes, usersRes, cpRes, txRes] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, slug, subscription_status, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('counterparties').select('id', { count: 'exact', head: true }),
    supabase.from('transactions').select('id', { count: 'exact', head: true }),
  ]);

  const orgs = orgsRes.data ?? [];
  const breakdown = SUBSCRIPTION_STATUSES.map((status) => ({
    status,
    count: orgs.filter((o) => o.subscription_status === status).length,
  }));
  const newest = orgs.slice(0, 6);
  const dateLocale = 'ru-RU';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Umumiy ko&apos;rinish</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Tashkilotlar" value={fmt(orgs.length)} />
        <StatTile label="Foydalanuvchilar" value={fmt(usersRes.count)} />
        <StatTile label="Kontragentlar" value={fmt(cpRes.count)} />
        <StatTile label="Tranzaksiyalar" value={fmt(txRes.count)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Obuna holati">
          <ul className="divide-y divide-slate-800">
            {breakdown.map(({ status, count }) => (
              <li key={status} className="flex items-center justify-between px-4 py-3">
                <Badge tone={subscriptionTone(status)}>{subscriptionLabel(status)}</Badge>
                <span className="tabular-nums text-sm font-semibold text-slate-200">
                  {fmt(count)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Yangi tashkilotlar">
          {newest.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">Hozircha tashkilot yo&apos;q.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {newest.map((org) => (
                <li key={org.id}>
                  <Link
                    href={`/admin/organizations/${org.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-800/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-100">{org.name}</p>
                      <p className="truncate text-xs text-slate-500">/{org.slug}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge tone={subscriptionTone(org.subscription_status as SubscriptionStatus)}>
                        {subscriptionLabel(org.subscription_status as SubscriptionStatus)}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        {new Date(org.created_at).toLocaleDateString(dateLocale)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <p className="text-xs text-slate-600">
        Barcha tashkilotlarni ko&apos;rish uchun{' '}
        <Link href="/admin/organizations" className="text-brand-400 hover:underline">
          Tashkilotlar
        </Link>{' '}
        bo&apos;limiga o&apos;ting.
      </p>
    </div>
  );
}
