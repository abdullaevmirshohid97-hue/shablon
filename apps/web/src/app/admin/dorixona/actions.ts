'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { dorixona, type DorixonaNetwork } from '@/lib/dorixona';
import { ADMIN_STAFF_ROLES, NETWORK_STATUSES } from './labels';

/**
 * What the super-admin does to dorixona networks.
 *
 * Every one of these is its own POST endpoint: the admin layout's gate guards
 * the pages, not the actions, so each action checks the platform_admin role
 * again before it spends the platform key. The arguments bound to an action
 * (the network's slug) come back from the browser too, so they are checked as
 * well — the dorixona API checks every field again on its side.
 */

export type ActionState = {
  ok: boolean;
  message: string;
  /** A temporary password or a 1C key: dorixona keeps only its hash, so it is shown once, here. */
  secret?: string;
} | null;

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const DENIED: ActionState = {
  ok: false,
  message: 'Bu amal faqat platforma administratoriga ruxsat etilgan',
};
const BAD_SLUG: ActionState = { ok: false, message: 'Tarmoq topilmadi' };

async function isPlatformAdmin(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role_platform')
    .eq('id', user.id)
    .single();
  return profile?.role_platform === 'platform_admin';
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

const optional = (value: string) => value || null;

function passwordNote(password: string | null, who: string): ActionState {
  return password
    ? {
        ok: true,
        message: `${who}. Vaqtinchalik parol — faqat hozir ko'rinadi, egasiga bering:`,
        secret: password,
      }
    : { ok: true, message: `${who}. Uning dorixonada paroli bor — o'sha parol bilan kiradi.` };
}

export async function createNetwork(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await isPlatformAdmin())) return DENIED;

  const slug = text(form, 'slug').toLowerCase();
  const network = await dorixona<DorixonaNetwork>('POST', '', {
    slug,
    name: text(form, 'name'),
    legal_name: optional(text(form, 'legal_name')),
    tin: optional(text(form, 'tin')),
    idaa_org_id: optional(text(form, 'idaa_org_id')),
  });
  if (!network.ok) return { ok: false, message: network.message };
  revalidatePath('/admin/dorixona');

  // Tarmoqning birinchi administratori — u panelda filial va xodimlarni o'zi qo'shadi.
  const admin = await dorixona<{ password: string | null }>('POST', `/${network.data.slug}/staff`, {
    phone: text(form, 'admin_phone'),
    full_name: text(form, 'admin_name'),
    role: 'network_admin',
  });
  if (!admin.ok) {
    return {
      ok: false,
      message: `“${network.data.name}” qo'shildi, lekin administrator qo'shilmadi: ${admin.message}. Uni tarmoq sahifasida qo'shing.`,
    };
  }
  return passwordNote(admin.data.password, `“${network.data.name}” qo'shildi, administrator ham`);
}

export async function updateNetwork(
  slug: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!(await isPlatformAdmin())) return DENIED;
  if (!SLUG.test(slug)) return BAD_SLUG;

  const status = text(form, 'status');
  if (!NETWORK_STATUSES.includes(status as never)) return { ok: false, message: "Holat noto'g'ri" };

  const res = await dorixona<DorixonaNetwork>('PATCH', `/${slug}`, {
    name: text(form, 'name'),
    legal_name: optional(text(form, 'legal_name')),
    tin: optional(text(form, 'tin')),
    idaa_org_id: optional(text(form, 'idaa_org_id')),
    status,
  });
  if (!res.ok) return { ok: false, message: res.message };
  revalidatePath('/admin/dorixona');
  revalidatePath(`/admin/dorixona/${slug}`);
  return { ok: true, message: 'Saqlandi' };
}

export async function addStaff(
  slug: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!(await isPlatformAdmin())) return DENIED;
  if (!SLUG.test(slug)) return BAD_SLUG;

  const role = text(form, 'role');
  if (!ADMIN_STAFF_ROLES.includes(role as never)) return { ok: false, message: "Rol noto'g'ri" };

  const res = await dorixona<{ full_name: string | null; password: string | null }>(
    'POST',
    `/${slug}/staff`,
    {
      phone: text(form, 'phone'),
      full_name: text(form, 'full_name'),
      role,
    },
  );
  if (!res.ok) return { ok: false, message: res.message };
  revalidatePath(`/admin/dorixona/${slug}`);
  return passwordNote(res.data.password, `${res.data.full_name ?? 'Xodim'} qo'shildi`);
}

export async function resetStaffPassword(
  slug: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!(await isPlatformAdmin())) return DENIED;
  if (!SLUG.test(slug)) return BAD_SLUG;

  const res = await dorixona<{ password: string | null }>('POST', `/${slug}/staff/reset-password`, {
    phone: text(form, 'phone'),
  });
  if (!res.ok) return { ok: false, message: res.message };
  if (!res.data.password) return { ok: false, message: 'Parol yangilanmadi' };
  // Eski parol va ochiq seanslar endi ishlamaydi (dorixona token_version'ni oshiradi).
  return {
    ok: true,
    message:
      "Yangi vaqtinchalik parol — faqat hozir ko'rinadi. Eski parol va ochiq seanslar ishlamay qoldi:",
    secret: res.data.password,
  };
}

export async function issueIntegrationKey(
  slug: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!(await isPlatformAdmin())) return DENIED;
  if (!SLUG.test(slug)) return BAD_SLUG;

  const res = await dorixona<{ key: string; name: string }>('POST', `/${slug}/integration-keys`, {
    name: text(form, 'name') || '1C',
  });
  if (!res.ok) return { ok: false, message: res.message };
  return {
    ok: true,
    message: `“${res.data.name}” kaliti — faqat hozir ko'rinadi. 1C dasturchisiga xavfsiz yo'l bilan bering:`,
    secret: res.data.key,
  };
}
