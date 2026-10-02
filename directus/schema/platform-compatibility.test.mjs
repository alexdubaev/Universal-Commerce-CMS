import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { schemaBlueprint } from "./blueprint.mjs";

test("standalone local stack stays within the Directus 12 Core collection limit", async () => {
  const countedCollections = schemaBlueprint.collections.filter(
    ({ folder }) => !folder,
  );
  assert.ok(countedCollections.length <= 25);

  const compose = await readFile(
    new URL("../../dev/compose.yml", import.meta.url),
    "utf8",
  );
  const localExample = await readFile(
    new URL("../../dev/.env.example", import.meta.url),
    "utf8",
  );

  assert.match(compose, /directus\/directus:12\.1\.1/);
  assert.match(compose, /127\.0\.0\.1:18056:8055/);
  assert.match(localExample, /DIRECTUS_URL=http:\/\/127\.0\.0\.1:18056/);
});
