import test from "node:test";
import assert from "node:assert/strict";
import { applyBlueprint, buildFieldPayload } from "./apply-schema.mjs";

function metadataStore() {
  const collection = { name: "order_lines", fields: [{ name: "id", type: "uuid", primary: true }] };
  const current = { collection: collection.name, meta: { archive_field: "status", archive_value: "archived", unarchive_value: "draft", archive_app_filter: true, icon: "hand-chosen-icon", note: "Manual annotation" } };
  const writes = [];
  const client = { async request(path, options = {}) {
    if (!options.method) {
      if (path === "/collections") return [structuredClone(current)];
      if (path === "/fields/order_lines") return [{ field: "id", type: "uuid" }];
      if (path === "/relations") return [];
      throw Error(`Unexpected read ${path}`);
    }
    const body = JSON.parse(options.body);
    writes.push({ path, method: options.method, body });
    assert.equal(path, "/collections/order_lines");
    assert.equal(options.method, "PATCH");
    Object.assign(current.meta, body.meta);
    return structuredClone(current);
  } };
  return { current, writes, client, blueprint: { collections: [collection], seed: {} } };
}

test("reconciles stale archive metadata without touching content or unrelated metadata", async () => {
  const state = metadataStore();
  const actions = await applyBlueprint(state.client, state.blueprint);
  assert.deepEqual(state.current.meta, { archive_field: null, archive_value: null, unarchive_value: null, archive_app_filter: false, icon: "hand-chosen-icon", note: "Manual annotation" });
  assert.equal(actions.length, 1);
  assert.deepEqual(Object.keys(state.writes[0].body.meta).sort(), ["archive_app_filter", "archive_field", "archive_value", "unarchive_value"]);
});

test("dry-run plans seed actions for collections absent from an empty instance without item reads", async () => {
  const reads = [];
  const client = { async request(path, options = {}) {
    assert.equal(options.method, undefined, "dry-run cannot write");
    reads.push(path);
    if (path.startsWith("/items/")) throw Object.assign(new Error("collection does not exist"), { status: 403 });
    return [];
  } };
  const blueprint = { collections: [{ name: "settings", singleton: true, fields: [{ name: "id", type: "uuid", primary: true }] }, { name: "forms", fields: [{ name: "id", type: "uuid", primary: true }] }], seed: { settings: [{ company_name: "Synthetic" }], forms: [{ id: "f" }] } };
  const actions = await applyBlueprint(client, blueprint, { dryRun: true });
  assert.ok(actions.includes("seed settings.singleton"));
  assert.ok(actions.includes("seed forms.f"));
  assert.ok(!reads.some((path) => path.startsWith("/items/")));
});

test("identity-managed SKU uniqueness is omitted from generic field payloads", () => {
  const actual = buildFieldPayload({ name: "sku", type: "string", required: true, identityManagedUnique: true });
  assert.equal(Object.hasOwn(actual.schema, "is_unique"), false);
  assert.equal(buildFieldPayload({ name: "canonical_key", type: "string", unique: true }).schema.is_unique, true);
});
