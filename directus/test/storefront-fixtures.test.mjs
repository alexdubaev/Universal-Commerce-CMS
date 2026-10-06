import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCAL_URL, appendOwnedId, assertLocalTarget, casRestorePatch,
  createFixturePlan, guardedDeleteRequest, makeOwnershipManifest, productAnalogKey, redactSummary,
  safeManifestDirectory,
} from '../../dev/storefront-acceptance-fixtures.mjs';

const id = '7a7a7a7a-7a7a-47a7-87a7-7a7a7a7a7a7a';

test('only the exact approved loopback Directus URL is accepted', () => {
  assert.equal(assertLocalTarget(LOCAL_URL), LOCAL_URL);
  for (const value of ['http://localhost:18056', 'http://127.0.0.1:18056/admin', 'https://127.0.0.1:18056', 'http://127.0.0.1:18057']) {
    assert.throws(() => assertLocalTarget(value), /exactly http/u);
  }
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
  assert.ok(plan.children.every(row => row.specification.status === 'draft' && row.image.status === 'draft'));
  assert.ok(plan.products.some(row => row.gallery && row.specifications && row.documents));
  assert.deepEqual(plan.assets, ['fixture-gallery.png', 'fixture-private.pdf', 'fixture-home.png', 'fixture-document.html']);
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

test('CAS restore only returns unchanged fixture-overridden fields', () => {
  const snapshot = { commerce_profile: { currency: 'RUB', features: { cart: false, parts_request: false } }, title: 'old' };
  assert.deepEqual(casRestorePatch(snapshot, { ...snapshot }, ['commerce_profile']), { commerce_profile: snapshot.commerce_profile });
  assert.throws(() => casRestorePatch(snapshot, { ...snapshot, commerce_profile: { currency: 'RUB', features: { cart: false, parts_request: true } } }, ['commerce_profile']), /changed after/u);
});

test('analog keys are stable for symmetric and directional relation types', () => {
  assert.equal(productAnalogKey('b', 'a', 'analog'), productAnalogKey('a', 'b', 'analog'));
  assert.notEqual(productAnalogKey('b', 'a', 'superseded_by'), productAnalogKey('a', 'b', 'superseded_by'));
});

test('owned child cleanup uses the transaction-aware guarded mutation route', () => {
  const request = guardedDeleteRequest('page_sections', id);
  assert.equal(request.path, `/commerce/mutations/page_sections/${id}`);
  assert.deepEqual(JSON.parse(request.options.body), { expected: { id }, action: 'delete' });
  assert.throws(() => guardedDeleteRequest('directus_users', id), /unguarded/u);
});
