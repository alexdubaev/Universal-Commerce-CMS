import test from "node:test";
import assert from "node:assert/strict";

import {
  applyCommerceProjectSettings,
  mergeProductEditorModuleBar,
} from "./apply-project-settings.mjs";

test("adds product editor to Directus defaults while preserving built-in module entries", () => {
  const merged = mergeProductEditorModuleBar(null);
  const ids = merged.map(({ id }) => id);

  assert.deepEqual(ids, [
    "content",
    "product-editor",
    "visual",
    "users",
    "files",
    "insights",
    "deployments",
    "docs",
    "settings",
  ]);
  assert.deepEqual(merged.find(({ id }) => id === "product-editor"), {
    type: "module",
    id: "product-editor",
    enabled: true,
  });
  assert.equal(merged.find(({ id }) => id === "settings").locked, true);
  assert.equal(merged.find(({ id }) => id === "visual").enabled, false);
});

test("preserves a configured module bar and does not duplicate product editor on repeat", () => {
  const current = [
    { type: "module", id: "content", enabled: true, custom: "keep" },
    { type: "link", id: "owner-link", enabled: true, url: "/custom", label: "Owner" },
  ];
  const first = mergeProductEditorModuleBar(current);
  const second = mergeProductEditorModuleBar(first);

  assert.deepEqual(first.filter(({ id }) => id !== "product-editor"), current);
  assert.equal(first.filter(({ id }) => id === "product-editor").length, 1);
  assert.deepEqual(second, first);
});

test("applies profile language and neutral project settings idempotently", async () => {
  const requests = [];
  let current = { project_name: "Directus", default_language: "en-US", project_color: "#6644FF", module_bar: null };
  const client = {
    async request(path, options = {}) {
      requests.push({ path, method: options.method ?? "GET", body: options.body });
      if ((options.method ?? "GET") === "GET") return current;
      const patch = JSON.parse(options.body);
      current = { ...current, ...patch };
      return current;
    },
  };
  const profile = { locale: "ru-RU" };

  const first = await applyCommerceProjectSettings(client, profile);
  const second = await applyCommerceProjectSettings(client, profile);

  assert.equal(first.length, 1);
  assert.deepEqual(second, []);
  assert.equal(requests.filter(({ path, method }) => path === "/settings" && method === "PATCH").length, 1);
  const patch = JSON.parse(requests.find(({ method }) => method === "PATCH").body);
  assert.equal(patch.project_name, "Universal Commerce CMS");
  assert.equal(patch.default_language, "ru-RU");
  assert.equal(patch.project_color, "#3B5B7A");
  assert.ok(patch.module_bar.some(({ id, enabled }) => id === "product-editor" && enabled));
});

test("rejects malformed configured module-bar data before patching settings", async () => {
  let patched = false;
  await assert.rejects(
    () => applyCommerceProjectSettings({
      async request(path, options = {}) {
        if (options.method === "PATCH") patched = true;
        return { module_bar: "not-json" };
      },
    }),
    /JSON|module_bar/,
  );
  assert.equal(patched, false);
});
