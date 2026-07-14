'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { LedgerTable } from '@/components/LedgerTable';

export function CounterpartyLedgerClient({
  orgId,
  counterpartyId,
}: {
  orgId: string;
  counterpartyId: string;
}) {
  const [supabase] = useState(() => createSupabaseBrowserClient());

  return <LedgerTable supabase={supabase} orgId={orgId} counterpartyId={counterpartyId} />;
}
