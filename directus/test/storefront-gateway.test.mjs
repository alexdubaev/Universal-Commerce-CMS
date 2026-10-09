import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { registerStorefrontGateway } from '../extensions/commerce-api/src/storefront.mjs';
import { leadFingerprint } from '../extensions/commerce-api/src/leads.mjs';

const USER = '12345678-1234-1234-1234-123456789abc';
const FOLDER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const env = { COMMERCE_STOREFRONT_ENABLED: 'true', COMMERCE_STOREFRONT_USER_ID: USER, COMMERCE_STOREFRONT_PUBLIC_FOLDER_ID: FOLDER };
function harness(overrides = {}) {
  const routes = new Map(), calls = [];
  class ItemsService {
    constructor(collection, options) { calls.push({ collection, options }); this.collection = collection; }
    async readByQuery(query) {
      calls.push({ collection: this.collection, query });
      if (this.collection === 'leads') return overrides.leadRows ?? [];
      if (this.collection === 'site_settings') return [{ commerce_profile: { site_id: 'test-site', features: { parts_request: true } } }];
      return [{ id: USER, slug: 'fixture' }];
    }
    async createOne(payload) { calls.push({ collection: this.collection, created: payload }); return 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'; }
  }
  const context = { env: { ...env }, services: { ItemsService, AssetsService: class {} }, getSchema: async () => ({ collections: { products: { primary: 'id' } } }), database: { raw: async () => ({ rows: [{ '?column?': 1 }] }), transaction: async callback => callback(Object.assign(() => ({}), { raw: async () => ({}) })) }, ...overrides };
  const router = { get: (path, handler) => routes.set(`GET ${path}`, handler), post: (path, handler) => routes.set(`POST ${path}`, handler) };
  registerStorefrontGateway(router, context);
  const invoke = async (path, { method = 'GET', user = USER, admin = false, params = {}, query = {}, body } = {}) => {
    const handler = routes.get(`${method} ${path}`); assert.ok(handler, `${method} ${path} registered`);
    const result = Object.assign(new Writable({ write(chunk, encoding, done) { done(); } }), { statusCode: 200, headers: {}, body: undefined, status(code) { this.statusCode = code; return this; }, set(headers) { Object.assign(this.headers, headers); return this; }, json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; } });
    await handler({ accountability: { user, admin }, params, query, body }, result);
    return result;
  };
  return { routes, calls, invoke, context };
}

test('gateway denies disabled, malformed, anonymous, wrong-user and admin before service construction', async () => {
  for (const accountability of [{ user: null }, { user: USER, admin: true }, { user: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }]) {
    const h = harness();
    const res = await h.invoke('/storefront/items/:collection', { ...accountability, params: { collection: 'products' } });
    assert.equal(res.statusCode, 403); assert.equal(h.calls.length, 0);
  }
  for (const badEnv of [{ COMMERCE_STOREFRONT_ENABLED: 'false' }, { COMMERCE_STOREFRONT_USER_ID: 'admin' }, { COMMERCE_STOREFRONT_PUBLIC_FOLDER_ID: '' }]) {
    const h = harness({ env: { ...env, ...badEnv } });
    assert.equal((await h.invoke('/storefront/health')).statusCode, 403); assert.equal(h.calls.length, 0);
  }
  const typedEnv = harness({ env: { ...env, COMMERCE_STOREFRONT_ENABLED: true } });
  assert.equal((await typedEnv.invoke('/storefront/health')).statusCode, 200);
});

test('collection handler pins publication and fields and rejects unknown collection and query escalation', async () => {
  const h = harness();
  assert.equal((await h.invoke('/storefront/items/:collection', { params: { collection: 'directus_users' } })).statusCode, 404);
  assert.equal((await h.invoke('/storefront/items/:collection', { params: { collection: 'products' }, query: { fields: '*' } })).statusCode, 400);
  assert.equal((await h.invoke('/storefront/items/:collection', { params: { collection: 'products' }, query: { filter: 'x'.repeat(16385) } })).statusCode, 400);
  assert.equal((await h.invoke('/storefront/items/:collection', { params: { collection: 'products' }, query: { filter: JSON.stringify({ category: { status: { _eq: 'draft' } } }) } })).statusCode, 400);
  assert.equal(h.calls.length, 0);
  const res = await h.invoke('/storefront/items/:collection', { params: { collection: 'products' }, query: { limit: '12', page: '1' } });
  assert.equal(res.statusCode, 200);
  const sent = h.calls.find(item => item.query)?.query;
  assert.deepEqual(sent.filter, { status: { _eq: 'published' }, _and: [{ _or: [{ category: { _null: true } }, { category: { status: { _eq: 'published' } } }] }] });
  assert.ok(sent.fields.every(field => !field.includes('*'))); assert.equal(sent.limit, 12);
});

test('image partition queries accept narrow null filters and deterministic bounded offsets', async () => {
  for (const operator of ['_null', '_nnull']) {
    const h = harness();
    const response = await h.invoke('/storefront/items/:collection', { params: { collection: 'products' }, query: {
      fields: 'id,main_image', limit: '3', page: '1', offset: '27', sort: '-popularity_score,title,id',
      filter: JSON.stringify({ _and: [{ status: { _eq: 'published' } }, { main_image: { [operator]: true } }] }),
    } });
    assert.equal(response.statusCode, 200);
    const sent = h.calls.find(call => call.query)?.query;
    assert.deepEqual(sent.filter.main_image, { [operator]: true });
    assert.deepEqual(sent.sort, ['-popularity_score', 'title', 'id']);
    assert.equal(sent.offset, 27); assert.equal(sent.limit, 3);
    assert.equal(sent.filter.status._eq, 'published');
  }
  for (const [collection, expression] of [
    ['products', { _null: false }], ['products', { _nnull: 'true' }],
    ['products', { _null: true, _nnull: true }], ['products', { _eq: null }],
    ['categories', { _null: true }],
  ]) {
    const h = harness();
    assert.equal((await h.invoke('/storefront/items/:collection', { params: { collection }, query: {
      filter: JSON.stringify({ main_image: expression }),
    } })).statusCode, 400);
    assert.equal(h.calls.length, 0);
  }
  const h = harness();
  assert.equal((await h.invoke('/storefront/items/:collection', { params: { collection: 'products' }, query: {
    filter: JSON.stringify({ main_image: { _eq: FOLDER } }),
  } })).statusCode, 200);
});

test('brand aggregate accepts Directus depth-limited query parsing and rejects unknown nested keys', async () => {
  const h = harness();
  const response = await h.invoke('/storefront/items/:collection', {
    params: { collection: 'products' },
    query: {
      aggregate: { '[count]': '*' },
      groupBy: { '[]': 'brand' },
      limit: '500',
      filter: JSON.stringify({ _and: [{ status: { _eq: 'published' } }, { brand: { _nnull: true } }] }),
    },
  });
  assert.equal(response.statusCode, 200);
  const sent = h.calls.find(call => call.query)?.query;
  assert.deepEqual(sent.aggregate, { count: ['*'] });
  assert.deepEqual(sent.group, ['brand']);
  assert.equal(sent.filter.status._eq, 'published');

  const invalid = harness();
  const rejected = await invalid.invoke('/storefront/items/:collection', {
    params: { collection: 'products' },
    query: { aggregate: { '[total]': '*' }, groupBy: { '[]': 'brand' }, limit: '500' },
  });
  assert.equal(rejected.statusCode, 400);
  assert.equal(invalid.calls.length, 0);
});

test('brand aggregate accepts the installed Directus qs parser output shape', async () => {
  const h = harness();
  const response = await h.invoke('/storefront/items/:collection', {
    params: { collection: 'products' },
    query: {
      aggregate: { count: '*' },
      groupBy: ['brand'],
      limit: '500',
      filter: JSON.stringify({ _and: [{ status: { _eq: 'published' } }, { brand: { _nnull: true } }] }),
    },
  });
  assert.equal(response.statusCode, 200);
  const sent = h.calls.find(call => call.query)?.query;
  assert.deepEqual(sent.aggregate, { count: ['*'] });
  assert.deepEqual(sent.group, ['brand']);
});

test('brand aggregate accepts Directus singleton-array count normalization and rejects ambiguity', async () => {
  const h = harness();
  const query = {
    aggregate: { count: ['*'] },
    groupBy: ['brand'],
    limit: '500',
    filter: JSON.stringify({ _and: [{ status: { _eq: 'published' } }, { brand: { _nnull: true } }] }),
  };
  const response = await h.invoke('/storefront/items/:collection', { params: { collection: 'products' }, query });
  assert.equal(response.statusCode, 200);
  const aggregateQuery = h.calls.find(call => call.query)?.query;
  assert.deepEqual(aggregateQuery.aggregate, { count: ['*'] });
  assert.deepEqual(aggregateQuery.group, ['brand']);

  const invalid = harness();
  const rejected = await invalid.invoke('/storefront/items/:collection', {
    params: { collection: 'products' },
    query: { ...query, aggregate: { count: ['*', '*'] } },
  });
  assert.equal(rejected.statusCode, 400);
  assert.equal(invalid.calls.length, 0);
});

test('current adapter filter shapes stay inside collection and parent visibility allowlists', async () => {
  const h = harness();
  const sectionId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const cases = [
    ['products', { fields: 'id,slug', limit: '1', filter: JSON.stringify({ id: { _eq: sectionId } }) }],
    ['categories', { fields: 'id,slug,title,description,h1,intro,image,seo_title,seo_description,is_indexable', limit: '200', sort: 'sort_order,title', filter: JSON.stringify({ status: { _eq: 'published' } }) }],
    ['navigation_items', { fields: 'id,label,url,location,open_in_new_tab', limit: '100', sort: 'sort_order', filter: JSON.stringify({ _and: [{ status: { _eq: 'published' } }, { is_visible: { _eq: true } }, { location: { _eq: 'header' } }, { parent: { _null: true } }] }) }],
    ['page_sections', { fields: 'id,section_type,title,subtitle,text,image,image_alt,button_text,button_url,items,settings', limit: '100', sort: 'sort_order', filter: JSON.stringify({ _and: [{ status: { _eq: 'published' } }, { is_visible: { _eq: true } }, { page: { _eq: sectionId } }] }) }],
    ['product_specifications', { fields: 'id,group_name,name,value,unit', limit: '200', sort: 'sort_order', filter: JSON.stringify({ _and: [{ status: { _eq: 'published' } }, { product: { _eq: sectionId } }] }) }],
    ['product_codes', { fields: 'code,code_type,source_name', limit: '100', sort: 'code_type,code', filter: JSON.stringify({ _and: [{ product: { _eq: sectionId } }, { is_active: { _eq: true } }] }) }],
    ['products', { 'aggregate[count]': '*', 'groupBy[]': 'brand', limit: '500', filter: JSON.stringify({ _and: [{ status: { _eq: 'published' } }, { brand: { _nnull: true } }] }) }],
  ];
  for (const [collection, query] of cases) {
    const response = await h.invoke('/storefront/items/:collection', { params: { collection }, query });
    assert.equal(response.statusCode, 200, `${collection} adapter request accepted`);
  }
  const brandAggregate = h.calls.find(call => call.query?.aggregate)?.query;
  assert.deepEqual(brandAggregate.aggregate, { count: ['*'] });
  assert.deepEqual(brandAggregate.group, ['brand']);
  const sectionRead = h.calls.find(call => call.collection === 'page_sections' && call.query)?.query;
  assert.equal(sectionRead.filter.page.status._eq, 'published');
  const codeRead = h.calls.find(call => call.collection === 'product_codes' && call.query)?.query;
  assert.deepEqual(codeRead.filter._and, [
    { product: { _eq: sectionId } },
    { product: { status: { _eq: 'published' } } },
    { _or: [{ product: { category: { _null: true } } }, { product: { category: { status: { _eq: 'published' } } } }] },
  ]);
  const specificationRead = h.calls.find(call => call.collection === 'product_specifications' && call.query)?.query;
  assert.deepEqual(specificationRead.filter._and.slice(-2), [
    { product: { status: { _eq: 'published' } } },
    { _or: [{ product: { category: { _null: true } } }, { product: { category: { status: { _eq: 'published' } } } }] },
  ]);
  const analogId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const analog = await h.invoke('/storefront/items/:collection', { params: { collection: 'products_analogs' }, query: { limit: '100', fields: 'relation_type,product_from.id,product_from.status,product_from.slug,product_from.title,product_from.sku,product_from.mpn,product_from.brand,product_from.price,product_from.currency,product_from.price_status,product_from.availability_status,product_from.part_type,product_from.main_image,product_from.category.id,product_from.category.slug,product_from.category.title,product_to.id,product_to.status,product_to.slug,product_to.title,product_to.sku,product_to.mpn,product_to.brand,product_to.price,product_to.currency,product_to.price_status,product_to.availability_status,product_to.part_type,product_to.main_image,product_to.category.id,product_to.category.slug,product_to.category.title', filter: JSON.stringify({ _or: [{ product_from: { _eq: analogId } }, { product_to: { _eq: analogId } }] }) } });
  assert.equal(analog.statusCode, 200);
  const analogRead = h.calls.filter(call => call.collection === 'products_analogs' && call.query).at(-1).query;
  for (const side of ['product_from','product_to']) {
    assert.ok(analogRead.filter._and.some(term => term[side]?.status?._eq === 'published'));
    assert.ok(analogRead.filter._and.some(term => term._or?.some(branch => branch[side]?.category?._null === true)));
    assert.ok(analogRead.filter._and.some(term => term._or?.some(branch => branch[side]?.category?.status?._eq === 'published')));
  }
});

test('SEO sitemap null-or-true indexability remains bounded and publication is still forced', async () => {
  const h = harness();
  const filter = JSON.stringify({ _and: [
    { status: { _eq: 'published' } },
    { _or: [{ is_indexable: { _null: true } }, { is_indexable: { _eq: true } }] },
  ] });
  for (const [collection, fields, sort, limit] of [
    ['products', 'slug,updated_at,is_indexable', 'id', '1000'],
    ['pages', 'slug,updated_at,is_indexable', 'slug', '500'],
  ]) {
    const result = await h.invoke('/storefront/items/:collection', { params: { collection }, query: { fields, limit, offset: '0', sort, filter } });
    assert.equal(result.statusCode, 200, `${collection} sitemap rows accepted`);
    const sent = h.calls.filter(call => call.collection === collection && call.query).at(-1).query;
    assert.equal(sent.limit, Number(limit)); assert.equal(sent.filter.status._eq, 'published');
    const seoPredicate = collection === 'products' ? sent.filter._and[0]._or : sent.filter._or;
    assert.deepEqual(seoPredicate, [{ is_indexable: { _null: true } }, { is_indexable: { _eq: true } }]);
  }
});

test('frontend asset-reference query shapes map through fixed selectors and preserve parent publication', async () => {
  const h = harness();
  const id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const status = { status: { _eq: 'published' } };
  const publicCategory = { _or: [{ category: { _null: true } }, { category: { status: { _eq: 'published' } } }] };
  const publicProductCategory = { _or: [{ product: { category: { _null: true } } }, { product: { category: { status: { _eq: 'published' } } } }] };
  const queries = [
    ['products', { _and: [status, { main_image: { _eq: id } }, publicCategory] }, 'id'],
    ['product_images', { _and: [status, { image: { _eq: id } }, { product: status }, publicProductCategory] }, 'id'],
    ['product_documents', { _and: [status, { file: { _eq: id } }, { product: status }, publicProductCategory] }, 'id'],
    ['categories', { _and: [status, { _or: [{ image: { _eq: id } }, { icon: { _eq: id } }, { og_image: { _eq: id } }] }] }, 'id'],
    ['pages', { _and: [status, { og_image: { _eq: id } }] }, 'id'],
    ['page_sections', { _and: [status, { is_visible: { _eq: true } }, { image: { _eq: id } }, { page: status }] }, 'id'],
    ['page_sections', { _and: [status, { is_visible: { _eq: true } }, { image: { _eq: id } }, { home_page: status }] }, 'id'],
  ];
  for (const [collection, filter, fields] of queries) {
    const result = await h.invoke('/storefront/items/:collection', { params: { collection }, query: { fields, limit: '1', filter: JSON.stringify(filter) } });
    assert.equal(result.statusCode, 200, `${collection} asset-reference query accepted`);
  }
  for (const collection of ['product_images','product_documents']) {
    const query = h.calls.find(call => call.collection === collection && call.query)?.query;
    assert.deepEqual(query.filter._or, publicProductCategory._or);
    assert.deepEqual(query.filter._and.slice(-2), [
      { product: { status: { _eq: 'published' } } },
      { _or: [{ product: { category: { _null: true } } }, { product: { category: { status: { _eq: 'published' } } } }] },
    ], `${collection} uses Directus relation paths under root boolean operators`);
  }
  const productAssetQuery = h.calls.find(call => call.collection === 'products' && call.query)?.query;
  assert.deepEqual(productAssetQuery.filter._and[0]._or, publicCategory._or);

  const invalid = harness();
  const rejected = await invalid.invoke('/storefront/items/:collection', {
    params: { collection: 'product_images' },
    query: { fields: 'id', limit: '1', filter: JSON.stringify({ _or: [{ product: { status: { _eq: 'draft' } } }, { product: { category: { status: { _eq: 'published' } } } }] }) },
  });
  assert.equal(rejected.statusCode, 400);
  assert.equal(invalid.calls.length, 0);
  const home = await h.invoke('/storefront/items/:collection', { params: { collection: 'home_page' }, query: { fields: 'status,hero_image,og_image' } });
  assert.equal(home.statusCode, 200);
  const settings = await h.invoke('/storefront/items/:collection', { params: { collection: 'site_settings' }, query: { fields: 'logo,favicon,default_og_image,company_image' } });
  assert.equal(settings.statusCode, 200);
  const settingsQuery = h.calls.filter(call => call.collection === 'site_settings' && call.query).at(-1).query;
  assert.equal(settingsQuery.fields.includes('commerce_profile'), false);
});

test('health and orders are bounded, gated routes; orders stay disabled', async () => {
  const h = harness();
  const health = await h.invoke('/storefront/health');
  assert.deepEqual(health.body, { data: { status: 'ok' } }); assert.equal(health.headers['Cache-Control'], 'no-store');
  const order = await h.invoke('/storefront/orders', { method: 'POST' });
  assert.equal(order.statusCode, 404); assert.deepEqual(order.body, { error: 'disabled' });
});

test('search preserves normalization, no-store, candidate cap and published category predicate', async () => {
  const h = harness();
  const res = await h.invoke('/storefront/search', { query: { q: ' re-5048 ', page: '1', limit: '10' } });
  assert.equal(res.statusCode, 200); assert.equal(res.headers['Cache-Control'], 'no-store');
  const query = h.calls.find(call => call.query)?.query;
  assert.equal(query.limit, 200); assert.deepEqual(query.filter._and[1]._or[1], { category: { status: { _eq: 'published' } } });
  assert.equal(h.calls.some(call => call.collection === 'product_codes'), false);
  const escalated = await h.invoke('/storefront/search', { query: { q: 'RE', filter: '{}' } });
  assert.equal(escalated.statusCode, 400);
});

test('asset gate checks configured folder before references and enforces published child parent', async () => {
  const calls = [];
  class FileGateItems {
    constructor(collection) { this.collection = collection; }
    async readByQuery(query) {
      calls.push({ collection: this.collection, query });
      if (this.collection === 'directus_files' && query.filter.folder._eq === FOLDER) return [{ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', folder: FOLDER, type: 'image/png' }];
      return [];
    }
  }
  const h = harness({ services: { ItemsService: FileGateItems, AssetsService: class { constructor() { throw new Error('must not stream unreferenced file'); } } } });
  const assetId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const res = await h.invoke('/storefront/assets/:id', { params: { id: assetId } });
  assert.equal(res.statusCode, 404);
  const fileLookup = calls.find(call => call.collection === 'directus_files');
  assert.equal(fileLookup.query.filter.folder._eq, FOLDER);
  const imageProbe = calls.find(call => call.collection === 'product_images');
  assert.equal(imageProbe.query.filter.status._eq, 'published');
  assert.deepEqual(imageProbe.query.filter._and, [
    { product: { status: { _eq: 'published' } } },
    { _or: [{ product: { category: { _null: true } } }, { product: { category: { status: { _eq: 'published' } } } }] },
  ]);
  const documentProbe = calls.find(call => call.collection === 'product_documents');
  assert.deepEqual(documentProbe.query.filter._and, imageProbe.query.filter._and);
  const productProbe = calls.find(call => call.collection === 'products');
  assert.deepEqual(productProbe.query.filter._or, [{ category: { _null: true } }, { category: { status: { _eq: 'published' } } }]);

  const privateCalls = [];
  class PrivateFileItems extends FileGateItems {
    async readByQuery(query) { privateCalls.push(this.collection); return []; }
  }
  const privateHarness = harness({ services: { ItemsService: PrivateFileItems, AssetsService: class { constructor() { throw new Error('private file must not stream'); } } } });
  assert.equal((await privateHarness.invoke('/storefront/assets/:id', { params: { id: assetId } })).statusCode, 404);
  assert.deepEqual(privateCalls, ['directus_files']);

  const draftCalls = [];
  class DraftParentItems extends FileGateItems {
    async readByQuery(query) {
      draftCalls.push({ collection: this.collection, query });
      if (this.collection === 'directus_files') return [{ id: assetId, folder: FOLDER, type: 'image/png' }];
      if (this.collection === 'product_images') {
        const terms = query.filter._and ?? [];
        const hasPublishedParent = terms.some(term => term.product?.status?._eq === 'published');
        const hasPublishedCategoryGate = terms.some(term => term._or?.some(branch => branch.product?.category?._null === true) && term._or?.some(branch => branch.product?.category?.status?._eq === 'published'));
        return hasPublishedParent && hasPublishedCategoryGate ? [] : [{ id: 'draft-parent-child' }];
      }
      return [];
    }
  }
  const draftHarness = harness({ services: { ItemsService: DraftParentItems, AssetsService: class { constructor() { throw new Error('draft-parent asset must not stream'); } } } });
  assert.equal((await draftHarness.invoke('/storefront/assets/:id', { params: { id: assetId } })).statusCode, 404);
  assert.ok(draftCalls.some(call => call.collection === 'product_images'));
});

test('lead gateway fixes service ownership, scopes idempotency lookup, and refuses attachments', async () => {
  const h = harness();
  const body = { request_key: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', lead: { name: 'Test Name', phone: '+70000000000', page_url: 'https://example.test/request' } };
  const saved = await h.invoke('/storefront/leads', { method: 'POST', body });
  assert.equal(saved.statusCode, 200);
  assert.deepEqual(saved.body, { data: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', replayed: false } });
  const lookup = h.calls.find(call => call.collection === 'leads' && call.query);
  assert.deepEqual(lookup.query.filter._and[1], { user_created: { _eq: USER } });
  const created = h.calls.find(call => call.collection === 'leads' && call.created);
  assert.equal(created.created.user_created, USER);
  assert.equal(created.created.status, 'new');
  const before = h.calls.length;
  const attachment = { ...body, action: 'lookup', attachment_manifest: [{ kind: 'photo', name: 'photo.png', size: 1, type: 'image/png', sha256: 'a'.repeat(64) }] };
  const denied = await h.invoke('/storefront/leads', { method: 'POST', body: attachment });
  assert.equal(denied.statusCode, 400);
  assert.equal(h.calls.length, before);
});

test('lead gateway replays and conflicts stay within the configured owner and expose acknowledgements only', async () => {
  const body = { request_key: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', lead: { name: 'Test Name', phone: '+70000000000', page_url: 'https://example.test/request' } };
  const existing = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', request_fingerprint: leadFingerprint(body.lead, []), attachments: ['private-file-id'] };
  const h = harness({ leadRows: [existing] });
  const replay = await h.invoke('/storefront/leads', { method: 'POST', body });
  assert.equal(replay.statusCode, 200);
  assert.deepEqual(replay.body, { data: { id: existing.id, replayed: true } });
  const ownerScoped = h.calls.find(call => call.collection === 'leads' && call.query).query.filter._and[1];
  assert.deepEqual(ownerScoped, { user_created: { _eq: USER } });
  assert.equal(h.calls.some(call => call.created), false);

  const conflict = await h.invoke('/storefront/leads', { method: 'POST', body: { ...body, lead: { ...body.lead, name: 'Changed Name' } } });
  assert.equal(conflict.statusCode, 409);
  assert.equal(JSON.stringify(conflict.body).includes('private-file-id'), false);
});


// Exercise the handler with records and an in-memory Directus query boundary.
// Removing the server publication predicate would expose draft/future records.
function articleHarness({ folder = FOLDER, articleRows } = {}) {
  const assetId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const rows = articleRows ?? [
    { id: USER, slug: 'published', title: 'Public', status: 'published', published_at: '2020-01-01T00:00:00.000Z', cover_image: assetId },
    { id: FOLDER, slug: 'draft', title: 'Private', status: 'draft', published_at: '2020-01-01T00:00:00.000Z', cover_image: assetId },
    { id: assetId, slug: 'future', title: 'Scheduled', status: 'published', published_at: '2999-01-01T00:00:00.000Z', og_image: assetId },
    { id: assetId, slug: 'archived', status: 'archived', published_at: '2020-01-01T00:00:00.000Z', cover_image: assetId },
    { id: assetId, slug: 'missing-date', status: 'published', published_at: null, cover_image: assetId },
  ];
  const matches = (row, filter) => Object.entries(filter).every(([field, expression]) => {
    if (field === '_and') return expression.every(term => matches(row, term));
    if (field === '_or') return expression.some(term => matches(row, term));
    return Object.entries(expression).every(([operator, value]) => {
      if (operator === '_eq') return row[field] === value;
      if (operator === '_nnull') return row[field] != null;
      if (operator === '_lte') return row[field] != null && Date.parse(row[field]) <= Date.parse(value);
      throw new Error(`Unsupported fixture operator ${operator}`);
    });
  });
  class ItemsService {
    constructor(collection) { this.collection = collection; }
    async readByQuery(query) {
      if (this.collection === 'directus_files') return matches({ id: assetId, folder }, query.filter) ? [{ id: assetId, folder }] : [];
      if (this.collection !== 'articles') return [];
      const filtered = rows.filter(row => matches(row, query.filter));
      if (query.aggregate) return [{ count: { id: filtered.length } }];
      return filtered.slice((query.page - 1 || 0) * query.limit, (query.page || 1) * query.limit).map(row => Object.fromEntries(query.fields.filter(field => field in row).map(field => [field, row[field]])));
    }
  }
  class AssetsService {
    async getAsset() { return { file: { type: 'image/png', filename_download: 'cover.png' }, stream: async () => Readable.from(['article cover']) }; }
  }
  return { ...harness({ services: { ItemsService, AssetsService } }), assetId };
}

test('articles independently pin publication and due date for list, detail and count', async () => {
  const h = articleHarness();
  for (const filter of [undefined, JSON.stringify({ published_at: { _lte: '2999-12-01T00:00:00.000Z' } })]) {
    const res = await h.invoke('/storefront/items/:collection', { params: { collection: 'articles' }, query: { fields: 'slug,title', meta: 'filter_count', limit: '1', ...(filter ? { filter } : {}) } });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { data: [{ slug: 'published', title: 'Public' }], meta: { filter_count: 1 } });
    assert.equal(res.headers['Cache-Control'], 'no-store');
  }
  for (const slug of ['draft','future','archived','missing-date']) {
    const res = await h.invoke('/storefront/items/:collection', { params: { collection: 'articles' }, query: { fields: 'slug', filter: JSON.stringify({ slug: { _eq: slug } }) } });
    assert.equal(res.statusCode, 200); assert.deepEqual(res.body.data, []);
  }
  const beforePublication = await h.invoke('/storefront/items/:collection', { params: { collection: 'articles' }, query: { fields: 'slug', filter: JSON.stringify({ _and: [{ status: { _eq: 'published' } }, { published_at: { _lte: '2019-01-01T00:00:00.000Z' } }] }) } });
  assert.deepEqual(beforePublication.body.data, []);
});

test('articles deny status, relation, fields, date and query escalations before reads', async () => {
  const h = harness();
  const invalidQueries = [
    { fields: '*' }, { fields: 'content_blocks' }, { fields: 'author.email' },
    { filter: JSON.stringify({ status: { _eq: 'draft' } }) },
    { filter: JSON.stringify({ _or: [{ status: { _eq: 'published' } }, { status: { _eq: 'draft' } }] }) },
    { filter: JSON.stringify({ product: { status: { _eq: 'published' } } }) },
    { filter: JSON.stringify({ published_at: { _gte: '2020-01-01T00:00:00.000Z' } }) },
    ...['invalid','2026-02-30T00:00:00.000Z','2026-01-01','2026-01-01T25:00:00.000Z'].map(date => ({ filter: JSON.stringify({ published_at: { _lte: date } }) })),
    { sort: '-updated_at' }, { limit: '25' }, { limit: '500', fields: 'slug,content', sort: 'slug' },
    { limit: '501', fields: 'slug,published_at', sort: 'slug' }, { offset: '1' }, { deep: '{}' },
  ];
  for (const query of invalidQueries) {
    const res = await h.invoke('/storefront/items/:collection', { params: { collection: 'articles' }, query });
    assert.equal(res.statusCode, 400, JSON.stringify(query));
  }
  assert.equal(h.calls.length, 0);
});

test('article normal paging and narrow sitemap return only public due rows', async () => {
  const h = articleHarness();
  for (const query of [{ limit: '24', page: '1', sort: '-published_at,slug' }, { limit: '500', fields: 'slug,published_at', sort: 'slug', page: '1' }]) {
    const res = await h.invoke('/storefront/items/:collection', { params: { collection: 'articles' }, query });
    assert.equal(res.statusCode, 200); assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].slug, 'published');
  }
  const res = await h.invoke('/storefront/items/:collection', { params: { collection: 'articles' }, query: { limit: '1', page: '2', meta: 'filter_count' } });
  assert.deepEqual(res.body, { data: [], meta: { filter_count: 1 } });
});

test('article assets require approved folder and published due cover or OG reference', async () => {
  const assetId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  for (const field of ['cover_image','og_image']) {
    const article = { id: USER, status: 'published', published_at: '2020-01-01T00:00:00.000Z', [field]: assetId };
    for (const changed of [{}, { status: 'draft' }, { status: 'archived' }, { published_at: '2999-01-01T00:00:00.000Z' }, { published_at: null }]) {
      const h = articleHarness({ articleRows: [{ ...article, ...changed }] });
      const response = await h.invoke('/storefront/assets/:id', { params: { id: assetId } });
      assert.equal(response.statusCode, Object.keys(changed).length ? 404 : 200, `${field} ${JSON.stringify(changed)}`);
      const reference = await h.invoke('/storefront/items/:collection', { params: { collection: 'articles' }, query: { fields: 'id', limit: '1', filter: JSON.stringify({ _and: [{ status: { _eq: 'published' } }, { published_at: { _lte: new Date().toISOString() } }, { [field]: { _eq: assetId } }] }) } });
      assert.equal(reference.statusCode, 200);
      assert.equal(reference.body.data.length, Object.keys(changed).length ? 0 : 1);
    }
    const privateFolder = articleHarness({ folder: USER, articleRows: [article] });
    assert.equal((await privateFolder.invoke('/storefront/assets/:id', { params: { id: assetId } })).statusCode, 404);
  }
});

test('article sitemap adapter projection includes status for independent client validation', async () => {
  const h = articleHarness();
  const query = {
    fields: 'status,slug,published_at', sort: 'slug', limit: '500',
    filter: JSON.stringify({ _and: [{ status: { _eq: 'published' } }, { published_at: { _lte: new Date().toISOString() } }] }),
  };
  const response = await h.invoke('/storefront/items/:collection', { params: { collection: 'articles' }, query });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.data, [{ status: 'published', slug: 'published', published_at: '2020-01-01T00:00:00.000Z' }]);
  for (const changed of [{ limit: '501' }, { fields: 'id,status,slug,published_at' }, { fields: 'status,slug,published_at,content' }, { sort: '-published_at,slug' }]) {
    const invalid = await h.invoke('/storefront/items/:collection', { params: { collection: 'articles' }, query: { ...query, ...changed } });
    assert.equal(invalid.statusCode, 400);
  }
});

test('article pagination after page 1000 preserves publication within a bounded record window', async () => {
  const publicRow = { id: USER, status: 'published', published_at: '2020-01-01T00:00:00.000Z' };
  const h = articleHarness({ articleRows: [
    ...Array.from({ length: 1000 }, (_, index) => ({ ...publicRow, slug: `a-${index}` })),
    { ...publicRow, slug: 'private-draft', status: 'draft' },
    { ...publicRow, slug: 'private-future', published_at: '2999-01-01T00:00:00.000Z' },
    { ...publicRow, slug: 'zz-page-1001' },
  ] });
  const query = {
    fields: 'status,slug,published_at', page: '1001', limit: '1', meta: 'filter_count', sort: '-published_at,slug',
    filter: JSON.stringify({ _and: [{ status: { _eq: 'published' } }, { published_at: { _lte: new Date().toISOString() } }] }),
  };
  const response = await h.invoke('/storefront/items/:collection', { params: { collection: 'articles' }, query });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { data: [{ status: 'published', slug: 'zz-page-1001', published_at: publicRow.published_at }], meta: { filter_count: 1001 } });
  for (const changed of [{ page: '1000002' }, { page: '41668', limit: '24' }, { page: '9007199254740992' }]) {
    const rejected = await h.invoke('/storefront/items/:collection', { params: { collection: 'articles' }, query: { ...query, ...changed } });
    assert.equal(rejected.statusCode, 400);
  }
  const otherCollection = await h.invoke('/storefront/items/:collection', { params: { collection: 'products' }, query: { page: '1001', limit: '1' } });
  assert.equal(otherCollection.statusCode, 400);
});
