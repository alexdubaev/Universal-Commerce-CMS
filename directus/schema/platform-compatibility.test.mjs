import test from "node:test";
import assert from "node:assert/strict";
import { schemaBlueprint } from "./blueprint.mjs";

test("standalone local stack stays within the Directus 12 Core collection limit", () => {
  const countedCollections = schemaBlueprint.collections.filter(
    ({ folder }) => !folder,
  );
  assert.ok(countedCollections.length <= 25);
});
