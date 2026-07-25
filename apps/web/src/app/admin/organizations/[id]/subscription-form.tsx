'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { SUBSCRIPTION_STATUSES, subscriptionLabel, type SubscriptionStatus } from '../../status';

export function SubscriptionForm({
  orgId,
  current,
}: {
  orgId: string;
  current: SubscriptionStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<SubscriptionStatus>(current);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: SubscriptionStatus) {
    setStatus(next);
    setSaving(true);
    setSaved(false);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    // RLS: organizations_update platform_admin'ga ruxsat beradi.
    const { error: updateError } = await supabase
      .from('organizations')
      .update({ subscription_status: next })
      .eq('id', orgId);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      setStatus(current);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={(e) => handleChange(e.target.value as SubscriptionStatus)}
        disabled={saving}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 focus:border-brand-500 focus:outline-none disabled:opacity-60"
      >
        {SUBSCRIPTION_STATUSES.map((s) => (
          <option key={s} value={s}>
            {subscriptionLabel(s)}
          </option>
        ))}
      </select>
      {saving && <span className="text-xs text-slate-400">Saqlanmoqda…</span>}
      {saved && !saving && <span className="text-xs text-emerald-400">Saqlandi ✓</span>}
      {error && <span className="text-xs text-rose-400">{error}</span>}
    </div>
  );
}
