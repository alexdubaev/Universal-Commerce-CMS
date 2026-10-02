import test from "node:test";
import assert from "node:assert/strict";

import { applyProductEditorBlueprint } from "./setup-product-editor.mjs";
import { productEditorBlueprint } from "./product-editor-blueprint.mjs";

function mockClient({ fieldRows = null, relations = null } = {}) {
  const requests = [];
  const collectionMeta = { products: { meta: { translations: [] } }, product_images: { meta: { translations: [] } } };
  return {
    requests,
    collectionMeta,
    async request(path, options = {}) {
      requests.push({ path, method: options.method ?? "GET", body: options.body ? JSON.parse(options.body) : null });
      if (path === "/collections") return [{ collection: "products" }, { collection: "product_images" }, { collection: "categories" }];
      if (path === "/collections/products" || path === "/collections/product_images") {
        const name = path.split("/").at(-1);
        if (options.method === "PATCH") { collectionMeta[name].meta = { ...collectionMeta[name].meta, ...JSON.parse(options.body).meta }; return collectionMeta[name]; }
        return collectionMeta[name];
      }
      if (path === "/fields/products") return fieldRows?.products ?? [];
      if (path === "/fields/product_images") return fieldRows?.product_images ?? [];
      if (path === "/relations") return relations ?? allRelations();
      if (path.startsWith("/folders/")) return { id: path.split("/").at(-1) };
      return {};
    },
  };
}

function allRelations() {
  const result = [];
  for (const [collection, fields] of Object.entries(productEditorBlueprint.schema)) {
    for (const [field, spec] of Object.entries(fields)) {
      if (!spec.relatedCollection) continue;
      result.push({ collection, field, related_collection: spec.relatedCollection });
    }
  }
  return [...result, ...productEditorBlueprint.relations];
}

function completeMetadataSnapshot() {
  const rows = {};
  for (const collection of ["products", "product_images"]) {
    rows[collection] = Object.entries(productEditorBlueprint.schema[collection]).map(([field, spec]) => ({
      field,
      type: spec.type,
      schema: spec.schema ? { is_nullable: !spec.required, default_value: spec.default ?? null } : null,
      meta: {},
    }));
  }
  return rows;
}

test("dry run snapshots and validates only product collections without item or schema writes", async () => {
  const client = mockClient({ fieldRows: completeMetadataSnapshot(), relations: allRelations() });
  const result = await applyProductEditorBlueprint(client, { dryRun: true });
  assert.ok(result.actions.length > 0);
  assert.equal(client.requests.some(({ method }) => method !== "GET"), false);
  assert.equal(client.requests.some(({ path }) => path.startsWith("/items/") || path === "/settings"), false);
  assert.deepEqual(new Set(client.requests.map(({ path }) => path.split("/").slice(1, 2)[0])), new Set(["collections", "fields", "relations"]));
});

test("apply patches only presentation metadata and preserves type, enum, required, defaults, and item data", async () => {
  const client = mockClient({ fieldRows: completeMetadataSnapshot(), relations: allRelations() });
  const result = await applyProductEditorBlueprint(client);
  const writes = client.requests.filter(({ method }) => method !== "GET");
  assert.ok(result.actions.length > 0);
  assert.ok(writes.some(({ path }) => path === "/fields/products/title"));
  assert.ok(writes.some(({ path }) => path === "/collections/products"));
  assert.equal(writes.find(({ path }) => path === "/collections/products").body.meta.hidden, true);
  assert.ok(writes.some(({ path, body, method }) => path === "/fields/products/group_main" || (method === "POST" && body.field === "group_main")));
  for (const { path, method, body } of writes) {
    assert.ok(["PATCH", "POST"].includes(method));
    assert.match(path, /^\/(fields\/(products|product_images)(\/.*)?|collections\/(products|product_images))$/);
    if (method === "PATCH") assert.deepEqual(Object.keys(body), ["meta"]);
    if (method === "POST") {
      assert.deepEqual(Object.keys(body).sort(), ["field", "meta", "schema", "type"]);
      assert.equal(body.schema, null);
      assert.equal(body.type, "alias");
    }
  }
  assert.ok(writes.some(({ path }) => path === "/collections/products"));
});

test("preflight fails before any writes when required product relationship metadata is missing", async () => {
  const rows = completeMetadataSnapshot();
  rows.products = rows.products.filter(({ field }) => field !== "image_items");
  const client = mockClient({ fieldRows: rows, relations: allRelations() });
  await assert.rejects(() => applyProductEditorBlueprint(client), /missing field products\.image_items/);
  assert.equal(client.requests.some(({ method }) => method !== "GET"), false);
});

test("preflight rejects incompatible field types and relation targets before writes", async () => {
  const rows = completeMetadataSnapshot();
  rows.products.find(({ field }) => field === "title").type = "integer";
  const client = mockClient({ fieldRows: rows, relations: allRelations() });
  await assert.rejects(() => applyProductEditorBlueprint(client), /incompatible type products\.title/);
  assert.equal(client.requests.some(({ method }) => method !== "GET"), false);
});

test("preflight rejects a changed product image relation before writes", async () => {
  const broken = allRelations().filter((row) => !(row.collection === "product_images" && row.field === "product"));
  const client = mockClient({ fieldRows: completeMetadataSnapshot(), relations: broken });
  await assert.rejects(() => applyProductEditorBlueprint(client), /missing relation product_images\.product -> products/);
  assert.equal(client.requests.some(({ method }) => method !== "GET"), false);
});

test("public upload folder must exist and is configured on native file selectors", async () => {
  const folderId = "123e4567-e89b-42d3-a456-426614174000";
  const client = mockClient({ fieldRows: completeMetadataSnapshot(), relations: allRelations() });
  const result = await applyProductEditorBlueprint(client, { publicFolderId: folderId });
  assert.equal(client.requests.some(({ path }) => path === `/folders/${folderId}`), true);
  const mainImage = client.requests.find(({ path, body }) => path === "/fields/products/main_image" && body?.meta?.options?.folder === folderId);
  const documents = client.requests.find(({ path, body }) => path === "/fields/products/documents" && body?.meta?.options?.fields?.find((field) => field.field === "file")?.meta?.options?.folder === folderId);
  assert.ok(mainImage);
  assert.ok(documents);
  assert.ok(result.actions.some((action) => action.includes("main_image")));
});

test("invalid public upload folder IDs fail before reads or writes", async () => {
  const client = mockClient();
  await assert.rejects(() => applyProductEditorBlueprint(client, { publicFolderId: "not-a-uuid" }), /UUID/);
  assert.deepEqual(client.requests, []);
});

test("matching metadata is idempotent", async () => {
  const rows = completeMetadataSnapshot();
  const first = mockClient({ fieldRows: rows, relations: allRelations() });
  await applyProductEditorBlueprint(first);
  for (const { path, method, body } of first.requests.filter(({ method }) => method !== "GET")) {
    if (path.startsWith("/collections/")) continue;
    const collection = path.split("/")[2];
    if (method === "POST") {
      rows[collection].push({ field: body.field, type: body.type, schema: body.schema, meta: body.meta });
    } else {
      const fieldName = decodeURIComponent(path.split("/")[3]);
      rows[collection].find((row) => row.field === fieldName).meta = body.meta;
    }
  }
  const second = mockClient({ fieldRows: rows, relations: allRelations() });
  second.collectionMeta.products.meta = first.collectionMeta.products.meta;
  second.collectionMeta.product_images.meta = first.collectionMeta.product_images.meta;
  const result = await applyProductEditorBlueprint(second);
  assert.deepEqual(result.actions, []);
  assert.equal(second.requests.some(({ method }) => method !== "GET"), false);
});
