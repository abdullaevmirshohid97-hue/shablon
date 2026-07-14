import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role_platform')
    .eq('id', user.id)
    .single();

  if (profile?.role_platform !== 'platform_admin') redirect('/dashboard');

  const { data: organizations } = await supabase
    .from('organizations')
    .select('id, name, slug, subscription_status, created_at')
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-xl font-semibold">Super-admin: tashkilotlar</h1>
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 pr-4">Nomi</th>
            <th className="py-2 pr-4">Slug</th>
            <th className="py-2">Obuna holati</th>
          </tr>
        </thead>
        <tbody>
          {organizations?.map((org) => (
            <tr key={org.id} className="border-b border-slate-100">
              <td className="py-2 pr-4">{org.name}</td>
              <td className="py-2 pr-4 text-slate-500">{org.slug}</td>
              <td className="py-2">{org.subscription_status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
