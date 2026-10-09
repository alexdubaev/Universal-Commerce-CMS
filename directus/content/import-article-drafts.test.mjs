import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { DirectusAdminClient } from '../schema/apply-schema.mjs';

import { importArticleDrafts } from './import-article-drafts.mjs';
const draft = { status: 'draft', title: 'Draft article', slug: 'draft-article', excerpt: 'Review before publishing.', content: '<h2>Section</h2><p>Draft text.</p>' };
const date = '2026-10-10T10:00:00.000Z';

test('default draft import is offline and performs no client reads or writes', async () => {
  const result = await importArticleDrafts({ request() { throw new Error('Dry run must not use network'); } }, [draft]);
  assert.deepEqual(result, [{ slug: draft.slug, action: 'plan', status: 'draft' }]);
});

test('apply refuses wrong instances, missing confirmation and missing or malformed date before network', async () => {
  const client = { baseUrl: 'http://127.0.0.1:18056', request() { throw new Error('Network must not be reached'); } };
  for (const target of ['http://localhost:18056', 'http://127.0.0.1:18056/', 'http://127.0.0.1:18057', 'https://127.0.0.1:18056', 'https://other.example', 'http://admin@127.0.0.1:18056']) {
    await assert.rejects(() => importArticleDrafts({ ...client, baseUrl: target }, [draft], { apply: true, confirmOwnInstance: true, plannedDate: date }), /exactly/);
  }
  await assert.rejects(() => importArticleDrafts(client, [draft], { apply: true, plannedDate: date }), /confirm/i);
  for (const plannedDate of [undefined, 'invalid', '2026-02-30T00:00:00.000Z', '2026-10-10']) {
    await assert.rejects(() => importArticleDrafts(client, [draft], { apply: true, confirmOwnInstance: true, plannedDate }), /date/i);
  }
  for (const changed of [{ status: 'published' }, { author: 'Invented' }, { published_at: date }, { content_blocks: {} }]) {
    await assert.rejects(() => importArticleDrafts(client, [{ ...draft, ...changed }], { apply: true, confirmOwnInstance: true, plannedDate: date }), /draft|field/i);
  }
});

test('native Directus importer scopes slug checks, skips existing records in any status and only creates drafts', async () => {
  const importDrafts = importArticleDrafts;
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const path = new URL(url);
    const method = options.method ?? 'GET';
    calls.push({ path, method, payload: options.body ? JSON.parse(options.body) : null });
    assert.equal(path.origin, 'http://127.0.0.1:18056');
    assert.equal(path.pathname, '/items/articles');
    if (method === 'GET') {
      const filter = JSON.parse(path.searchParams.get('filter'));
      assert.equal(path.searchParams.get('limit'), '1');
      assert.deepEqual(Object.keys(filter), ['slug']);
      return Response.json({ data: filter.slug._eq === 'existing' ? [{ id: 'existing-id', slug: 'existing', status: 'published' }] : [] });
    }
    assert.equal(method, 'POST', 'existing records must never be patched or replaced');
    return Response.json({ data: { id: 'new-id' } });
  };
  try {
    const client = new DirectusAdminClient('http://127.0.0.1:18056', 'test-only-token');
    const result = await importDrafts(client, [{ ...draft, slug: 'existing' }, draft], { apply: true, confirmOwnInstance: true, plannedDate: date });
    assert.deepEqual(result, [{ slug: 'existing', action: 'skip', status: 'draft' }, { slug: draft.slug, action: 'create', status: 'draft' }]);
    const created = calls.filter(call => call.method === 'POST');
    assert.equal(created.length, 1);
    assert.deepEqual(created[0].payload, { ...draft, published_at: date });
    assert.equal('author' in created[0].payload, false);
  } finally { globalThis.fetch = originalFetch; }
});

test('site article drafts remain offline unpublished text and import does not manufacture authors or dates', async () => {
  const drafts = JSON.parse(await readFile(new URL('../../profiles/smtechno/article-drafts.json', import.meta.url), 'utf8'));
  const result = await importArticleDrafts(null, drafts);
  assert.equal(result.length, 3);
  assert.equal(new Set(result.map(row => row.slug)).size, 3);
  for (const entry of drafts) {
    assert.equal(entry.status, 'draft');
    assert.equal('published_at' in entry, false);
    assert.equal('author' in entry, false);
    assert.ok(entry.content.includes('<h2>'));
  }
});


test('CLI defaults to offline planning and rejects unknown arguments and unsafe apply before authentication', async () => {
  const execute = promisify(execFile);
  const script = fileURLToPath(new URL('./import-article-drafts.mjs', import.meta.url));
  const env = { PATH: process.env.PATH, DIRECTUS_URL: 'https://forbidden.example', DIRECTUS_TOKEN: 'test-only-token' };
  const planned = await execute(process.execPath, [script], { env });
  assert.match(planned.stdout, /Offline dry run/);
  for (const args of [['--unknown'], ['--apply', '--confirm-own-instance', '--planned-date', date]]) {
    await assert.rejects(() => execute(process.execPath, [script, ...args], { env, timeout: 2000 }), error => {
      assert.equal(error.code, 1);
      assert.equal(error.stdout, '');
      assert.equal(error.stderr.includes(env.DIRECTUS_TOKEN), false);
      return true;
    });
  }
});
