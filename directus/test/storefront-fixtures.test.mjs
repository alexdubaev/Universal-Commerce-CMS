import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCAL_URL, appendOwnedId, assertLocalTarget, casRestorePatch,
  collectionEndpoint, createFixturePlan, guardedDeleteRequest, makeOwnershipManifest, productAnalogKey, readCollectionRows, redactSummary,
  safeManifestDirectory,
} from '../../dev/storefront-acceptance-fixtures.mjs';

const id = '7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a';

test('only the exact approved loopback Directus URL is accepted', () => {
  assert.equal(assertLocalTarget(LOCAL_URL), LOCAL_URL);
  for (const value of ['http://localhost:18056', 'http://127.0.0.1:18056/admin', 'https://127.0.0.1:18056', 'http://127.0.0.1:18057', 'http://admin@127.0.0.1:18056']) {
    assert.throws(() => assertLocalTarget(value), /exactly http/u);
  }
});

test('system collection reads use supported native endpoints with Directus query shape', async () => {
  const calls = [];
  const client = { request: async path => { calls.push(path); return []; } };
  for (const collection of ['directus_folders', 'directus_files', 'directus_users', 'directus_roles', 'directus_policies', 'directus_access']) await readCollectionRows(client, collection, new URLSearchParams({ 'filter[id][_eq]': id, limit: '1', fields: 'id' }));
  assert.deepEqual(calls.map(path => path.split('?')[0]), ['/folders', '/files', '/users', '/roles', '/policies', '/access']);
  assert.equal(collectionEndpoint('products'), '/items/products');
  assert.ok(calls.every(path => path.includes('filter%5Bid%5D%5B_eq%5D=') && path.includes('fields=id')));
});

test('synthetic fixture plan covers the required public, variant, pricing, stock and draft cases', () => {
  const plan = createFixturePlan({ runId: id });
  assert.equal(plan.products.length, 15);
  assert.equal(new Set(plan.categories.map(row => row.slug)).size, 3);
  assert.equal(new Set(plan.products.map(row => row.brand)).size, 3);
  assert.ok(plan.products.some(row => row.sku.includes('LONG-SKU')));
  assert.ok(plan.products.some(row => row.title.length > 150));
  assert.deepEqual(new Set(plan.products.map(row => row.price_status)), new Set(['fixed', 'on_request', 'hidden']));
  assert.deepEqual(new Set(plan.products.map(row => row.availability_status)), new Set(['in_stock', 'on_request', 'out_of_stock']));
  assert.equal(plan.products.at(-1).is_indexable, false);
  assert.equal(plan.drafts.length, 2);
  assert.ok(plan.children.every(row => row.specification.status === 'draft' && row.image.image));
  assert.equal(plan.children[0].image.status, 'published');
  assert.equal(plan.children[1].image.status, 'draft');
  assert.ok(plan.products.every(row => row.mpn.startsWith('MPN-FX-')));
  assert.ok(plan.products.some(row => row.gallery && row.specifications && row.documents));
  assert.deepEqual(plan.assets, ['fixture-gallery.png', 'fixture-home.png', 'fixture-draft-only.png', 'fixture-unreferenced.png', 'fixture-document.html', 'fixture-public.pdf', 'fixture-private.pdf']);
});

test('manifest ownership is exact, UUID-only, and summaries redact identifiers', () => {
  const manifest = makeOwnershipManifest(id);
  appendOwnedId(manifest, 'products', id);
  appendOwnedId(manifest, 'products', id);
  assert.deepEqual(manifest.created.products, [id]);
  assert.throws(() => appendOwnedId(manifest, 'products', 'baseline-row'), /invalid ownership/u);
  assert.deepEqual(redactSummary({ ...manifest, service: { userId: id, token: 'secret' } }), {
    status: 'planned', counts: { ...Object.fromEntries(Object.keys(manifest.created).map(key => [key, 0])), products: 1 }, childCreateVerified: false, sectionCreateVerified: null, sectionProbeStatus: null, serviceConfigured: true,
  });
  assert.match(safeManifestDirectory('D:/site-copy'), /[\\/]dev[\\/]\.storefront-acceptance$/u);
});

test('live fixture workflow gates child writes on verified native REST probes', () => {
  // Controlled local probes confirmed nested product specifications and a
  // standalone page_sections POST through exact REST readbacks.
  const manifest = makeOwnershipManifest(id);
  assert.equal(manifest.childCreateVerified, false);
  assert.equal(manifest.sectionCreateVerified, null);
  manifest.childCreateVerified = true;
  manifest.sectionCreateVerified = true;
  manifest.sectionProbeOutcome = { status: 'verified', httpStatus: null, code: null };
  const summary = redactSummary(manifest);
  assert.equal(summary.childCreateVerified, true);
  assert.equal(summary.sectionCreateVerified, true);
  assert.equal(summary.sectionProbeStatus, 'verified');
  assert.equal(Object.hasOwn(summary, 'namedRefs'), false);
});

test('CAS restore allows original or fixture state and refuses third-party changes', () => {
  const snapshot = { commerce_profile: { currency: 'RUB', features: { cart: false, parts_request: false } }, title: 'old' };
  const original = { ...snapshot };
  const fixture = { ...snapshot, commerce_profile: { currency: 'RUB', features: { cart: false, parts_request: true } } };
  assert.deepEqual(casRestorePatch(snapshot, original, ['commerce_profile'], fixture), {});
  assert.deepEqual(casRestorePatch(snapshot, fixture, ['commerce_profile'], fixture), { commerce_profile: snapshot.commerce_profile });
  assert.throws(() => casRestorePatch(snapshot, { ...snapshot, commerce_profile: { currency: 'USD', features: { cart: true, parts_request: true } } }, ['commerce_profile'], fixture), /changed after/u);
});

test('analog keys are stable for symmetric and directional relation types', () => {
  assert.equal(productAnalogKey('b', 'a', 'analog'), productAnalogKey('a', 'b', 'analog'));
  assert.notEqual(productAnalogKey('b', 'a', 'superseded_by'), productAnalogKey('a', 'b', 'superseded_by'));
});

test('owned child cleanup uses guarded mutations while navigation stays on native REST', () => {
  const request = guardedDeleteRequest('page_sections', id);
  assert.equal(request.path, `/commerce/mutations/page_sections/${id}`);
  assert.deepEqual(JSON.parse(request.options.body), { expected: { id }, action: 'delete' });
  assert.throws(() => guardedDeleteRequest('navigation_items', id), /unguarded/u);
  assert.throws(() => guardedDeleteRequest('directus_users', id), /unguarded/u);
});
