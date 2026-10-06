import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url);
const file = (relative) => new URL(relative, root);

test("commerce API and integrity ship source/dist pairs with Directus registrations", () => {
  for (const [name, files, extensionType] of [
    ["commerce-api", ["index.js", "leads.mjs", "mutations.mjs", "orders.mjs", "versions.mjs", "storefront.mjs"], "endpoint"],
    ["commerce-integrity", ["index.js", "product-identity.mjs", "section-snapshot.mjs"], "hook"],
  ]) {
    for (const relative of files) {
      const source = readFileSync(file(`directus/extensions/${name}/src/${relative}`));
      const dist = readFileSync(file(`directus/extensions/${name}/dist/${relative}`));
      assert.deepEqual(dist, source, `${name}/${relative} source and dist must match`);
    }
    const packageJson = JSON.parse(readFileSync(file(`directus/extensions/${name}/package.json`), "utf8"));
    assert.equal(packageJson["directus:extension"].type, extensionType);
    assert.equal(packageJson["directus:extension"].path, "dist/index.js");
    assert.equal(packageJson["directus:extension"].source, "src/index.js");
    assert.equal(statSync(file(`directus/extensions/${name}/dist/index.js`)).isFile(), true);
  }
});

test("products declare server-owned identity fields", () => {
  const blueprint = readFileSync(file("directus/schema/blueprint.mjs"), "utf8");
  assert.match(blueprint, /field\("brand_key"/);
  assert.match(blueprint, /field\("identity_key"/);
  assert.match(blueprint, /identityManagedUnique:\s*true/);
});
