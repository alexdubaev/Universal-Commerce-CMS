import test from "node:test";
import assert from "node:assert/strict";

import {
  applyCommerceProjectSettings,
} from "./apply-project-settings.mjs";

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
