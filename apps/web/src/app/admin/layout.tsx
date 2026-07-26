import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AdminShell } from './admin-shell';

// Super-admin paneli hech qachon qidiruvga tushmasin (Caddy ham noindex qo'yadi).
export const metadata: Metadata = {
  title: 'Mubosher — Super Admin',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Yagona darvoza: faqat platform_admin roli. Boshqa hamma tenant ilovasiga qaytadi.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role_platform, full_name')
    .eq('id', user.id)
    .single();

  if (profile?.role_platform !== 'platform_admin') redirect('/hub');

  return <AdminShell userName={profile.full_name ?? user.email ?? ''}>{children}</AdminShell>;
}
