import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@mubosher/api-client';

// Every client component used to call this to make its own client, which
// meant a fresh GoTrueClient (and auth-state listener) per component
// instance — Supabase warns about this, and it adds real overhead on every
// navigation. One memoized instance per browser tab fixes both.
let client: SupabaseClient<Database> | undefined;

export function createSupabaseBrowserClient(): SupabaseClient<Database> {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}
