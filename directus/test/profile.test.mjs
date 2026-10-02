import test from "node:test";
import assert from "node:assert/strict";
import { demoContent } from "../../profiles/commerce/profile.mjs";
import { schemaBlueprint } from "../schema/blueprint.mjs";

test("commerce seed satisfies required fields with instance-generated primary keys", () => {
  const collections = new Map(schemaBlueprint.collections.map((item) => [item.name, item]));
  for (const [name, rows] of Object.entries(demoContent)) {
    const collection = collections.get(name);
    assert.ok(collection, `profile references known collection ${name}`);
    const required = collection.fields.filter((item) => item.required && !(item.primary && item.default === "uuid")).map((item) => item.name);
    for (const row of rows) {
      for (const field of required) {
        assert.notEqual(row[field], undefined, `${name}.${field} is required`);
        assert.notEqual(row[field], null, `${name}.${field} cannot be null`);
      }
      if (row.status !== undefined) assert.equal(row.status, "draft");
    }
  }
  assert.equal(demoContent.products[0].brand, "Example Manufacturer");
  assert.equal(demoContent.site_settings[0].email, "demo@example.test");
  assert.ok(!JSON.stringify(demoContent).includes("John Deere"));
});
