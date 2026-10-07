import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Readable, Writable } from 'node:stream';
import { registerStorefrontGateway } from '../extensions/commerce-api/src/storefront.mjs';

// Run failures in separate processes: an unhandled stream error must fail the
// regression without terminating the rest of the test runner.
const execute = promisify(execFile);
const nextTurn = () => new Promise(resolve => setImmediate(resolve));

async function runCase(scenario) {
  const user = '12345678-1234-1234-1234-123456789abc';
  const folder = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const file = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const chunks = [];
  class Response extends Writable {
    constructor() { super(); this.statusCode = 200; this.headers = {}; this.headersSent = false; }
    _write(chunk, encoding, done) {
      this.headersSent = true;
      chunks.push(Buffer.from(chunk));
      if (scenario === 'disconnect') setImmediate(() => this.destroy());
      done();
    }
    status(code) { this.statusCode = code; return this; }
    set(headers) { Object.assign(this.headers, headers); return this; }
    removeHeader(name) { delete this.headers[name]; }
    json(body) {
      assert.equal(this.headersSent, false, 'must not append JSON to partial asset bytes');
      assert.equal(this.destroyed, false, 'must not respond to a disconnected client');
      this.headers['Content-Type'] ??= 'application/json';
      this.end(JSON.stringify(body)); return this;
    }
  }
  let started, release, source, factoryCalls = 0;
  const factoryStarted = new Promise(resolve => { started = resolve; });
  const deferred = new Promise(resolve => { release = resolve; });
  class ItemsService {
    constructor(collection) { this.collection = collection; }
    async readByQuery() { return this.collection === 'directus_files' ? [{ id: file, folder }] : [{ id: user }]; }
  }
  class AssetsService {
    async getAsset(...args) {
      assert.deepEqual(args, [file, null, undefined, true]);
      return { file: { type: 'image/png', filename_download: 'fixture.png' }, stream: async () => {
        factoryCalls++;
        started();
        if (scenario.startsWith('deferred-')) await deferred;
        if (scenario === 'reject' || scenario === 'deferred-reject') throw new Error('private storage details');
        let reading = false;
        source = scenario === 'success' ? Readable.from([Buffer.from('fixture bytes')]) : new Readable({
          read() {
            if (reading) return;
            reading = true;
            if (scenario === 'partial-error' || scenario === 'partial-close' || scenario === 'disconnect') this.push('partial bytes');
            if (scenario === 'early-error' || scenario === 'partial-error') setImmediate(() => this.destroy(new Error('private storage details')));
            if (scenario === 'early-close' || scenario === 'partial-close') setImmediate(() => this.destroy());
          },
        });
        if (scenario === 'already-destroyed') { source.destroy(); await nextTurn(); }
        return source;
      } };
    }
  }
  let handler;
  registerStorefrontGateway({ get(path, value) { if (path === '/storefront/assets/:id') handler = value; }, post() {} }, {
    env: { COMMERCE_STOREFRONT_ENABLED: 'true', COMMERCE_STOREFRONT_USER_ID: user, COMMERCE_STOREFRONT_PUBLIC_FOLDER_ID: folder },
    services: { ItemsService, AssetsService }, getSchema: async () => ({}), database: {},
  });
  const res = new Response();
  const closed = once(res, 'close');
  const pending = handler({ accountability: { user, admin: false }, params: { id: file } }, res);
  if (scenario.startsWith('deferred-')) {
    await factoryStarted;
    res.destroy();
    await closed;
    release();
  }
  await pending;
  await closed;
  await nextTurn();
  const result = { status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString(), ended: res.writableEnded, destroyed: res.destroyed, sourceDestroyed: source?.destroyed ?? null, factoryCalls };
  source?.destroy();
  return result;
}

if (process.argv[2] === '--asset-stream-case') {
  process.stdout.write(`${JSON.stringify(await runCase(process.argv[3]))}\n`);
} else {
  async function scenario(name) {
    const { stdout } = await execute(process.execPath, [fileURLToPath(import.meta.url), '--asset-stream-case', name], { timeout: 5000 });
    return JSON.parse(stdout);
  }
  test('public asset successfully delivers real stream bytes with security headers', async () => {
    const result = await scenario('success');
    assert.equal(result.status, 200);
    assert.equal(result.body, 'fixture bytes');
    assert.equal(result.ended, true);
    assert.equal(result.sourceDestroyed, true);
    assert.equal(result.headers['Content-Type'], 'image/png');
    assert.equal(result.headers['Cache-Control'], 'no-store');
    assert.equal(result.headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(result.headers['Content-Security-Policy'], "sandbox; default-src 'none'");
    assert.match(result.headers['Content-Disposition'], /^inline;/);
  });
  for (const name of ['early-error', 'early-close', 'already-destroyed', 'reject']) {
    test(`asset ${name} before bytes returns safe JSON and ends the response`, async () => {
      const result = await scenario(name);
      assert.equal(result.status, 404);
      assert.deepEqual(JSON.parse(result.body), { error: 'invalid_request' });
      assert.equal(result.headers['Content-Type'], 'application/json');
      assert.equal(result.headers['Content-Disposition'], undefined);
      assert.equal(result.headers['Cache-Control'], 'no-store');
      assert.equal(result.ended, true);
    });
  }
  for (const name of ['partial-error', 'partial-close']) {
    test(`asset ${name} after bytes closes the response without a second body`, async () => {
      const result = await scenario(name);
      assert.equal(result.body, 'partial bytes');
      assert.equal(result.destroyed, true);
      assert.equal(result.sourceDestroyed, true);
      assert.equal(result.ended, false);
    });
  }
  for (const name of ['disconnect', 'deferred-disconnect']) {
    test(`asset ${name} destroys the source stream`, async () => {
      const result = await scenario(name);
      assert.equal(result.sourceDestroyed, true);
      assert.equal(result.destroyed, true);
      if (name === 'deferred-disconnect') assert.equal(result.body, '');
    });
  }
  test('deferred factory rejection after disconnect writes no error response', async () => {
    const result = await scenario('deferred-reject');
    assert.equal(result.body, '');
    assert.equal(result.status, 200);
    assert.equal(result.destroyed, true);
  });
}
