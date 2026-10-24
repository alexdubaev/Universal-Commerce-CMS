import test from 'node:test';
import assert from 'node:assert/strict';
import registerCommerceEndpoint from '../extensions/commerce-api/src/index.js';

const USER = '12345678-1234-1234-1234-123456789abc';

function harness(env = {}) {
  const routes = new Map();
  const router = {
    get(path, handler) { routes.set(`GET ${path}`, handler); },
    post(path, handler) { routes.set(`POST ${path}`, handler); },
  };
  registerCommerceEndpoint(router, { env });
  return async accountability => {
    const handler = routes.get('GET /config/storefront');
    assert.ok(handler, 'storefront config route registered');
    const res = {
      statusCode: 200, headers: {}, body: undefined,
      status(code) { this.statusCode = code; return this; },
      set(headers) { Object.assign(this.headers, headers); return this; },
      json(body) { this.body = body; return this; },
    };
    await handler({ accountability }, res);
    return res;
  };
}

test('storefront config requires an authenticated user and returns no-store', async () => {
  const invoke = harness({ COMMERCE_STOREFRONT_URL: 'https://shop.example/store/' });
  for (const accountability of [undefined, {}, { user: null }]) {
    const res = await invoke(accountability);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'forbidden' });
    assert.equal(res.headers['Cache-Control'], 'no-store');
  }
  const res = await invoke({ user: USER });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.deepEqual(res.body, { data: { public_base_url: 'https://shop.example/store/' } });
});

test('storefront config safely normalizes valid bases and hides unsafe or missing values', async () => {
  for (const [value, expected] of [
    ['http://shop.example/catalog', 'http://shop.example/catalog/'],
    ['https://shop.example/', 'https://shop.example/'],
    ['', null],
    ['https://user:secret@shop.example/catalog', null],
    ['https://shop.example/catalog?token=secret', null],
    ['https://shop.example/catalog#secret', null],
    ['javascript:alert(1)', null],
    ['https://shop.example/\nsecret', null],
  ]) {
    const res = await harness({ COMMERCE_STOREFRONT_URL: value })({ user: USER });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { data: { public_base_url: expected } });
    assert.equal(JSON.stringify(res.body).includes('secret'), false);
  }
});
