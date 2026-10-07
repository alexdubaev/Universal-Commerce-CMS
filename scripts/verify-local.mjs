import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const storefront = join(root, 'storefront');
const canary = 'local-verification-token-canary-never-ship';
const env = {
  ...process.env,
  STOREFRONT_MOCK_MODE: 'true',
  STOREFRONT_ALLOW_MOCK_FALLBACK: 'false',
  STOREFRONT_DIRECTUS_GATEWAY: 'false',
  NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3000',
  DIRECTUS_URL: 'http://127.0.0.1:18056',
  DIRECTUS_TOKEN: canary,
};

function run(label, cwd, ...args) {
  console.log(`\n${label}`);
  const result = spawnSync('npm', args, {
    cwd, env, stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

for (const extension of ['commerce-api', 'deere-shop-search']) {
  const base = join(root, 'directus', 'extensions', extension);
  for (const name of readdirSync(join(base, 'src'))) {
    const source = readFileSync(join(base, 'src', name));
    if (!source.equals(readFileSync(join(base, 'dist', name)))) {
      throw new Error(`Update the deployed dist copy of ${extension}/${name} before pushing.`);
    }
  }
}

run('Backend integrations', join(root, 'directus'), 'test');
run('Storefront integrations and domain rules', storefront, 'test');
run('Dependency audit', storefront, 'audit', '--audit-level=high');
// Next's production build includes TypeScript validation; don't run it twice.
run('Mock production build', storefront, 'run', 'build');
for (const path of files(join(storefront, '.next', 'static'))) {
  if (readFileSync(path).includes(canary)) {
    throw new Error('Server-token canary leaked into the client static bundle.');
  }
}
run('Critical Chromium journeys', storefront, 'run', 'test:e2e');
console.log('\nLocal verification passed.');
