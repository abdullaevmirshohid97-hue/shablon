import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  dorixona,
  dorixonaConfigured,
  type DorixonaNetwork,
  type DorixonaStaff,
} from '@/lib/dorixona';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '../../ui';
import { addStaff, issueIntegrationKey, resetStaffPassword, updateNetwork } from '../actions';
import { AddStaffForm, EditNetworkForm, IssueKeyForm, ResetPasswordButton } from '../forms';
import { networkStatusLabel, networkStatusTone, staffRoleLabel } from '../labels';

export const dynamic = 'force-dynamic';

const cell = 'px-4 py-2.5 text-sm';

export default async function DorixonaNetworkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!dorixonaConfigured()) redirect('/admin/dorixona');

  const supabase = await createSupabaseServerClient();
  // Platforma API'sida bitta tarmoqni o'qish yo'q — ro'yxatdan topamiz (tarmoqlar o'nlab, minglab emas).
  const [networksRes, staffRes, orgsRes] = await Promise.all([
    dorixona<DorixonaNetwork[]>('GET', ''),
    dorixona<DorixonaStaff[]>('GET', `/${encodeURIComponent(slug)}/staff`),
    supabase.from('organizations').select('id, name').order('name'),
  ]);
  if (!networksRes.ok) {
    return (
      <div className="rounded-xl border border-rose-800 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
        {networksRes.message}
      </div>
    );
  }
  const network = networksRes.data.find((n) => n.slug === slug);
  if (!network) notFound();

  const orgs = orgsRes.data ?? [];
  const staff = staffRes.ok ? staffRes.data : [];

  return (
    <div className="space-y-6">
      <Link href="/admin/dorixona" className="text-sm text-slate-400 hover:text-slate-200">
        ← Dorixona
      </Link>

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{network.name}</h1>
          <Badge tone={networkStatusTone(network.status)}>
            {networkStatusLabel(network.status)}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          /{network.slug} · {new Date(network.created_at).toLocaleDateString('ru-RU')} da
          qo&apos;shilgan
        </p>
      </div>

      <Panel title="Tarmoq">
        <EditNetworkForm
          network={network}
          orgs={orgs}
          action={updateNetwork.bind(null, network.slug)}
        />
      </Panel>

      <Panel title={`Xodimlar (${staff.length})`}>
        {!staffRes.ok ? (
          <p className="px-4 py-6 text-sm text-rose-300">{staffRes.message}</p>
        ) : staff.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            Xodim yo&apos;q — avval administrator qo&apos;shing.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className={cell}>Ism</th>
                  <th className={cell}>Rol</th>
                  <th className={cell}>Telefon</th>
                  <th className={cell}>Filial</th>
                  <th className={`${cell} text-right`}>Parol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {staff.map((m) => (
                  <tr key={m.id} className={m.is_active ? '' : 'opacity-50'}>
                    <td className={`${cell} text-slate-100`}>
                      {m.full_name ?? <span className="text-slate-500">— (ismsiz)</span>}
                      {!m.is_active && (
                        <span className="ml-2 text-xs text-slate-500">(o&apos;chirilgan)</span>
                      )}
                    </td>
                    <td className={cell}>
                      <Badge tone={m.role === 'network_admin' ? 'brand' : 'neutral'}>
                        {staffRoleLabel(m.role)}
                      </Badge>
                    </td>
                    <td className={`${cell} tabular-nums text-slate-400`}>{m.phone}</td>
                    <td className={`${cell} text-slate-400`}>{m.branch?.name ?? '—'}</td>
                    <td className={`${cell} text-right`}>
                      <ResetPasswordButton
                        action={resetStaffPassword.bind(null, network.slug)}
                        phone={m.phone}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-slate-800">
          <AddStaffForm action={addStaff.bind(null, network.slug)} />
        </div>
      </Panel>

      <Panel title="1C ulanishi">
        <IssueKeyForm action={issueIntegrationKey.bind(null, network.slug)} />
      </Panel>
    </div>
  );
}
