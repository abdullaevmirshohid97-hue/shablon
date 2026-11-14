import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { dorixona, dorixonaConfigured, type DorixonaNetwork } from '@/lib/dorixona';
import { Badge } from '@/components/ui/Badge';
import { Panel, StatTile, fmt } from '../ui';
import { CreateNetworkForm } from './forms';
import { networkStatusLabel, networkStatusTone } from './labels';

export const dynamic = 'force-dynamic';

const cell = 'px-4 py-2.5 text-sm';

// dorixona.idaa.uz — dorixona tarmoqlari alohida serverda; bu sahifa ularni
// platforma API'si orqali (server -> server) ko'rsatadi va qo'shadi.
export default async function DorixonaPage() {
  if (!dorixonaConfigured()) return <NotConfigured />;

  const supabase = await createSupabaseServerClient();
  const [networksRes, orgsRes] = await Promise.all([
    dorixona<DorixonaNetwork[]>('GET', ''),
    supabase.from('organizations').select('id, name').order('name'),
  ]);
  const orgs = orgsRes.data ?? [];
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));
  const networks = networksRes.ok ? networksRes.data : [];
  const dateLocale = 'ru-RU';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dorixona</h1>
        <p className="mt-1 text-sm text-slate-500">
          dorixona.idaa.uz tarmoqlari. Har tarmoqning o&apos;z ilovasi, paneli va 1C ulanishi bor.
        </p>
      </div>

      {!networksRes.ok && (
        <div className="rounded-xl border border-rose-800 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
          {networksRes.message}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Tarmoqlar" value={fmt(networks.length)} />
        <StatTile label="Faol" value={fmt(networks.filter((n) => n.status === 'active').length)} />
        <StatTile
          label="To'xtatilgan"
          value={fmt(networks.filter((n) => n.status === 'suspended').length)}
        />
      </div>

      <Panel title="Tarmoqlar">
        {networks.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">Hali tarmoq yo&apos;q.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className={cell}>Tarmoq</th>
                  <th className={cell}>Holati</th>
                  <th className={cell}>STIR</th>
                  <th className={cell}>idaa.uz tashkiloti</th>
                  <th className={`${cell} text-right`}>Qo&apos;shilgan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {networks.map((n) => (
                  <tr key={n.slug} className="hover:bg-slate-800/40">
                    <td className={cell}>
                      <Link
                        href={`/admin/dorixona/${n.slug}`}
                        className="font-medium text-slate-100 hover:underline"
                      >
                        {n.name}
                      </Link>
                      <span className="ml-2 text-xs text-slate-500">/{n.slug}</span>
                    </td>
                    <td className={cell}>
                      <Badge tone={networkStatusTone(n.status)}>
                        {networkStatusLabel(n.status)}
                      </Badge>
                    </td>
                    <td className={`${cell} tabular-nums text-slate-400`}>{n.tin ?? '—'}</td>
                    <td className={`${cell} text-slate-400`}>
                      {n.idaa_org_id ? (orgName.get(n.idaa_org_id) ?? '—') : '—'}
                    </td>
                    <td className={`${cell} text-right text-xs text-slate-500`}>
                      {new Date(n.created_at).toLocaleDateString(dateLocale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Yangi tarmoq">
        <CreateNetworkForm orgs={orgs} />
      </Panel>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dorixona</h1>
      <Panel title="Ulanmagan">
        <div className="space-y-2 px-4 py-4 text-sm text-slate-400">
          <p>
            Bu server dorixona.idaa.uz bilan hali ulanmagan. Serverdagi kalitlar fayliga ikki qator
            kerak:
          </p>
          <pre className="overflow-x-auto rounded-lg bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200">
            {
              'DORIXONA_API_URL=https://dorixona.idaa.uz/api/v1\nDORIXONA_PLATFORM_KEY=<dorixona serveridagi PLATFORM_KEY>'
            }
          </pre>
          <p>Qanday qo&apos;yish — infra/DEPLOY.md, “Dorixona” bo&apos;limi.</p>
        </div>
      </Panel>
    </div>
  );
}
