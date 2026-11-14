import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { dorixona, dorixonaBase } from '../../../lib/dorixona';

/**
 * The platform key opens every dorixona network, so the section is held to
 * three promises: the key goes over https only (or stays on this machine),
 * it never reaches a browser bundle, and no action spends it before checking
 * that the caller is a platform admin.
 */

const WEB_SRC = path.resolve(__dirname, '../../..');

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('the dorixona API address', () => {
  it('takes https anywhere and strips the trailing slash', () => {
    expect(dorixonaBase('https://dorixona.idaa.uz/api/v1/')).toBe(
      'https://dorixona.idaa.uz/api/v1',
    );
  });

  it('takes plain http to this machine only', () => {
    expect(dorixonaBase('http://127.0.0.1:4110/api/v1')).toBe('http://127.0.0.1:4110/api/v1');
    expect(dorixonaBase('http://localhost:4110/api/v1')).toBe('http://localhost:4110/api/v1');
    expect(dorixonaBase('http://dorixona.idaa.uz/api/v1')).toBeNull();
    expect(dorixonaBase('http://203.0.113.10:4110/api/v1')).toBeNull();
  });

  it('refuses what is not a URL', () => {
    expect(dorixonaBase(undefined)).toBeNull();
    expect(dorixonaBase('')).toBeNull();
    expect(dorixonaBase('dorixona.idaa.uz')).toBeNull();
    expect(dorixonaBase('ftp://dorixona.idaa.uz')).toBeNull();
  });
});

describe('a call to the dorixona API', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends nothing when the key or a safe address is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    vi.stubEnv('DORIXONA_API_URL', 'https://dorixona.idaa.uz/api/v1');
    vi.stubEnv('DORIXONA_PLATFORM_KEY', '');
    expect(await dorixona('GET', '')).toMatchObject({ ok: false, code: 'NOT_CONFIGURED' });

    vi.stubEnv('DORIXONA_API_URL', 'http://dorixona.idaa.uz/api/v1');
    vi.stubEnv('DORIXONA_PLATFORM_KEY', 'k'.repeat(64));
    expect(await dorixona('GET', '')).toMatchObject({ ok: false, code: 'NOT_CONFIGURED' });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('carries the key in its header and reads the answer', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ success: true, data: [{ slug: 'demo' }] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('DORIXONA_API_URL', 'https://dorixona.idaa.uz/api/v1/');
    vi.stubEnv('DORIXONA_PLATFORM_KEY', 'k'.repeat(64));

    expect(await dorixona('GET', '')).toEqual({ ok: true, data: [{ slug: 'demo' }] });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://dorixona.idaa.uz/api/v1/platform/networks');
    expect((init.headers as Record<string, string>)['X-Platform-Key']).toBe('k'.repeat(64));
  });

  it("passes on the API's Uzbek message with the fields it names", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: false,
              code: 'VALIDATION',
              message: "Ma'lumot noto'g'ri",
              details: [{ field: 'tin', reason: 'STIR — 9 raqam' }],
            }),
            { status: 400 },
          ),
      ),
    );
    vi.stubEnv('DORIXONA_API_URL', 'https://dorixona.idaa.uz/api/v1');
    vi.stubEnv('DORIXONA_PLATFORM_KEY', 'k'.repeat(64));

    expect(await dorixona('POST', '', {})).toEqual({
      ok: false,
      code: 'VALIDATION',
      message: "Ma'lumot noto'g'ri (tin: STIR — 9 raqam)",
    });
  });

  it('says the server did not answer instead of throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('ECONNREFUSED'))),
    );
    vi.stubEnv('DORIXONA_API_URL', 'https://dorixona.idaa.uz/api/v1');
    vi.stubEnv('DORIXONA_PLATFORM_KEY', 'k'.repeat(64));

    expect(await dorixona('GET', '')).toMatchObject({ ok: false, code: 'UNREACHABLE' });
  });
});

describe('the platform key stays on the server', () => {
  const files = filesUnder(WEB_SRC).filter((f) => !f.endsWith('.test.ts'));

  it('is never a public variable', () => {
    for (const file of files) {
      expect(fs.readFileSync(file, 'utf8'), file).not.toMatch(/NEXT_PUBLIC_DORIXONA/);
    }
  });

  it('is not imported by a browser component, except for its types', () => {
    const clients = files.filter((f) => /^\s*['"]use client['"]/.test(fs.readFileSync(f, 'utf8')));
    expect(clients.length).toBeGreaterThan(0);
    for (const file of clients) {
      const source = fs.readFileSync(file, 'utf8');
      const imports =
        source.match(/^import\s+(?!type\b)[^;]*from\s+['"]@\/lib\/dorixona['"]/gm) ?? [];
      expect(imports, file).toEqual([]);
    }
  });
});

describe('every dorixona action checks the caller first', () => {
  const source = fs.readFileSync(path.join(__dirname, 'actions.ts'), 'utf8');
  const actions = [
    ...source.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{\r?\n([^\r\n]*)/g),
  ];

  it('finds the actions', () => {
    expect(actions.map((a) => a[1])).toEqual([
      'createNetwork',
      'updateNetwork',
      'addStaff',
      'resetStaffPassword',
      'issueIntegrationKey',
    ]);
  });

  it('opens each one with the platform admin check', () => {
    for (const [, name, firstLine] of actions) {
      expect((firstLine ?? '').trim(), name).toBe('if (!(await isPlatformAdmin())) return DENIED;');
    }
  });
});
