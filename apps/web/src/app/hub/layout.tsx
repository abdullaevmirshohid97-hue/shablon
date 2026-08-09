import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Everything under /hub requires a session and nothing more. The shell — which
 * rail, which lock — belongs to each module underneath, because the hub's own
 * pages and a locked module are not the same frame.
 */
export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return <>{children}</>;
}
