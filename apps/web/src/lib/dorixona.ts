/**
 * The pharmacy networks of dorixona.idaa.uz, as the super-admin sees them.
 *
 * Dorixona is its own product on its own server; idaa.uz only adds and runs
 * its networks, through the dorixona platform API (`/platform/networks`). The
 * call is server to server and carries `X-Platform-Key`, which opens every
 * network there — so the key lives in the server's environment only, never in
 * a `NEXT_PUBLIC_*` variable, and this module is imported only by server
 * components and server actions.
 *
 * For the same reason the key is sent over https only. Plain http is allowed
 * to this machine alone, for when both apps run on one server.
 */

export type NetworkStatus = 'trial' | 'active' | 'suspended';
export type StaffRole = 'network_admin' | 'branch_admin' | 'pharmacist' | 'operator' | 'courier';

export interface DorixonaNetwork {
  slug: string;
  name: string;
  legal_name: string | null;
  tin: string | null;
  status: NetworkStatus;
  idaa_org_id: string | null;
  created_at: string;
}

export interface DorixonaStaff {
  id: string;
  phone: string;
  full_name: string | null;
  role: StaffRole;
  is_active: boolean;
  branch: { id: string; name: string } | null;
}

export type DorixonaResult<T> =
  { ok: true; data: T } | { ok: false; code: string; message: string };

interface FieldError {
  field: string;
  reason: string;
}

/** The API's base URL, or null when it is missing or would send the key in the clear. */
export function dorixonaBase(raw: string | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return null;
  return url.toString().replace(/\/+$/, '');
}

export function dorixonaConfigured(): boolean {
  return Boolean(dorixonaBase(process.env.DORIXONA_API_URL) && process.env.DORIXONA_PLATFORM_KEY);
}

/** The API answers in Uzbek; a form error also names the fields it is about. */
function describe(json: { message?: unknown; details?: unknown } | null): string | null {
  if (!json || typeof json.message !== 'string') return null;
  const details = Array.isArray(json.details) ? (json.details as FieldError[]) : [];
  const fields = details
    .filter((d) => d && typeof d.field === 'string' && typeof d.reason === 'string')
    .map((d) => `${d.field}: ${d.reason}`);
  return fields.length ? `${json.message} (${fields.join('; ')})` : json.message;
}

export async function dorixona<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<DorixonaResult<T>> {
  const base = dorixonaBase(process.env.DORIXONA_API_URL);
  const key = process.env.DORIXONA_PLATFORM_KEY;
  if (!base || !key) {
    return {
      ok: false,
      code: 'NOT_CONFIGURED',
      message: 'DORIXONA_API_URL (https) va DORIXONA_PLATFORM_KEY serverda sozlanmagan',
    };
  }

  try {
    const res = await fetch(`${base}/platform/networks${path}`, {
      method,
      headers: {
        'X-Platform-Key': key,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      data?: T;
      code?: string;
      message?: string;
      details?: unknown;
    } | null;
    if (res.ok && json?.success) return { ok: true, data: json.data as T };
    return {
      ok: false,
      code: json?.code ?? `HTTP_${res.status}`,
      message: describe(json) ?? `Dorixona serveri ${res.status} javob qaytardi`,
    };
  } catch {
    return { ok: false, code: 'UNREACHABLE', message: 'Dorixona serveri javob bermadi' };
  }
}
