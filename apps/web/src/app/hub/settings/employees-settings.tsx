'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  avatar_url: string | null;
  role: 'owner' | 'admin' | 'staff';
  has_finance_pin: boolean;
  created_at: string;
};

// Short enough to type on a shared screen, long enough not to be guessed in
// the few tries someone gets standing at the counter. Mirrors the 4-10 rule
// enforced in 0020_admin_finance_pin.sql — the database is the authority.
const PIN_MIN = 4;
const PIN_MAX = 10;

function Avatar({ member, className = 'h-8 w-8' }: { member: Member; className?: string }) {
  if (member.avatar_url) {
    return (
      <img
        src={member.avatar_url}
        alt=""
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    );
  }
  const initial = (member.full_name ?? member.email ?? '?').trim().charAt(0).toUpperCase();
  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700`}
    >
      {initial}
    </span>
  );
}

function EditEmployeeRow({
  orgId,
  member,
  onDone,
}: {
  orgId: string;
  member: Member;
  onDone: () => void;
}) {
  const { t } = useLocale();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(member.full_name ?? '');
  const [phone, setPhone] = useState(member.phone ?? '');
  const [role, setRole] = useState(member.role);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const [newPin, setNewPin] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  // Tracked locally rather than read off the prop, so the "has a PIN" label
  // and the Clear button tell the truth before the row is reloaded.
  const [hasPin, setHasPin] = useState(member.has_finance_pin);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSaving(true);

    try {
      let avatarUrl = member.avatar_url;
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop() ?? 'jpg';
        const path = `${member.user_id}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
        if (uploadError) throw uploadError;
        avatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      }

      const { error: updateError } = await supabase.rpc('update_employee', {
        target_org_id: orgId,
        target_user_id: member.user_id,
        p_full_name: fullName || null,
        p_phone: phone || null,
        p_avatar_url: avatarUrl,
      });
      if (updateError) throw updateError;

      if (role !== member.role) {
        const { error: roleError } = await supabase
          .from('memberships')
          .update({ role })
          .eq('org_id', orgId)
          .eq('user_id', member.user_id);
        if (roleError) throw roleError;
      }

      onDone();
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    setPasswordMessage(null);
    setResettingPassword(true);
    const { error } = await supabase.rpc('reset_employee_password', {
      target_org_id: orgId,
      target_user_id: member.user_id,
      p_password: newPassword,
    });
    setResettingPassword(false);

    if (error) {
      setPasswordMessage(error.message);
      return;
    }
    setNewPassword('');
    setPasswordMessage(t('employees.passwordUpdated'));
  }

  async function handleSetPin() {
    setPinMessage(null);
    setPinBusy(true);
    const { error } = await supabase.rpc('admin_set_finance_pin', {
      target_org_id: orgId,
      target_user_id: member.user_id,
      pin: newPin,
    });
    setPinBusy(false);

    if (error) {
      setPinMessage(error.message);
      return;
    }
    setNewPin('');
    setHasPin(true);
    setPinMessage(t('employees.pinUpdated'));
  }

  // Clearing is not "no lock" — it drops this employee back to typing their
  // full login password at the Finance gate, which is the stricter of the two.
  async function handleClearPin() {
    setPinMessage(null);
    setPinBusy(true);
    const { error } = await supabase.rpc('admin_clear_finance_pin', {
      target_org_id: orgId,
      target_user_id: member.user_id,
    });
    setPinBusy(false);

    if (error) {
      setPinMessage(error.message);
      return;
    }
    setNewPin('');
    setHasPin(false);
    setPinMessage(t('employees.pinCleared'));
  }

  return (
    <tr className="border-b border-slate-100 bg-slate-50/60">
      <td colSpan={5} className="p-3">
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Avatar member={{ ...member, avatar_url: member.avatar_url }} className="h-12 w-12" />
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                {t('employees.changePhoto')}
              </Button>
              {avatarFile && <span className="ml-2 text-xs text-slate-500">{avatarFile.name}</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label>{t('employees.fullNameLabel')}</Label>
              <Input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label>{t('employees.phoneLabel')}</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            {member.role !== 'owner' && (
              <div>
                <Label>{t('employees.roleLabel')}</Label>
                <Select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'staff')}>
                  <option value="staff">{t('employees.roleStaff')}</option>
                  <option value="admin">{t('employees.roleAdmin')}</option>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? t('employees.saving') : t('employees.saveButton')}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onDone}>
              {t('employees.cancelTooltip')}
            </Button>
          </div>
          {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}

          <div className="flex items-end gap-2 border-t border-slate-200 pt-3">
            <div className="flex-1 sm:max-w-xs">
              <Label>{t('employees.newPasswordLabel')}</Label>
              <Input
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={resettingPassword || newPassword.length < 6}
              onClick={handleResetPassword}
            >
              {t('employees.resetPasswordButton')}
            </Button>
          </div>
          {passwordMessage && <p className="text-sm text-slate-600">{passwordMessage}</p>}

          <div className="flex items-end gap-2 border-t border-slate-200 pt-3">
            <div className="flex-1 sm:max-w-xs">
              <Label>
                {t('employees.financePinLabel')}
                <span className="ml-1.5 font-normal text-slate-400">
                  {hasPin ? t('employees.pinSetBadge') : t('employees.pinMissingBadge')}
                </span>
              </Label>
              <Input
                type="text"
                inputMode="text"
                autoComplete="off"
                minLength={PIN_MIN}
                maxLength={PIN_MAX}
                placeholder={t('employees.pinPlaceholder')}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pinBusy || newPin.trim().length < PIN_MIN}
              onClick={handleSetPin}
            >
              {t('employees.setPinButton')}
            </Button>
            {hasPin && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pinBusy}
                onClick={handleClearPin}
              >
                {t('employees.clearPinButton')}
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-400">{t('employees.financePinHint')}</p>
          {pinMessage && <p className="text-sm text-slate-600">{pinMessage}</p>}
        </form>
      </td>
    </tr>
  );
}

export function EmployeesSettings({ orgId }: { orgId: string }) {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uz-UZ';
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [members, setMembers] = useState<Member[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
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

    const { data: newUserId, error } = await supabase.rpc('create_employee', {
      target_org_id: orgId,
      p_email: email,
      p_password: password,
      p_full_name: fullName || null,
      p_phone: phone || null,
      p_role: role,
    });

    if (error) {
      setCreating(false);
      setErrorMessage(error.message);
      return;
    }

    // The PIN is a separate call because create_employee predates it. The
    // account already exists at this point, so a rejected PIN must not read
    // as "employee not created" — it is reported on its own.
    if (pin.trim() && newUserId) {
      const { error: pinError } = await supabase.rpc('admin_set_finance_pin', {
        target_org_id: orgId,
        target_user_id: newUserId,
        pin: pin.trim(),
      });
      if (pinError) {
        setCreating(false);
        setErrorMessage(`${t('employees.createdButPinFailed')} ${pinError.message}`);
        await loadMembers();
        return;
      }
    }

    setCreating(false);
    setFullName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setPin('');
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
            <Label>{t('employees.financePinLabel')}</Label>
            <Input
              type="text"
              inputMode="text"
              autoComplete="off"
              minLength={PIN_MIN}
              maxLength={PIN_MAX}
              placeholder={t('employees.pinPlaceholder')}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </div>
          <div>
            <Label>{t('employees.roleLabel')}</Label>
            <Select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'staff')}>
              <option value="staff">{t('employees.roleStaff')}</option>
              <option value="admin">{t('employees.roleAdmin')}</option>
            </Select>
          </div>
          <div className="flex items-end sm:col-span-2">
            <Button type="submit" disabled={creating || !email || !password} className="w-full">
              {creating ? t('employees.creating') : t('employees.createButton')}
            </Button>
          </div>
          {errorMessage && <p className="text-sm text-rose-600 sm:col-span-2">{errorMessage}</p>}
        </form>
      </Card>

      <Card className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5 pr-3 font-medium"></th>
                <th className="py-1.5 pr-3 font-medium">{t('employees.columnName')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('employees.columnRole')}</th>
                <th className="py-1.5 pr-3 font-medium">{t('employees.columnCreatedAt')}</th>
                <th className="py-1.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {members?.map((m) =>
                editingId === m.user_id ? (
                  <EditEmployeeRow
                    key={m.user_id}
                    orgId={orgId}
                    member={m}
                    onDone={() => {
                      setEditingId(null);
                      loadMembers();
                    }}
                  />
                ) : (
                  <tr key={m.user_id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-3">
                      <Avatar member={m} />
                    </td>
                    <td className="py-1.5 pr-3">
                      <span className="block font-medium text-slate-900">{m.full_name ?? '—'}</span>
                      <span className="block text-xs text-slate-400">{m.email}</span>
                    </td>
                    <td className="py-1.5 pr-3">
                      <Badge tone={m.role === 'staff' ? 'neutral' : 'success'}>
                        {roleLabel(m.role)}
                      </Badge>
                      {!m.has_finance_pin && (
                        <span className="mt-0.5 block text-[11px] text-amber-600">
                          {t('employees.pinMissingBadge')}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {new Date(m.created_at).toLocaleDateString(dateLocale)}
                    </td>
                    <td className="py-1.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(m.user_id)}
                      >
                        {t('employees.editTooltip')}
                      </Button>
                    </td>
                  </tr>
                ),
              )}
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
