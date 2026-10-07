import test from "node:test";
import assert from "node:assert/strict";

import {
  applyBlueprint,
} from "./apply-schema.mjs";

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
