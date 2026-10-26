import test from 'node:test';
import assert from 'node:assert/strict';
import { createSearchHandler } from '../extensions/commerce-api/src/index.js';

function harness(counts = [201, 1, 0], rowsByTier = [[], [{ id: 'exact', title: 'Масляный насос' }], []]) {
  const calls = [];
  class ItemsService {
    constructor(collection) { this.collection = collection; }
    async readByQuery(query) {
      calls.push({ collection: this.collection, query });
      if (query.aggregate) return [{ count: { id: counts[calls.filter(c => c.query.aggregate).length - 1] ?? 0 } }];
      return rowsByTier[0] ?? [];
    }
  }
  const handler = createSearchHandler({ services: { ItemsService }, getSchema: async () => ({ collections: {} }), logger: { error: console.error }, env: { COMMERCE_ENABLE_ADDITIONAL_CODES: 'false' }, forcePublishedCategory: true });
  return { calls, invoke: async query => {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ query }, res); return res;
  } };
}

test('counts exact SKU after a large prefix tier, then serves the exact-tier page', async () => {
  const h = harness([1, 0, 201], [[{ id: 'exact', title: 'Масляный насос' }]]);
  const response = await h.invoke({ q: 'RE5048', page: '1', limit: '10' });
  assert.equal(response.body.data[0].id, 'exact');
  assert.equal(response.body.meta.total, 202);
  assert.equal(h.calls.filter(c => c.query.aggregate).length, 3);
  assert.equal(h.calls.filter(c => !c.query.aggregate)[0].query.limit, 1);
});

test('accepts bounded product facets and Russian title queries while rejecting invalid filters', async () => {
  const h = harness();
  const response = await h.invoke({ q: 'насос', brand: 'Acme', category: 'hydraulics', availability: 'in_stock', partType: 'oem' });
  assert.equal(response.code, 200);
  assert.equal(h.calls.some(c => JSON.stringify(c.query.filter).includes('насос')), true);
  assert.equal(h.calls.some(c => JSON.stringify(c.query.filter).includes('Acme')), true);
  const bad = await h.invoke({ q: 'насос', availability: 'unknown' });
  assert.equal(bad.code, 400);
});

test('paginates beyond 200 candidates inside a tier and counts the same facet and publication filters', async () => {
  const h = harness([1, 0, 250], [[{ id: 'prefix-after-window', title: 'Гидравлика' }]]);
  const response = await h.invoke({ q: 'RE', brand: 'Acme', category: 'hydraulics', page: '21', limit: '10' });
  assert.equal(response.body.meta.total, 251);
  const reads = h.calls.filter(call => call.query && !call.query.aggregate);
  assert.equal(reads[0].query.offset, 199);
  const counted = h.calls.filter(call => call.query?.aggregate);
  assert.equal(counted.every(call => JSON.stringify(call.query.filter).includes('Acme')), true);
  assert.equal(counted.every(call => call.query.filter._and.some(part => part._or?.some(term => term.category?.status?._eq === 'published'))), true);
  assert.equal(JSON.stringify(reads[0].query.filter), JSON.stringify(counted[2].query.filter));
  assert.match(JSON.stringify(counted[2].query.filter), /"_null":true/);
  assert.match(JSON.stringify(counted[2].query.filter), /"_neq":"RE"/);
});

test('exact MPN is ranked ahead of remaining prefix rows', async () => {
  const h = harness([0, 1, 250], [[{ id: 'exact-mpn', title: 'Exact manufacturer match' }]]);
  const response = await h.invoke({ q: 'RE5048', limit: '5' });
  assert.equal(response.body.data[0].id, 'exact-mpn');
  const productReads = h.calls.filter(call => !call.query.aggregate);
  assert.equal(productReads[0].query.limit, 1);
  assert.match(JSON.stringify(productReads[0].query.filter), /"mpn_normalized"/);
});

test('caps pages at 10000, keeps the maximum offset safe, and rejects unsafe integers', async () => {
  const h = harness([0, 0, 250000], [[{ id: 'last-tier' }]]);
  const maximum = await h.invoke({ q: 'RE', page: '10000', limit: '20' });
  assert.equal(maximum.code, 200);
  assert.equal(h.calls.find(call => !call.query.aggregate)?.query.offset, 199980);
  for (const page of ['10001', '9007199254740992']) {
    const rejected = await h.invoke({ q: 'RE', page, limit: '20' });
    assert.equal(rejected.code, 400);
  }
});

test('leaves additional-code aliases disabled unless explicitly enabled', async () => {
  const collections = [];
  class ItemsService {
    constructor(collection) { this.collection = collection; collections.push(collection); }
    async readByQuery(query) { return query.aggregate ? [{ count: { id: 0 } }] : []; }
  }
  const handler = createSearchHandler({ services: { ItemsService }, getSchema: async () => ({ collections: { product_codes: {} } }), env: {} });
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ query: { q: 'RE' } }, res);
  assert.equal(res.code, undefined);
  assert.equal(collections.includes('product_codes'), false);
});

test('reports an incomplete optional additional-code candidate window', async () => {
  const calls = [];
  class ItemsService {
    constructor(collection) { this.collection = collection; }
    async readByQuery(query) {
      calls.push({ collection: this.collection, query });
      if (query.aggregate && this.collection === 'products') return [{ count: { id: 0 } }];
      if (query.aggregate) return [{ count: { id: 201 } }];
      if (this.collection === 'product_codes') return Array.from({ length: 200 }, (_, index) => ({ product: `p${index}` }));
      if (query.filter._and?.some(part => part.id?._in)) return query.filter._and.find(part => part.id?._in).id._in.map(id => ({ id, slug: id, title: 'Hydraulic part', sku: id }));
      return [];
    }
  }
  const handler = createSearchHandler({ services: { ItemsService }, getSchema: async () => ({ collections: { product_codes: {} } }), env: { COMMERCE_ENABLE_ADDITIONAL_CODES: 'true' }, forcePublishedCategory: true });
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ query: { q: 'RE', page: '21', limit: '10' } }, res);
  assert.equal(res.body.meta.partial, true);
  assert.equal(res.body.meta.total, 200);
  assert.equal(calls.some(call => call.collection === 'product_codes' && call.query.limit > 200), false);
});

test('deduplicates aliases that already match native product fields', async () => {
  class ItemsService {
    constructor(collection) { this.collection = collection; }
    async readByQuery(query) {
      if (this.collection === 'product_codes' && query.aggregate) return [{ count: { id: 2 } }];
      if (this.collection === 'product_codes') return [{ product: 'native' }, { product: 'alias' }];
      if (query.aggregate) return [{ count: { id: query.filter._and.some(part => part.sku_normalized?._eq) ? 1 : 0 } }];
      if (query.filter._and?.some(part => part.id?._in)) return [
        { id: 'native', sku_normalized: 'RE', title: 'Pump' },
        { id: 'alias', sku_normalized: 'UNRELATED', title: 'Other part' },
      ];
      return [{ id: 'native', slug: 'native', title: 'Pump', sku: 'RE' }];
    }
  }
  const handler = createSearchHandler({ services: { ItemsService }, getSchema: async () => ({ collections: { product_codes: {} } }), env: { COMMERCE_ENABLE_ADDITIONAL_CODES: 'true' } });
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ query: { q: 'RE', limit: '10' } }, res);
  assert.equal(res.body.meta.total, 2);
  assert.deepEqual(res.body.data.map(item => item.id), ['native', 'alias']);
});
