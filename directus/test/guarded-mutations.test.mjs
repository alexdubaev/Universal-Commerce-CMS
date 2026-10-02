import test from "node:test";
import assert from "node:assert/strict";
import { createGuardedMutationHandler } from "../extensions/commerce-api/src/mutations.mjs";

function harness({ current = { id: "item-1", title: "Before" }, accountability = { user: "user-1" }, lockError } = {}) {
  const calls = [];
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const context = {
    accountability,
    params: { collection: "products", id: "item-1" },
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
  class ItemsService {
    async readOne(_id, { fields }) {
      calls.push(["read", fields]);
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
    getSchema: async () => ({ collections: { products: { fields: {} } }, relations: [] }),
    logger: { warn() {} },
  });
  return { handler, context, response, calls, current };
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
