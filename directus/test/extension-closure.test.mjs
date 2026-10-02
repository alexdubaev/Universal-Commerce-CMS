import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { schemaBlueprint } from "../schema/blueprint.mjs";
import { studioBlueprint } from "../schema/studio-blueprint.mjs";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const extension = (name) => resolve(root, "directus/extensions", name);

test("every custom interface used by product Studio is installed with its registration", async () => {
  const gallery = studioBlueprint.fields.products.fields.gallery.interface;
  assert.equal(gallery, "deere-shop-product-gallery-preview");
  const packagePath = resolve(extension(gallery), "package.json");
  const manifest = JSON.parse(await readFile(packagePath, "utf8"));
  assert.equal(manifest["directus:extension"].type, "interface");
  const entry = resolve(extension(gallery), manifest["directus:extension"].path);
  await access(entry);
  assert.match(await readFile(entry, "utf8"), new RegExp(`id:["']${gallery}["']`));
});

test("all Studio custom registrations have a bundled dependency and preserved license metadata", async () => {
  const checks = [
    ["directus-labs-seo-plugin", "seo-interface", "MIT"],
    ["directus-extension-flexible-editor", "flexible-editor", "GPL-3.0"],
    ["deere-shop-product-gallery-preview", "deere-shop-product-gallery-preview", null],
  ];
  for (const [packageName, registration, license] of checks) {
    const path = extension(packageName);
    const manifest = JSON.parse(await readFile(resolve(path, "package.json"), "utf8"));
    assert.ok(manifest["directus:extension"], `${packageName} declares Directus extension metadata`);
    if (license) assert.equal(manifest.license, license);
    const paths = typeof manifest["directus:extension"].path === "string"
      ? [manifest["directus:extension"].path]
      : Object.values(manifest["directus:extension"].path);
    for (const file of paths) {
      await access(resolve(path, file));
    }
    const bundled = await Promise.all(paths.map((file) => readFile(resolve(path, file), "utf8")));
    assert.ok(bundled.some((contents) => contents.includes(registration)), `${packageName} contains ${registration}`);
    if (license) await access(resolve(path, "LICENSE"));
  }
  assert.ok(schemaBlueprint.collections.some(({ fields }) => fields.some(({ interface: name }) => name === "seo-interface")));
  assert.ok(schemaBlueprint.collections.some(({ fields }) => fields.some(({ interface: name }) => name === "flexible-editor")));
});
