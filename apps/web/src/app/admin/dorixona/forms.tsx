'use client';

import { useActionState, useState } from 'react';
import type { DorixonaNetwork } from '@/lib/dorixona';
import { createNetwork, type ActionState } from './actions';
import { ADMIN_STAFF_ROLES, NETWORK_STATUSES, networkStatusLabel, staffRoleLabel } from './labels';

// Dorixona bo'limi shakllari. Kalit faqat serverda: shakllar server action'ni
// chaqiradi, dorixona API'siga brauzer hech qachon to'g'ridan-to'g'ri bormaydi.

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;
type Org = { id: string; name: string };

const inputCls =
  'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none';
const labelCls = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500';
const buttonCls =
  'rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-60';

function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input className={inputCls} {...props} />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function OrgSelect({ orgs, defaultValue }: { orgs: Org[]; defaultValue?: string | null }) {
  return (
    <label className="block">
      <span className={labelCls}>idaa.uz tashkiloti</span>
      <select name="idaa_org_id" defaultValue={defaultValue ?? ''} className={inputCls}>
        <option value="">— bog&apos;lanmagan —</option>
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Secret({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <code className="select-all break-all rounded-md bg-slate-950 px-2 py-1 font-mono text-base text-white">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
      >
        {copied ? 'Nusxalandi ✓' : 'Nusxalash'}
      </button>
    </div>
  );
}

function Result({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <div
      role="status"
      className={`rounded-lg border px-3 py-2 text-sm ${
        state.ok
          ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300'
          : 'border-rose-800 bg-rose-950/40 text-rose-300'
      }`}
    >
      <p>{state.message}</p>
      {state.secret && <Secret value={state.secret} />}
    </div>
  );
}

export function CreateNetworkForm({ orgs }: { orgs: Org[] }) {
  const [state, action, pending] = useActionState(createNetwork, null);

  return (
    <form action={action} className="space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Tarmoq nomi"
          name="name"
          required
          maxLength={120}
          placeholder="Shifo dorixonalari"
        />
        <Field
          label="Qisqa nom (slug)"
          name="slug"
          required
          maxLength={40}
          pattern="[a-z0-9](?:[a-z0-9\-]{0,38}[a-z0-9])?"
          placeholder="shifo"
          hint="Lotin kichik harf, raqam va “-”. Ilova va manzilda ishlatiladi, keyin o'zgarmaydi."
        />
        <Field
          label="Yuridik nomi"
          name="legal_name"
          maxLength={200}
          placeholder={'"SHIFO FARM" MChJ'}
        />
        <Field
          label="STIR"
          name="tin"
          inputMode="numeric"
          pattern="\d{9}|\d{14}"
          placeholder="123456789"
          hint="9 raqam (yakka tadbirkor — JShShIR, 14 raqam)"
        />
        <OrgSelect orgs={orgs} />
      </div>

      <div className="border-t border-slate-800 pt-4">
        <p className="mb-3 text-sm text-slate-400">
          Birinchi administrator — u dorixona panelida filiallar va xodimlarni o&apos;zi
          qo&apos;shadi.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Administrator ismi" name="admin_name" required maxLength={120} />
          <Field
            label="Administrator telefoni"
            name="admin_phone"
            required
            type="tel"
            placeholder="+998 90 123 45 67"
          />
        </div>
      </div>

      <Result state={state} />
      <button type="submit" disabled={pending} className={buttonCls}>
        {pending ? "Qo'shilmoqda…" : "Tarmoqni qo'shish"}
      </button>
    </form>
  );
}

export function EditNetworkForm({
  network,
  orgs,
  action: save,
}: {
  network: DorixonaNetwork;
  orgs: Org[];
  action: Action;
}) {
  const [state, action, pending] = useActionState(save, null);

  return (
    <form action={action} className="space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Tarmoq nomi"
          name="name"
          required
          maxLength={120}
          defaultValue={network.name}
        />
        <label className="block">
          <span className={labelCls}>Holati</span>
          <select name="status" defaultValue={network.status} className={inputCls}>
            {NETWORK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {networkStatusLabel(s)}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-500">
            To&apos;xtatilgan tarmoq marketplace&apos;da ko&apos;rinmaydi va buyurtma olmaydi.
          </span>
        </label>
        <Field
          label="Yuridik nomi"
          name="legal_name"
          maxLength={200}
          defaultValue={network.legal_name ?? ''}
        />
        <Field
          label="STIR"
          name="tin"
          inputMode="numeric"
          pattern="\d{9}|\d{14}"
          defaultValue={network.tin ?? ''}
        />
        <OrgSelect orgs={orgs} defaultValue={network.idaa_org_id} />
      </div>
      <Result state={state} />
      <button type="submit" disabled={pending} className={buttonCls}>
        {pending ? 'Saqlanmoqda…' : 'Saqlash'}
      </button>
    </form>
  );
}

export function AddStaffForm({ action: add }: { action: Action }) {
  const [state, action, pending] = useActionState(add, null);

  return (
    <form action={action} className="space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Ismi" name="full_name" required maxLength={120} />
        <Field label="Telefon" name="phone" required type="tel" placeholder="+998 90 123 45 67" />
        <label className="block">
          <span className={labelCls}>Rol</span>
          <select name="role" defaultValue="network_admin" className={inputCls}>
            {ADMIN_STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {staffRoleLabel(r)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Result state={state} />
      <button type="submit" disabled={pending} className={buttonCls}>
        {pending ? "Qo'shilmoqda…" : "Xodim qo'shish"}
      </button>
    </form>
  );
}

export function ResetPasswordButton({ action: reset, phone }: { action: Action; phone: string }) {
  const [state, action, pending] = useActionState(reset, null);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `${phone} uchun yangi parol berilsinmi? Eski parol va ochiq seanslar ishlamay qoladi.`,
          )
        ) {
          e.preventDefault();
        }
      }}
      className="space-y-2"
    >
      <input type="hidden" name="phone" value={phone} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? '…' : 'Yangi parol'}
      </button>
      <Result state={state} />
    </form>
  );
}

export function IssueKeyForm({ action: issue }: { action: Action }) {
  const [state, action, pending] = useActionState(issue, null);

  return (
    <form action={action} className="space-y-4 p-4">
      <p className="text-sm text-slate-400">
        1C tarmoqning filiallari, dorilari va qoldiqlarini shu kalit bilan yuboradi. Kalit bir marta
        ko&apos;rsatiladi; eskisini tarmoq administratori panelda bekor qiladi.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-60">
          <Field label="Kalit nomi" name="name" maxLength={80} defaultValue="1C" />
        </div>
        <button type="submit" disabled={pending} className={buttonCls}>
          {pending ? 'Berilmoqda…' : 'Yangi kalit berish'}
        </button>
      </div>
      <Result state={state} />
    </form>
  );
}
