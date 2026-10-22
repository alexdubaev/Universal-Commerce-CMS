import test from "node:test";
import assert from "node:assert/strict";

import {
  applyBlueprint,
  applyRelationDeselectOverrides,
  buildRelationPayload,
} from "./apply-schema.mjs";

test("explicit deselect override changes only the opted-in product image relation", async () => {
  const field = { relatedCollection: "products", oneDeselectAction: "delete", required: true, onDelete: "CASCADE" };
  assert.equal(buildRelationPayload("product_images", field).meta.one_deselect_action, "delete");
  assert.equal(buildRelationPayload("product_codes", { relatedCollection: "products" }).meta.one_deselect_action, "nullify");
  assert.equal(buildRelationPayload("translations", { relatedCollection: "languages", translationRelation: true }).meta.one_deselect_action, "delete");
  assert.throws(() => buildRelationPayload("products", { relatedCollection: "brands", oneDeselectAction: "archive" }), /Unsupported deselect action/);

  let relation = {
    collection: "product_images",
    field: "product",
    related_collection: "products",
    meta: { one_deselect_action: "nullify", one_field: "image_items", note: "keep" },
    schema: {
      constraint_name: "product_images_product_foreign",
      table: "product_images",
      column: "product",
      foreign_key_schema: "public",
      foreign_key_table: "products",
      foreign_key_column: "id",
      on_delete: "CASCADE",
      on_update: "NO ACTION",
    },
  };
  const calls = [];
  const client = {
    async request(path, options = {}) {
      calls.push({ path, options });
      if (path === "/relations" && !options.method) return [relation];
      if (path === "/relations/product_images/product" && options.method === "PATCH") {
        const body = JSON.parse(options.body);
        if (body.collection !== relation.collection || body.field !== relation.field || body.related_collection !== relation.related_collection) {
          // Directus 12.1.1's async schema callback cannot recreate the FK
          // when the full relation identity is absent from updateOne's body.
          relation = { ...relation, meta: { ...relation.meta, ...body.meta }, schema: null };
        } else {
          relation = { ...relation, meta: { ...relation.meta, ...body.meta }, schema: { ...relation.schema, ...body.schema } };
        }
        return relation;
      }
      throw new Error(`unexpected request: ${path}`);
    },
  };
  const blueprint = { collections: [{ name: "product_images", fields: [{ name: "product", relatedCollection: "products", oneField: "image_items", oneDeselectAction: "delete" }] }] };
  await applyRelationDeselectOverrides(client, blueprint);
  const patch = calls.find(({ options }) => options.method === "PATCH");
  assert.equal(patch.path, "/relations/product_images/product");
  assert.deepEqual(JSON.parse(patch.options.body), {
    collection: "product_images",
    field: "product",
    related_collection: "products",
    meta: { one_deselect_action: "delete" },
    schema: { on_delete: "CASCADE", on_update: "NO ACTION" },
  });
  assert.equal(calls.filter(({ path }) => path === "/relations").length, 2, "must read back the persisted relation");
});

test("scoped deselect migration supports dry-run and is idempotent without unrelated requests", async () => {
  let relation = {
    collection: "product_images", field: "product", related_collection: "products",
    meta: { one_deselect_action: "nullify", one_field: "image_items", custom: "keep" },
    schema: { table: "product_images", column: "product", foreign_key_schema: "public", foreign_key_table: "products", foreign_key_column: "id", on_delete: "CASCADE", on_update: "NO ACTION" },
  };
  const patches = [];
  const client = { async request(path, options = {}) { if (path === "/relations" && !options.method) return [relation]; if (path === "/relations/product_images/product" && options.method === "PATCH") { const body = JSON.parse(options.body); patches.push({ path, body }); relation = { ...relation, ...body, meta: { ...relation.meta, ...body.meta }, schema: { ...relation.schema, ...body.schema } }; return relation; } throw new Error(`unexpected request: ${path}`); } };
  const blueprint = { collections: [{ name: "product_images", fields: [{ name: "product", relatedCollection: "products", oneDeselectAction: "delete" }] }], seed: { products: [{ id: "never" }] } };
  assert.deepEqual(await applyRelationDeselectOverrides(client, blueprint, { dryRun: true }), ["update relation deselect action product_images.product"]);
  assert.equal(patches.length, 0);
  assert.deepEqual(await applyRelationDeselectOverrides(client, blueprint), ["update relation deselect action product_images.product"]);
  assert.equal(relation.meta.custom, "keep");
  assert.deepEqual(await applyRelationDeselectOverrides(client, blueprint), []);
  assert.equal(patches.length, 1);
  assert.equal(patches[0].path, "/relations/product_images/product");
  assert.deepEqual(patches[0].body, { collection: "product_images", field: "product", related_collection: "products", meta: { one_deselect_action: "delete" }, schema: { on_delete: "CASCADE", on_update: "NO ACTION" } });
});

test("scoped deselect migration rejects HTTP-200 readback when Directus drops the foreign key", async () => {
  let relation = {
    collection: "product_images", field: "product", related_collection: "products",
    meta: { one_deselect_action: "nullify", one_field: "image_items", custom: "keep" },
    schema: { table: "product_images", column: "product", foreign_key_schema: "public", foreign_key_table: "products", foreign_key_column: "id", on_delete: "CASCADE", on_update: "NO ACTION" },
  };
  const client = {
    async request(path, options = {}) {
      if (path === "/relations" && !options.method) return [relation];
      if (path === "/relations/product_images/product" && options.method === "PATCH") {
        const body = JSON.parse(options.body);
        // Model Directus 12.1.1's ignored async alterTable callback failure:
        // the endpoint answers 200, changes metadata, but leaves schema null.
        relation = { ...relation, meta: { ...relation.meta, ...body.meta }, schema: null };
        return relation;
      }
      throw new Error(`unexpected request: ${path}`);
    },
  };
  const blueprint = { collections: [{ name: "product_images", fields: [{ name: "product", relatedCollection: "products", oneField: "image_items", oneDeselectAction: "delete" }] }] };
  await assert.rejects(applyRelationDeselectOverrides(client, blueprint), /readback.*schema|foreign key/i);
});

test("scoped deselect migration verifies FK identity, actions, and unrelated metadata after PATCH", async () => {
  const original = {
    collection: "product_images", field: "product", related_collection: "products",
    meta: { one_deselect_action: "nullify", one_field: "image_items", custom: "keep" },
    schema: { constraint_name: "product_images_product_foreign", table: "product_images", column: "product", foreign_key_schema: "public", foreign_key_table: "products", foreign_key_column: "id", on_delete: "CASCADE", on_update: "NO ACTION" },
  };
  const blueprint = { collections: [{ name: "product_images", fields: [{ name: "product", relatedCollection: "products", oneField: "image_items", oneDeselectAction: "delete" }] }] };
  const mutations = [
    (relation) => { relation.schema.foreign_key_table = "categories"; },
    (relation) => { relation.schema.on_delete = "NO ACTION"; },
    (relation) => { relation.meta.custom = "changed"; },
  ];

  for (const mutate of mutations) {
    let relation = structuredClone(original);
    const client = {
      async request(path, options = {}) {
        if (path === "/relations" && !options.method) return [relation];
        if (path === "/relations/product_images/product" && options.method === "PATCH") {
          const body = JSON.parse(options.body);
          relation = { ...relation, meta: { ...relation.meta, ...body.meta }, schema: { ...relation.schema, ...body.schema } };
          mutate(relation);
          return relation;
        }
        throw new Error(`unexpected request: ${path}`);
      },
    };
    await assert.rejects(applyRelationDeselectOverrides(client, blueprint), /readback.*(foreign key|metadata)/i);
  }
});

test("deselect migration rejects wrong identity and missing FK metadata before writes", async () => {
  const blueprint = { collections: [{ name: "product_images", fields: [{ name: "product", relatedCollection: "products", oneField: "image_items", oneDeselectAction: "delete" }] }] };
  for (const relation of [
    { collection: "product_images", field: "product", related_collection: "categories", meta: {}, schema: { table: "product_images", column: "product", foreign_key_table: "categories", foreign_key_column: "id", on_delete: "CASCADE", on_update: "NO ACTION" } },
    { collection: "product_images", field: "product", related_collection: "products", meta: { one_field: "other_alias" }, schema: { table: "product_images", column: "product", foreign_key_table: "products", foreign_key_column: "id", on_delete: "CASCADE", on_update: "NO ACTION" } },
    { collection: "product_images", field: "product", related_collection: "products", meta: {}, schema: { table: "product_images", column: "product", foreign_key_table: "products", foreign_key_column: "id", on_delete: "CASCADE" } },
    { collection: "product_images", field: "product", related_collection: "products", meta: {}, schema: { table: "product_images", column: "product", on_delete: "CASCADE", on_update: "NO ACTION" } },
  ]) {
    let writes = 0;
    const client = { async request(path, options = {}) { if (path === "/relations") return [relation]; if (options.method === "PATCH") writes += 1; throw new Error("unexpected request"); } };
    await assert.rejects(applyRelationDeselectOverrides(client, blueprint), /identity|alias|metadata|on_update/i);
    assert.equal(writes, 0);
  }

  const missingClient = { async request(path, options = {}) { if (path === "/relations") return []; if (options.method === "PATCH") throw new Error("unexpected write"); throw new Error("unexpected request"); } };
  await assert.rejects(applyRelationDeselectOverrides(missingClient, blueprint), /Missing existing relation/);
});

test("reconciles versioning metadata without touching other collections", async () => {
  const calls = [];
  const archiveMeta = {
    archive_field: null,
    archive_value: null,
    unarchive_value: null,
    archive_app_filter: false,
  };
  const client = {
    async request(path, options = {}) {
      calls.push({ path, options });
      if (path === "/collections") {
        return [
          { collection: "pages", meta: { ...archiveMeta, versioning: false } },
          { collection: "home_page", meta: { ...archiveMeta, versioning: true } },
          { collection: "products", meta: { ...archiveMeta, versioning: true } },
        ];
      }
      if (path.startsWith("/fields/")) return [];
      if (path === "/relations") return [];
      if (path === "/collections/pages") return {};
      throw new Error(`unexpected request: ${path}`);
    },
  };

  const primary = {
    name: "id",
    type: "uuid",
    primary: true,
    required: true,
    default: "uuid",
    readonly: true,
    hidden: true,
  };
  const actions = await applyBlueprint(client, {
    collections: [
      { name: "pages", versioning: true, fields: [primary] },
      { name: "home_page", versioning: true, fields: [primary] },
      { name: "products", fields: [primary] },
    ],
    seed: {},
  });

  assert.deepEqual(actions, ["enable versioning pages"]);
  const patches = calls.filter(({ options }) => options.method === "PATCH");
  assert.equal(patches.length, 1);
  assert.equal(patches[0].path, "/collections/pages");
  assert.deepEqual(JSON.parse(patches[0].options.body), {
    meta: { versioning: true },
  });
});

test("does not request fields for schema-less folders", async () => {
  const calls = [];
  const client = {
    async request(path) {
      calls.push(path);
      if (path === "/collections" || path === "/relations") return [];
      return {};
    },
  };

  await applyBlueprint(client, {
    collections: [{ name: "group_site", folder: true, fields: [] }],
    seed: {},
  }, { dryRun: true });

  assert.deepEqual(calls, ["/collections", "/relations"]);
});

test("checks string-key seeds through a filtered collection query", async () => {
  const calls = [];
  const client = {
    async request(path, options = {}) {
      calls.push({ path, method: options.method ?? "GET" });
      if (path === "/collections" || path === "/relations") return [];
      if (path.startsWith("/items/languages?")) return [];
      if (path === "/items/languages" && options.method === "POST") {
        return { code: "ru-RU" };
      }
      throw new Error(`unexpected request: ${path}`);
    },
  };

  const actions = await applyBlueprint(client, {
    collections: [],
    seed: {
      languages: [{ code: "ru-RU", name: "Русский", direction: "ltr" }],
    },
  });

  assert.deepEqual(actions, ["seed languages.ru-RU"]);
  assert.ok(
    calls.some(
      ({ path }) =>
        path ===
        "/items/languages?filter%5Bcode%5D%5B_eq%5D=ru-RU&limit=1&fields=code",
    ),
  );
});
