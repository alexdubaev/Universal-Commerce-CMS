import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { accessBlueprint } from "../access/blueprint.mjs";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));

test("access asset folders use fresh valid instance UUIDs in every permission reference", () => {
  const ids = [accessBlueprint.publicAssetFolder.id, accessBlueprint.leadAttachmentFolder.id];
  assert.equal(new Set(ids).size, 2);
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu);
  assert.ok(!ids.includes("1ecf70c5-0ad4-4e5e-8d73-78ee549f064a"));
  assert.ok(!ids.includes("20fe4272-2f18-4ec8-a52a-f0efce9bcef8"));
  const frontend = accessBlueprint.policies.find(({ key }) => key === "frontend_api");
  const assetCreate = frontend.permissions.find(({ collection, action }) => collection === "directus_files" && action === "create");
  assert.deepEqual(assetCreate.presets, { folder: accessBlueprint.leadAttachmentFolder.id });
  const content = accessBlueprint.policies.find(({ key }) => key === "content_manager");
  const publicCreate = content.permissions.find(({ collection, action }) => collection === "directus_files" && action === "create");
  assert.deepEqual(publicCreate.presets, { folder: accessBlueprint.publicAssetFolder.id });
});

test("Compose is pinned and isolated to this loopback development stack", async () => {
  const compose = await readFile(resolve(root, "dev/compose.yml"), "utf8");
  assert.match(compose, /^name: universal-commerce-cms-dev/m);
  assert.match(compose, /directus\/directus:12\.1\.1/u);
  assert.match(compose, /postgres:17-alpine/u);
  assert.match(compose, /127\.0\.0\.1:18056:8055/u);
  assert.match(compose, /postgres-data:/u);
  assert.match(compose, /directus-uploads:/u);
  assert.doesNotMatch(compose, /\.\.\/deere-shop|\.\.\/deereshop|\b8055:8055|ports:\s*\n\s*- "\d+:/iu);
  const env = await readFile(resolve(root, "dev/.env.example"), "utf8");
  assert.match(env, /^DIRECTUS_URL=http:\/\/127\.0\.0\.1:18056$/mu);
  assert.match(env, /^DIRECTUS_PUBLIC_ASSETS_FOLDER_ID=/mu);
});
