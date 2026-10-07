import test from 'node:test';
import assert from 'node:assert/strict';
import { assertHomeSingletonAbsent, cleanupReason, patchSingleton, readOwnedRecord, readSingletonRows, repairOwnedAssetMime, resumePendingHomeCreate } from '../../dev/storefront-acceptance.mjs';
import {
  LOCAL_URL,
  appendOwnedId,
  assertLocalTarget,
  casApplyPatch,
  casRestorePatch,
  guardedDeleteRequest,
  makeOwnershipManifest,
  redactSummary,
  serviceEmailForRun,
  safeManifestDirectory,
} from '../../dev/storefront-acceptance-fixtures.mjs';

const id = '7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a';

test('only the exact approved loopback Directus URL is accepted', () => {
  assert.equal(assertLocalTarget(LOCAL_URL), LOCAL_URL);
  for (const value of ['http://localhost:18056', 'http://127.0.0.1:18056/admin', 'https://127.0.0.1:18056', 'http://127.0.0.1:18057', 'http://admin@127.0.0.1:18056']) {
    assert.throws(() => assertLocalTarget(value), /exactly http/u);
  }
});

test('singleton read and patch use collection-level Directus routes', async () => {
  const calls = [];
  const client = { request: async (path, options) => { calls.push({ path, options }); return { id, status: 'draft' }; } };
  const rows = await readSingletonRows(client, 'home_page', ['id', 'status']);
  assert.deepEqual(rows, [{ id, status: 'draft' }]);
  await patchSingleton(client, 'home_page', { status: 'published' });
  assert.equal(calls[0].path, '/items/home_page?fields=id%2Cstatus&limit=1');
  assert.equal(calls[1].path, '/items/home_page');
  assert.equal(calls[1].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[1].options.body), { status: 'published' });
  assert.throws(() => patchSingleton(client, 'products', { status: 'draft' }), /Unsupported/u);
});

test('home singleton ownership reads its projection and matches only a persisted exact ID', async () => {
  const calls = [], client = { request: async path => { calls.push(path); return { id, status: 'published' }; } };
  assert.deepEqual(await readOwnedRecord(client, 'home_page', id), { id, status: 'published' });
  assert.equal(calls[0], '/items/home_page?fields=*&limit=1');
  assert.equal(await readOwnedRecord({ request: async () => ({ id: null, status: 'draft' }) }, 'home_page', id), null);
  assert.equal(await readOwnedRecord({ request: async () => ({ id: '8b8b8b8b-8b8b-48b8-88b8-8b8b8b8b8b8b' }) }, 'home_page', id), null);
  await assert.rejects(readOwnedRecord({ request: async () => { throw Error('HTTP 403 denied'); } }, 'home_page', id), /HTTP 403/u);
  await assertHomeSingletonAbsent({ request: async () => ({ id: null }) });
  await assert.rejects(assertHomeSingletonAbsent({ request: async () => ({ id }) }), /already exists/u);
  await assert.rejects(assertHomeSingletonAbsent({ request: async () => { throw Error('HTTP 403 denied'); } }), /HTTP 403/u);
});

test('pending home create retries collection PATCH with its already-journaled UUID', async () => {
  const expected = { id, status: 'published', h1: 'Synthetic acceptance home' };
  const calls = [];
  let row = { id: null };
  const client = { request: async (path, options) => {
    calls.push({ path, options });
    if (!options) return row;
    row = expected;
    return row;
  } };
  assert.deepEqual(await resumePendingHomeCreate(client, id, expected), expected);
  assert.deepEqual(calls.map(call => call.path), [`/items/home_page?fields=*&limit=1`, `/items/home_page?fields=*&limit=1`, '/items/home_page']);
  assert.equal(calls[2].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[2].options.body), expected);
  await assert.rejects(resumePendingHomeCreate({ request: async () => ({ id: '8b8b8b8b-8b8b-48b8-88b8-8b8b8b8b8b8b' }) }, id, expected), /different singleton/u);
});

test('owned file MIME repair requires exact ownership and byte-identical generated content', async () => {
  const id = '8b8b8b8b-8b8b-48b8-88b8-8b8b8b8b8b8b';
  const filename = 'fixture-public-12345678.pdf';
  const bytes = Buffer.from('%PDF-1.4\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Kids [] /Count 0 >>endobj\ntrailer<< /Root 1 0 R >>\n%%EOF\n');
  const manifest = { created: { directus_files: [id] }, ownership: { directus_files: { [id]: { id, folder: 'folder-id', filename_download: filename } } } };
  const calls = [];
  const client = { baseUrl: LOCAL_URL, token: 'hidden', request: async path => {
    calls.push(path);
    return [{ id, folder: 'folder-id', filename_download: filename, type: 'application/octet-stream' }];
  } };
  const fetchImpl = async (url, options = {}) => {
    calls.push([url, options.method ?? 'GET']);
    if (url.endsWith(`/assets/${id}`)) return { ok: true, arrayBuffer: async () => bytes };
    return { ok: true, json: async () => ({ data: { id, type: 'application/pdf' } }) };
  };
  await repairOwnedAssetMime(client, manifest, fetchImpl);
  assert.equal(manifest.ownership.directus_files[id].type, 'application/pdf');
  assert.deepEqual(calls.slice(1), [[`${LOCAL_URL}/assets/${id}`, 'GET'], [`${LOCAL_URL}/files/${id}`, 'PATCH']]);
});

test('owned file MIME repair refuses replacement if generated bytes do not match', async () => {
  const id = '8b8b8b8b-8b8b-48b8-88b8-8b8b8b8b8b8b';
  const filename = 'fixture-public-12345678.pdf';
  const manifest = { created: { directus_files: [id] }, ownership: { directus_files: { [id]: { id, folder: 'folder-id', filename_download: filename } } } };
  const client = { baseUrl: LOCAL_URL, token: 'hidden', request: async () => [{ id, folder: 'folder-id', filename_download: filename, type: 'application/octet-stream' }] };
  let patched = false;
  const fetchImpl = async url => {
    if (url.endsWith(`/assets/${id}`)) return { ok: true, arrayBuffer: async () => Buffer.from('other bytes') };
    patched = true; return { ok: true, json: async () => ({ data: { id, type: 'application/pdf' } }) };
  };
  await assert.rejects(repairOwnedAssetMime(client, manifest, fetchImpl), /bytes differ/u);
  assert.equal(patched, false);
});

test('manifest ownership is exact, UUID-only, and summaries redact identifiers', () => {
  const manifest = makeOwnershipManifest(id);
  appendOwnedId(manifest, 'products', id);
  appendOwnedId(manifest, 'products', id);
  assert.deepEqual(manifest.created.products, [id]);
  assert.throws(() => appendOwnedId(manifest, 'products', 'baseline-row'), /invalid ownership/u);
  assert.deepEqual(redactSummary({ ...manifest, service: { userId: id, token: 'secret' } }), {
    status: 'planned', counts: { ...Object.fromEntries(Object.keys(manifest.created).map(key => [key, 0])), products: 1 }, childCreateVerified: false, sectionCreateVerified: null, sectionProbeStatus: null, serviceConfigured: false,
  });
  manifest.phase = 'active';
  manifest.created.directus_users.push(id);
  assert.equal(redactSummary({ ...manifest, service: { userId: id, token: 'secret' } }).serviceConfigured, true);
  assert.match(serviceEmailForRun(id), /^[a-z0-9-]+@example\.com$/u);
  assert.match(safeManifestDirectory('D:/site-copy'), /[\\/]dev[\\/]\.storefront-acceptance$/u);
});

test('CAS restore allows original or fixture state and refuses third-party changes', () => {
  const snapshot = { commerce_profile: { currency: 'RUB', features: { cart: false, parts_request: false } }, title: 'old' };
  const original = { ...snapshot };
  const fixture = { ...snapshot, commerce_profile: { currency: 'RUB', features: { cart: false, parts_request: true } } };
  assert.deepEqual(casRestorePatch(snapshot, original, ['commerce_profile'], fixture), {});
  assert.deepEqual(casRestorePatch(snapshot, fixture, ['commerce_profile'], fixture), { commerce_profile: snapshot.commerce_profile });
  assert.throws(() => casRestorePatch(snapshot, { ...snapshot, commerce_profile: { currency: 'USD', features: { cart: true, parts_request: true } } }, ['commerce_profile'], fixture), /changed after/u);
});

test('CAS resume applies only original fields and accepts already-fixtured fields', () => {
  const original = { parts_request: false, cart: false }, expected = { parts_request: true, cart: false };
  assert.deepEqual(casApplyPatch(original, original, ['parts_request', 'cart'], expected), { parts_request: true });
  assert.deepEqual(casApplyPatch(original, expected, ['parts_request', 'cart'], expected), {});
  assert.throws(() => casApplyPatch(original, { parts_request: false, cart: true }, ['parts_request', 'cart'], expected), /changed during resume/u);
});

test('cleanup diagnostics expose a reason code without leaking raw API details', () => {
  const raw = 'DELETE /users failed: HTTP 400 {"errors":[{"message":"token super-secret","extensions":{"code":"FAILED_VALIDATION"}}]}';
  assert.equal(cleanupReason(new Error(raw)), 'HTTP_400');
  assert.equal(cleanupReason(new Error('wrapped {"errors":[{"extensions":{"code":"FORBIDDEN"}}]}')), 'FORBIDDEN');
  assert.equal(cleanupReason(new Error('sensitive detail')), 'REQUEST_FAILED');
});

test('owned content cleanup routes navigation items through guarded mutations', () => {
  const request = guardedDeleteRequest('page_sections', id);
  assert.equal(request.path, `/commerce/mutations/page_sections/${id}`);
  assert.deepEqual(JSON.parse(request.options.body), { expected: { id }, action: 'delete' });
  assert.equal(guardedDeleteRequest('navigation_items', id).path, `/commerce/mutations/navigation_items/${id}`);
  assert.equal(guardedDeleteRequest('home_page', id, { id, h1: 'Synthetic' }).path, `/commerce/mutations/home_page/${id}`);
  assert.throws(() => guardedDeleteRequest('directus_users', id), /unguarded/u);
});
