import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * The seams this app has actually broken at.
 *
 * Three of its contracts are held together by hand and by nothing else: the
 * translation files against the keys the screens ask for, `database.types.ts`
 * against the SQL it claims to describe, and every `.rpc()` call against the
 * function it names. Each is a plain-text agreement between two files that no
 * compiler reads, so each has drifted — a heading that rendered as
 * `sklad.item.donaLabel` on a customer's screen, a mapper reading columns a
 * function did not return and quietly calling them zero.
 *
 * None of that is caught by tsc, because on both sides the types are exactly
 * what someone typed. So it is caught here instead: these read the source as
 * text and check the two halves still say the same thing.
 */

const WEB_SRC = path.resolve(__dirname);
const REPO = path.resolve(__dirname, '../../..');
const MIGRATIONS = path.join(REPO, 'packages/database/supabase/migrations');
const ONTOLOGY = path.join(REPO, 'packages/shared/src/ontology');
const I18N = path.join(REPO, 'packages/shared/src/i18n');

function filesUnder(dir: string, match: RegExp): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!/node_modules|\.next/.test(full)) out.push(...filesUnder(full, match));
    } else if (match.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Reads from `source[from]`, which must be an opener, to its matching closer. */
function balanced(source: string, from: number, open: string, close: string): string {
  let depth = 0;
  for (let i = from; i < source.length; i += 1) {
    if (source[i] === open) depth += 1;
    else if (source[i] === close) {
      depth -= 1;
      if (depth === 0) return source.slice(from + 1, i);
    }
  }
  return '';
}

/** Splits on commas that are not inside brackets or quotes. */
function topLevelParts(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';

  for (const ch of list) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

interface SqlFunction {
  name: string;
  params: string[];
  returns: string[] | null;
}

/**
 * Every function the migrations define, last definition winning — they are
 * re-runnable and later files deliberately replace earlier ones.
 */
function readSqlFunctions(): Map<string, SqlFunction> {
  const found = new Map<string, SqlFunction>();

  for (const file of fs.readdirSync(MIGRATIONS).sort()) {
    if (!file.endsWith('.sql')) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8');
    const re = /create\s+(?:or\s+replace\s+)?function\s+([a-z_][a-z0-9_]*)\s*\(/gi;
    let m: RegExpExecArray | null;

    while ((m = re.exec(sql))) {
      const name = m[1]!;
      const paramsAt = m.index + m[0].length - 1;
      const paramsInner = balanced(sql, paramsAt, '(', ')');
      const params = topLevelParts(paramsInner).map((p) => p.split(/\s+/)[0]!);

      // Past the parameter list's closing paren: "(" + inner + ")".
      const afterParams = paramsAt + paramsInner.length + 2;
      const table = /^\s*returns\s+table\s*\(/i.exec(sql.slice(afterParams));

      let returns: string[] | null = null;
      if (table) {
        const tableAt = afterParams + table[0].length - 1;
        returns = topLevelParts(balanced(sql, tableAt, '(', ')')).map((c) => c.split(/\s+/)[0]!);
      }

      found.set(name, { name, params, returns });
    }
  }

  return found;
}

const sqlFunctions = readSqlFunctions();
const webFiles = filesUnder(WEB_SRC, /\.(ts|tsx)$/).filter((f) => !f.endsWith('.test.ts'));

describe('the migrations parse at all', () => {
  it('finds the functions the app is built on', () => {
    // A guard on the parser itself: if this drops to nothing, every check
    // below would pass by finding no work to do.
    expect(sqlFunctions.size).toBeGreaterThan(40);
    expect(sqlFunctions.get('counterparty_journal')?.returns).toContain('overdue_1_30');
  });
});

describe('every rpc call names a function that exists, with arguments it accepts', () => {
  const calls: { file: string; fn: string; args: string[] }[] = [];

  for (const file of webFiles.concat(
    filesUnder(path.join(REPO, 'packages/api-client/src'), /\.ts$/),
  )) {
    const source = fs.readFileSync(file, 'utf8');
    const re = /\.rpc\(\s*'([a-z_][a-z0-9_]*)'\s*,\s*\{/g;
    let m: RegExpExecArray | null;

    while ((m = re.exec(source))) {
      const braceAt = m.index + m[0].length - 1;
      const args = topLevelParts(balanced(source, braceAt, '{', '}'))
        .map((a) => a.split(':')[0]!.trim())
        .filter((a) => /^[a-z_][a-z0-9_]*$/.test(a));
      calls.push({ file: path.relative(REPO, file), fn: m[1]!, args });
    }
  }

  it('finds the calls', () => {
    expect(calls.length).toBeGreaterThan(20);
  });

  it.each(calls.map((c) => [`${c.fn} (${c.file})`, c] as const))('%s', (_label, call) => {
    const fn = sqlFunctions.get(call.fn);
    expect(fn, `no migration defines ${call.fn}()`).toBeDefined();

    for (const arg of call.args) {
      expect(fn!.params, `${call.fn}() has no parameter ${arg}`).toContain(arg);
    }
  });
});

describe('database.types.ts describes the SQL it claims to', () => {
  const types = fs.readFileSync(
    path.join(REPO, 'packages/api-client/src/database.types.ts'),
    'utf8',
  );

  // Each `name: { Args: {...}; Returns: {...}[] }` under Functions.
  const declared: { fn: string; args: string[]; returns: string[] }[] = [];
  const re = /^\s{6}([a-z_][a-z0-9_]*): \{\s*$/gm;
  let m: RegExpExecArray | null;

  while ((m = re.exec(types))) {
    const block = types.slice(m.index, types.indexOf('\n      };', m.index));
    const argsAt = block.indexOf('Args: {');
    const returnsAt = block.indexOf('Returns: {');
    if (argsAt === -1) continue;

    // A TypeScript member list is separated by semicolons and newlines, not
    // by the commas `topLevelParts` looks for — splitting it the SQL way
    // finds exactly one member and then agrees with everything.
    const members = (inner: string) =>
      inner
        .split(/[;\n]/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('//') && !line.startsWith('*'))
        .map((line) => line.split(/[?:]/)[0]!.trim())
        .filter((name) => /^[a-z_][a-z0-9_]*$/.test(name));

    const args = members(balanced(block, argsAt + 'Args: '.length, '{', '}'));
    const returns =
      returnsAt === -1 ? [] : members(balanced(block, returnsAt + 'Returns: '.length, '{', '}'));

    declared.push({ fn: m[1]!, args, returns });
  }

  const checkable = declared.filter((d) => sqlFunctions.get(d.fn)?.returns);

  it('finds the declarations', () => {
    expect(checkable.length).toBeGreaterThan(5);
  });

  it.each(checkable.map((d) => [d.fn, d] as const))('%s returns what it says', (_fn, d) => {
    const sql = sqlFunctions.get(d.fn)!;

    // The exact set, both ways: a column the types invented reads as
    // undefined at runtime, and one they forgot is a column nothing uses.
    expect([...d.returns].sort()).toEqual([...sql.returns!].sort());
  });

  it.each(declared.map((d) => [d.fn, d] as const))('%s takes what it says', (_fn, d) => {
    const sql = sqlFunctions.get(d.fn);
    if (!sql) return; // Not every declared name is a migration function.
    for (const arg of d.args) {
      expect(sql.params, `${d.fn}() has no parameter ${arg}`).toContain(arg);
    }
  });
});

describe('every translation key the screens ask for exists in both languages', () => {
  const dictionaries = {
    uz: JSON.parse(fs.readFileSync(path.join(I18N, 'uz.json'), 'utf8')),
    ru: JSON.parse(fs.readFileSync(path.join(I18N, 'ru.json'), 'utf8')),
  };

  const lookup = (dict: unknown, key: string) =>
    key.split('.').reduce<unknown>((at, part) => {
      if (at && typeof at === 'object') return (at as Record<string, unknown>)[part];
      return undefined;
    }, dict);

  const keys = new Set<string>();
  for (const file of webFiles.concat(filesUnder(ONTOLOGY, /\.ts$/))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const m of source.matchAll(/\bt\(\s*'([a-zA-Z][\w.]*)'/g)) keys.add(m[1]!);
    for (const m of source.matchAll(/(?:titleKey|descriptionKey|key):\s*'([\w.]+\.[\w.]+)'/g)) {
      keys.add(m[1]!);
    }
  }

  it('finds the keys', () => {
    expect(keys.size).toBeGreaterThan(300);
  });

  it('has every one of them in Uzbek', () => {
    const missing = [...keys].filter((k) => lookup(dictionaries.uz, k) === undefined).sort();
    expect(missing).toEqual([]);
  });

  it('has every one of them in Russian', () => {
    const missing = [...keys].filter((k) => lookup(dictionaries.ru, k) === undefined).sort();
    expect(missing).toEqual([]);
  });

  it('keeps the two dictionaries the same shape', () => {
    const flatten = (value: unknown, prefix = ''): string[] =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
            flatten(v, prefix ? `${prefix}.${k}` : k),
          )
        : [prefix];

    const uz = flatten(dictionaries.uz).sort();
    const ru = flatten(dictionaries.ru).sort();

    expect(uz.filter((k) => !ru.includes(k))).toEqual([]);
    expect(ru.filter((k) => !uz.includes(k))).toEqual([]);
  });
});

describe('every link points at a page that exists', () => {
  const appDir = path.join(WEB_SRC, 'app');

  // Route groups — (app), (main) — are folders that do not appear in a URL.
  const routes = filesUnder(appDir, /^page\.tsx$/).map((file) =>
    path
      .relative(appDir, path.dirname(file))
      .split(path.sep)
      .filter((s) => s && !s.startsWith('('))
      .join('/'),
  );

  const matches = (href: string) => {
    const wanted = href.replace(/^\//, '').split('/').filter(Boolean);
    return routes.some((route) => {
      const parts = route.split('/').filter(Boolean);
      if (parts.length !== wanted.length) return false;
      return parts.every((part, i) => part.startsWith('[') || part === wanted[i]);
    });
  };

  const hrefs = new Set<string>();
  for (const file of webFiles.concat(filesUnder(ONTOLOGY, /\.ts$/))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const m of source.matchAll(/(?:href=\{?[`"]|href: ')(\/[^"'`}?]*)/g)) {
      // A template hole is a dynamic segment; the route's [id] matches it.
      hrefs.add(m[1]!.replace(/\$\{[^}]*\}?/g, 'x').replace(/\/$/, '') || '/');
    }
  }

  it('finds the links', () => {
    expect(hrefs.size).toBeGreaterThan(15);
  });

  it.each([...hrefs].sort().map((h) => [h] as const))('%s', (href) => {
    if (href === '/') return;
    expect(matches(href), `${href} matches no route under app/`).toBe(true);
  });
});
