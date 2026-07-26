'use client';

import { useCallback, useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Card } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

type Member = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: 'owner' | 'admin' | 'staff';
  created_at: string;
};

export function EmployeesSettings({ orgId }: { orgId: string }) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [members, setMembers] = useState<Member[] | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'staff'>('staff');
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    const { data } = await supabase.rpc('list_org_members', { target_org_id: orgId });
    setMembers(data ?? []);
  }, [supabase, orgId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setCreating(true);

    const { error } = await supabase.rpc('create_employee', {
      target_org_id: orgId,
      p_email: email,
      p_password: password,
      p_full_name: fullName || null,
      p_phone: phone || null,
      p_role: role,
    });

    setCreating(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setFullName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setRole('staff');
    await loadMembers();
  }

  const roleLabel = (r: Member['role']) =>
    r === 'owner'
      ? t('employees.roleOwner')
      : r === 'admin'
        ? t('employees.roleAdmin')
        : t('employees.roleStaff');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t('employees.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('employees.description')}</p>
      </div>

      <Card className="p-4">
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>{t('employees.fullNameLabel')}</Label>
            <Input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label>{t('employees.emailLabel')}</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>{t('employees.phoneLabel')}</Label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>{t('employees.passwordLabel')}</Label>
            <Input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <Label>{t('employees.roleLabel')}</Label>
            <Select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'staff')}>
              <option value="staff">{t('employees.roleStaff')}</option>
              <option value="admin">{t('employees.roleAdmin')}</option>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={creating || !email || !password} className="w-full">
              {creating ? t('employees.creating') : t('employees.createButton')}
            </Button>
          </div>
          {errorMessage && <p className="sm:col-span-2 text-sm text-rose-600">{errorMessage}</p>}
        </form>
      </Card>

      <Card className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5 pr-3 font-medium">{t('employees.columnName')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('employees.columnEmail')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('employees.columnRole')}</th>
                <th className="py-1.5 font-medium">{t('employees.columnCreatedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {members?.map((m) => (
                <tr key={m.user_id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3">{m.full_name ?? '—'}</td>
                  <td className="py-1.5 pr-3">{m.email}</td>
                  <td className="py-1.5 pr-3">
                    <Badge tone={m.role === 'staff' ? 'neutral' : 'success'}>
                      {roleLabel(m.role)}
                    </Badge>
                  </td>
                  <td className="py-1.5 tabular-nums">
                    {new Date(m.created_at).toLocaleDateString(dateLocale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {members?.length === 0 && (
            <p className="py-3 text-sm text-slate-500">{t('employees.listEmpty')}</p>
          )}
        </div>
      </Card>
    </div>
  );
}
