import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/Badge';
import { StatTile, Panel, fmt } from '../../ui';
import {
  roleLabel,
  subscriptionLabel,
  subscriptionTone,
  type OrgRole,
  type SubscriptionStatus,
} from '../../status';
import { SubscriptionForm } from './subscription-form';

export const dynamic = 'force-dynamic';

const money = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 });
const cell = 'px-4 py-2.5 text-sm';

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const dateLocale = 'ru-RU';

  const [orgRes, memRes, cpRes, txRes, txCountRes] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, slug, base_currency, subscription_status, created_at')
      .eq('id', id)
      .single(),
    supabase.from('memberships').select('user_id, role, created_at').eq('org_id', id),
    supabase
      .from('counterparties')
      .select('id, name, phone, created_at')
      .eq('org_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('transactions')
      .select('id, occurred_at, description, debit_amount, credit_amount, counterparty_id')
      .eq('org_id', id)
      .order('occurred_at', { ascending: false })
      .limit(10),
    supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('org_id', id),
  ]);

  const org = orgRes.data;
  if (!org) notFound();

  const memberships = memRes.data ?? [];
  const counterparties = cpRes.data ?? [];
  const recentTx = txRes.data ?? [];

  // memberships.user_id -> profiles (memberships'da profiles'ga to'g'ridan-to'g'ri
  // FK yo'q, shuning uchun alohida olib JS'da bog'laymiz).
  const userIds = memberships.map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', userIds);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const cpNameById = new Map(counterparties.map((c) => [c.id, c.name]));

  const status = org.subscription_status as SubscriptionStatus;

  return (
    <div className="space-y-6">
      <Link href="/admin/organizations" className="text-sm text-slate-400 hover:text-slate-200">
        ← Tashkilotlar
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
            <Badge tone={subscriptionTone(status)}>{subscriptionLabel(status)}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            /{org.slug} · {org.base_currency} ·{' '}
            {new Date(org.created_at).toLocaleDateString(dateLocale)} da yaratilgan
          </p>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Obuna holati
          </p>
          <SubscriptionForm orgId={org.id} current={status} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="A'zolar" value={fmt(memberships.length)} />
        <StatTile label="Kontragentlar" value={fmt(counterparties.length)} />
        <StatTile label="Tranzaksiyalar" value={fmt(txCountRes.count)} />
      </div>

      <Panel title="A'zolar">
        {memberships.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">A&apos;zolar yo&apos;q.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className={cell}>Ism</th>
                  <th className={cell}>Rol</th>
                  <th className={cell}>Telefon</th>
                  <th className={`${cell} text-right`}>Qo&apos;shilgan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {memberships.map((m) => {
                  const profile = profileById.get(m.user_id);
                  return (
                    <tr key={m.user_id}>
                      <td className={`${cell} text-slate-100`}>
                        {profile?.full_name ?? <span className="text-slate-500">— (ismsiz)</span>}
                      </td>
                      <td className={cell}>
                        <Badge tone={m.role === 'owner' ? 'brand' : 'neutral'}>
                          {roleLabel(m.role as OrgRole)}
                        </Badge>
                      </td>
                      <td className={`${cell} text-slate-400`}>{profile?.phone ?? '—'}</td>
                      <td className={`${cell} text-right text-xs text-slate-500`}>
                        {new Date(m.created_at).toLocaleDateString(dateLocale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={`Kontragentlar (${fmt(counterparties.length)})`}>
          {counterparties.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">Kontragent yo&apos;q.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-slate-800 overflow-y-auto">
              {counterparties.slice(0, 50).map((c) => (
                <li key={c.id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="truncate text-sm text-slate-100">{c.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">{c.phone ?? ''}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="So'nggi tranzaksiyalar">
          {recentTx.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">Tranzaksiya yo&apos;q.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className={cell}>Sana</th>
                    <th className={cell}>Kontragent</th>
                    <th className={`${cell} text-right`}>Debet</th>
                    <th className={`${cell} text-right`}>Kredit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {recentTx.map((tx) => (
                    <tr key={tx.id}>
                      <td className={`${cell} whitespace-nowrap text-xs text-slate-400`}>
                        {new Date(tx.occurred_at).toLocaleDateString(dateLocale)}
                      </td>
                      <td className={`${cell} truncate text-slate-200`}>
                        {cpNameById.get(tx.counterparty_id) ?? '—'}
                      </td>
                      <td className={`${cell} text-right tabular-nums text-emerald-400`}>
                        {tx.debit_amount ? money.format(tx.debit_amount) : ''}
                      </td>
                      <td className={`${cell} text-right tabular-nums text-rose-400`}>
                        {tx.credit_amount ? money.format(tx.credit_amount) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
