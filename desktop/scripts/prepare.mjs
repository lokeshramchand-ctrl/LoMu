import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const desktop = path.resolve(here, '..');
const web = path.resolve(desktop, '..', 'web');
const root = path.join(desktop, 'build', 'server');
const out = path.join(root, 'app');

if (!process.argv.includes('--skip-build')) {
  console.log('> building the web app');
  const r = spawnSync('npm', ['run', 'build'], { cwd: web, stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const standalone = path.join(web, '.next', 'standalone');
if (!fs.existsSync(standalone)) {
  console.error('web/.next/standalone is missing: run without --skip-build');
  process.exit(1);
}

fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(standalone, out, { recursive: true, dereference: true });

function findEntry(dir, depth = 0) {
  if (fs.existsSync(path.join(dir, 'server.js'))) return dir;
  if (depth >= 2) return null;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && e.name !== 'node_modules' && e.name !== '.next') {
      const f = findEntry(path.join(dir, e.name), depth + 1);
      if (f) return f;
    }
  }
  return null;
}
const entryDir = findEntry(out);
if (!entryDir) {
  console.error('no server.js in the standalone output');
  process.exit(1);
}
for (const junk of ['src', 'tests', 'scripts', 'test-results', 'Dockerfile', '.dockerignore', 'package-lock.json', 'next.config.ts', 'playwright.config.ts', 'playwright.prod.config.ts', 'vitest.config.ts', 'tsconfig.json', 'tsconfig.tsbuildinfo', 'next-env.d.ts']) {
  fs.rmSync(path.join(entryDir, junk), { recursive: true, force: true });
}
fs.cpSync(path.join(web, '.next', 'static'), path.join(entryDir, '.next', 'static'), { recursive: true });
if (fs.existsSync(path.join(web, 'public'))) fs.cpSync(path.join(web, 'public'), path.join(entryDir, 'public'), { recursive: true });
fs.writeFileSync(path.join(root, 'entry.json'), JSON.stringify({ entry: path.relative(root, path.join(entryDir, 'server.js')).split(path.sep).join('/') }));

fs.mkdirSync(path.join(desktop, 'build'), { recursive: true });
fs.copyFileSync(path.join(web, 'public', 'icon-512.png'), path.join(desktop, 'build', 'icon.png'));
console.log('> local server ready in', path.relative(process.cwd(), root));
