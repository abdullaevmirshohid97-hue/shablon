// Every bare import in the mobile app must be declared in its own
// package.json. Anything else only resolves by accident, through hoisting
// from another workspace — which works locally and fails on a clean CI
// install. That is exactly how `xlsx` got through.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { builtinModules } from 'node:module';

// Resolved against this file, not the shell's cwd, so it behaves the same
// whether it is run from the repo root or from inside the workspace.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = path.join(repoRoot, 'apps/mobile');
const pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
]);
const builtins = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** "@scope/name/sub" -> "@scope/name"; "name/sub" -> "name" */
function packageOf(spec) {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

const missing = new Map();
for (const file of [...walk(path.join(appDir, 'app')), ...walk(path.join(appDir, 'src'))]) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/(?:from|require\()\s*['"]([^.'"][^'"]*)['"]/g)) {
    const name = packageOf(m[1]);
    if (builtins.has(name) || declared.has(name)) continue;
    if (!missing.has(name)) missing.set(name, []);
    missing.get(name).push(file);
  }
}

if (missing.size === 0) {
  console.log("OK — har bir import apps/mobile/package.json da e'lon qilingan");
} else {
  for (const [name, files] of missing) {
    console.log(`YO'Q: ${name}`);
    for (const f of [...new Set(files)]) console.log(`      ${path.relative(repoRoot, f)}`);
  }
  process.exitCode = 1;
}
