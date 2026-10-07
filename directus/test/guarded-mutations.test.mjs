import test from "node:test";
import assert from "node:assert/strict";
import { createGuardedMutationHandler } from "../extensions/commerce-api/src/mutations.mjs";

function harness({
  collection = "products",
  current = { id: "item-1", title: "Before" },
  accountability = { user: "user-1" },
  lockError,
  readError,
} = {}) {
  const calls = [];
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const context = {
    accountability,
    params: { collection, id: "item-1" },
    body: { expected: { id: "item-1", title: "Before" }, changes: { title: "After" } },
  };
  const database = {
    transaction: (callback) => callback((collection) => ({
      where: () => ({
        forUpdate: () => ({
          first: async () => {
            calls.push(["lock", collection]);
            if (lockError) throw lockError;
            return { id: "item-1" };
          },
        }),
      }),
    })),
  };
  const serviceAccountabilities = [];
  class ItemsService {
    constructor(_collection, options) { serviceAccountabilities.push(options.accountability); }
    async readOne(_id, { fields }) {
      calls.push(["read", fields]);
      if (readError) throw readError;
      return Object.fromEntries(fields.map((field) => [field, field === "id" ? current.id : current[field]]));
    }
    async updateOne(_id, changes) {
      calls.push(["update", { ...changes }]);
      Object.assign(current, changes);
    }
    async deleteOne() { calls.push(["delete"]); }
  }
  const handler = createGuardedMutationHandler({
    database,
    services: { ItemsService },
    getSchema: async () => ({ collections: { [collection]: { fields: {} } }, relations: [] }),
    logger: { warn() {} },
  });
  return { handler, context, response, calls, current, serviceAccountabilities };
}

test("guarded mutation applies a matching snapshot and returns saved fields", async () => {
  const state = harness();
  await state.handler(state.context, state.response);
  assert.equal(state.response.statusCode, 200);
  assert.deepEqual(state.response.body, { data: { id: "item-1", title: "After" } });
  assert.deepEqual(state.calls.filter(([kind]) => kind === "update"), [["update", { title: "After" }]]);
});

test("stale snapshot returns a conflict without changing caller input or writing", async () => {
  const state = harness({ current: { id: "item-1", title: "Changed elsewhere" } });
  const bodyBefore = structuredClone(state.context.body);
  await state.handler(state.context, state.response);
  assert.equal(state.response.statusCode, 409);
  assert.equal(state.response.body.errors[0].code, "CONFLICT");
  assert.deepEqual(state.context.body, bodyBefore);
  assert.equal(state.calls.some(([kind]) => kind === "update"), false);
});

test("unauthenticated requests fail closed before reading schema or rows", async () => {
  const state = harness({ accountability: { user: null } });
  await state.handler(state.context, state.response);
  assert.equal(state.response.statusCode, 403);
  assert.deepEqual(state.calls, []);
});

test("database lock errors do not acknowledge a save", async () => {
  const state = harness({ lockError: new Error("database unavailable") });
  await state.handler(state.context, state.response);
  assert.equal(state.response.statusCode, 500);
  assert.equal(state.response.body.errors[0].code, "WRITE_FAILED");
  assert.equal(state.calls.some(([kind]) => kind === "update"), false);
});

test("navigation cleanup uses the transactional snapshot and refuses stale deletes", async () => {
  const state = harness({
    collection: "navigation_items",
    current: { id: "item-1", label: "Changed elsewhere" },
  });
  state.context.body = { expected: { id: "item-1", label: "Before" }, action: "delete" };
  await state.handler(state.context, state.response);
  assert.equal(state.response.statusCode, 409);
  assert.equal(state.response.body.errors[0].code, "CONFLICT");
  assert.equal(state.calls.some(([kind]) => kind === "delete"), false);
});

test("navigation mutation preserves native authorization and rejects anonymous callers", async () => {
  const technicalAccountability = { user: "service-user", role: "zero-grant-role", admin: false, app: false };
  const denied = harness({
    collection: "navigation_items",
    accountability: technicalAccountability,
    readError: Object.assign(new Error("forbidden"), { code: "FORBIDDEN" }),
  });
  denied.context.body = { expected: { id: "item-1", label: "Before" }, action: "delete" };
  await denied.handler(denied.context, denied.response);
  assert.equal(denied.response.statusCode, 403);
  assert.equal(denied.calls.some(([kind]) => kind === "delete"), false);
  assert.deepEqual(denied.serviceAccountabilities, [technicalAccountability]);

  const anonymous = harness({ collection: "navigation_items", accountability: { user: null, admin: false } });
  anonymous.context.body = { expected: { id: "item-1", label: "Before" }, action: "delete" };
  await anonymous.handler(anonymous.context, anonymous.response);
  assert.equal(anonymous.response.statusCode, 403);
  assert.equal(anonymous.calls.length, 0);
});
