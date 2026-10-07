import test from "node:test";
import assert from "node:assert/strict";
import { createAtomicOrderHandler } from "../extensions/commerce-api/src/orders.mjs";
import { createAtomicLeadHandler } from "../extensions/commerce-api/src/leads.mjs";

class Mutex {
  #tails = new Map();

  async acquire(key) {
    let release;
    const previous = this.#tails.get(key) ?? Promise.resolve();
    const current = new Promise((resolve) => { release = resolve; });
    this.#tails.set(key, previous.then(() => current));
    await previous;
    return () => {
      release();
      if (this.#tails.get(key) === current) this.#tails.delete(key);
    };
  }
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function createRaceHarness() {
  const mutex = new Mutex();
  const state = {
    orders: [],
    orderItems: [],
    leads: [],
    orderCreates: 0,
    leadCreates: 0,
  };
  const products = [{
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    status: "published",
    sku: "RE568158",
    title: "Filter",
    brand: "John Deere",
    price: 100,
    price_status: "fixed",
    currency: "RUB",
  }];

  const database = {
    async transaction(callback) {
      const releases = [];
      const trx = function () {
        throw new Error("table locking is not expected without attachments");
      };
      trx.raw = async (sql, bindings = []) => {
        if (String(sql).includes("pg_advisory_xact_lock")) {
          releases.push(await mutex.acquire(bindings.join(":")));
        }
        return {};
      };
      try {
        return await callback(trx);
      } finally {
        for (const release of releases.reverse()) release();
      }
    },
  };

  class ItemsService {
    constructor(collection) { this.collection = collection; }

    async readByQuery(query = {}) {
      if (this.collection === "site_settings") {
        return [{ commerce_profile: {
          site_id: "race-test",
          currency: "RUB",
          features: { cart: true, parts_request: true },
        } }];
      }
      if (this.collection === "products") {
        const ids = query.filter?._and?.find((entry) => entry.id?._in)?.id?._in ?? [];
        return products.filter((product) => ids.includes(product.id));
      }
      if (this.collection === "orders") {
        const key = query.filter?.request_key?._eq;
        return state.orders.filter((item) => item.request_key === key)
          .map(({ id, request_fingerprint }) => ({ id, request_fingerprint }));
      }
      if (this.collection === "leads") {
        const key = query.filter?.request_key?._eq;
        return state.leads.filter((item) => item.request_key === key)
          .map(({ id, request_fingerprint, attachments }) => ({ id, request_fingerprint, attachments }));
      }
      return [];
    }

    async createOne(value) {
      await new Promise((resolve) => setTimeout(resolve, 8));
      if (this.collection === "orders") {
        state.orderCreates += 1;
        const id = `order-${state.orderCreates}`;
        state.orders.push({ id, ...structuredClone(value) });
        return id;
      }
      if (this.collection === "leads") {
        state.leadCreates += 1;
        const id = `lead-${state.leadCreates}`;
        state.leads.push({ id, ...structuredClone(value) });
        return id;
      }
      throw new Error(`unexpected createOne collection: ${this.collection}`);
    }

    async createMany(values) {
      if (this.collection !== "order_items") throw new Error("unexpected createMany");
      state.orderItems.push(...structuredClone(values));
    }
  }

  const context = {
    database,
    services: { ItemsService },
    getSchema: async () => ({ collections: {} }),
    logger: { warn() {} },
  };

  return { state, context, products };
}

const orderKey = "11111111-1111-4111-8111-111111111111";
const leadKey = "22222222-2222-4222-8222-222222222222";

function orderRequest(quantity = 1) {
  return {
    accountability: { user: "user-1" },
    body: {
      request_key: orderKey,
      order: {
        customer_name: "Race",
        phone: "+79990000000",
        email: "race@example.com",
        comment: "",
        page_url: "https://example.test/request",
        currency: "RUB",
      },
      items: [{
        product: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        quantity,
        unit_price: 100,
      }],
    },
  };
}

function leadRequest(message = "same") {
  return {
    accountability: { user: "user-1" },
    body: {
      request_key: leadKey,
      lead: {
        name: "Race",
        phone: "+79990000000",
        email: "race@example.com",
        message,
        page_url: "https://example.test/request",
        request_items: [{ article: "RE568158", quantity: 1 }],
      },
      attachments: [],
      attachment_manifest: [],
      action: "create",
    },
  };
}

test("concurrent identical order retries commit once and replay one durable id", async () => {
  const { state, context } = createRaceHarness();
  const handler = createAtomicOrderHandler(context);
  const responses = Array.from({ length: 10 }, () => response());

  await Promise.all(responses.map((res) => handler(orderRequest(), res)));

  assert.deepEqual(new Set(responses.map((res) => res.statusCode)), new Set([200]));
  assert.equal(new Set(responses.map((res) => res.body.data.id)).size, 1);
  assert.equal(responses.filter((res) => res.body.data.replayed === false).length, 1);
  assert.equal(responses.filter((res) => res.body.data.replayed === true).length, 9);
  assert.equal(state.orderCreates, 1);
  assert.equal(state.orders.length, 1);
  assert.equal(state.orderItems.length, 1);
});

test("concurrent conflicting order retry is rejected after the first commit", async () => {
  const { state, context } = createRaceHarness();
  const handler = createAtomicOrderHandler(context);
  const first = response();
  const conflicting = response();

  await Promise.all([
    handler(orderRequest(1), first),
    handler(orderRequest(2), conflicting),
  ]);

  assert.deepEqual([first.statusCode, conflicting.statusCode].sort(), [200, 409]);
  const conflict = [first, conflicting].find((res) => res.statusCode === 409);
  assert.equal(conflict.body.errors[0].code, "IDEMPOTENCY_CONFLICT");
  assert.equal(state.orderCreates, 1);
});

test("concurrent identical lead retries commit once and replay one durable id", async () => {
  const { state, context } = createRaceHarness();
  const handler = createAtomicLeadHandler(context);
  const responses = Array.from({ length: 10 }, () => response());

  await Promise.all(responses.map((res) => handler(leadRequest(), res)));

  assert.deepEqual(new Set(responses.map((res) => res.statusCode)), new Set([200]));
  assert.equal(new Set(responses.map((res) => res.body.data.id)).size, 1);
  assert.equal(responses.filter((res) => res.body.data.replayed === false).length, 1);
  assert.equal(responses.filter((res) => res.body.data.replayed === true).length, 9);
  assert.equal(state.leadCreates, 1);
  assert.equal(state.leads.length, 1);
});

test("concurrent conflicting lead retry is rejected after the first commit", async () => {
  const { state, context } = createRaceHarness();
  const handler = createAtomicLeadHandler(context);
  const first = response();
  const conflicting = response();

  await Promise.all([
    handler(leadRequest("first"), first),
    handler(leadRequest("different"), conflicting),
  ]);

  assert.deepEqual([first.statusCode, conflicting.statusCode].sort(), [200, 409]);
  const conflict = [first, conflicting].find((res) => res.statusCode === 409);
  assert.equal(conflict.body.errors[0].code, "IDEMPOTENCY_CONFLICT");
  assert.equal(state.leadCreates, 1);
});
