'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { CounterpartyJournalRow, OrgRole } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { OrgOption } from '@/lib/auth/activeOrg';

/**
 * The whole group, one organization at a time.
 *
 * Fanned out across the existing per-org functions rather than answered by a
 * new cross-org one. Two reasons: `counterparty_journal` and `list_org_roster`
 * are already correct — the aging rule in one of them took three migrations to
 * get right — and every call still passes through `is_org_member`, so this
 * screen cannot reach a business the account is not in even by accident. A
 * function that looped organizations server-side would have to be trusted to
 * re-implement that check.
 *
 * The cost is one round trip per organization. At the scale this exists for —
 * someone running a handful of businesses — that is cheaper than the migration
 * it saves.
 */

export interface OrgJournal {
  org: OrgOption;
  rows: CounterpartyJournalRow[];
}

export interface RosterMember {
  userId: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: OrgRole | null;
}

export interface OrgRoster {
  org: OrgOption;
  members: RosterMember[];
}

function useBrowserClient() {
  const [client] = useState(() => createSupabaseBrowserClient());
  return client;
}

export function useAllOrgJournals(orgs: OrgOption[]) {
  const supabase = useBrowserClient();
  const ids = orgs.map((o) => o.orgId).join(',');

  return useQuery({
    queryKey: ['director-journals', ids],
    enabled: orgs.length > 0,
    queryFn: async (): Promise<OrgJournal[]> =>
      Promise.all(
        orgs.map(async (org) => {
          const { data, error } = await supabase.rpc('counterparty_journal', {
            target_org_id: org.orgId,
          });
          if (error) throw error;

          return {
            org,
            rows: (data ?? []).map((r) => ({
              counterpartyId: r.counterparty_id,
              name: r.counterparty_name,
              phone: r.phone,
              currency: r.currency,
              categories: r.categories ?? [],
              managerId: r.manager_id,
              managerName: r.manager_name,
              totalDebt: Number(r.total_debt),
              overdueAmount: Number(r.overdue_amount),
              overdue1To30: Number(r.overdue_1_30 ?? 0),
              overdue31To60: Number(r.overdue_31_60 ?? 0),
              overdue61To90: Number(r.overdue_61_90 ?? 0),
              overdue90Plus: Number(r.overdue_90_plus ?? 0),
              notYetDue: Number(r.not_yet_due ?? 0),
              overdueDate: r.overdue_date,
              nextDueDate: r.next_due_date,
              lastEntryAt: r.last_entry_at,
              entryCount: Number(r.entry_count),
            })),
          };
        }),
      ),
  });
}

export function useAllOrgRosters(orgs: OrgOption[]) {
  const supabase = useBrowserClient();
  const ids = orgs.map((o) => o.orgId).join(',');

  return useQuery({
    queryKey: ['director-rosters', ids],
    enabled: orgs.length > 0,
    queryFn: async (): Promise<OrgRoster[]> =>
      Promise.all(
        orgs.map(async (org) => {
          // The roster names people; memberships says what each of them may
          // do. Two reads because the RPC exists to resolve names an ordinary
          // member cannot read out of auth.users, and roles are not its job.
          const [{ data: roster, error }, { data: rows }] = await Promise.all([
            supabase.rpc('list_org_roster', { target_org_id: org.orgId }),
            supabase.from('memberships').select('user_id, role').eq('org_id', org.orgId),
          ]);
          if (error) throw error;

          const roleOf = new Map((rows ?? []).map((r) => [r.user_id, r.role as OrgRole]));

          return {
            org,
            members: (roster ?? []).map((m) => ({
              userId: m.user_id,
              fullName: m.full_name,
              email: m.email,
              avatarUrl: m.avatar_url,
              role: roleOf.get(m.user_id) ?? null,
            })),
          };
        }),
      ),
  });
}
