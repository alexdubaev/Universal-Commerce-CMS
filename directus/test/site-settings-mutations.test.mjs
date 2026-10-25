import test from "node:test";
import assert from "node:assert/strict";
import { createGuardedMutationHandler } from "../extensions/commerce-api/src/mutations.mjs";

const ID = "11111111-1111-4111-8111-111111111111";
const FILE = "22222222-2222-4222-8222-222222222222";
const FOLDER = "33333333-3333-4333-8333-333333333333";
const ALLOWLIST = ["company_name","legal_name","inn","kpp","ogrn","legal_address","vat_info","requisites_url","documents_url","phone","email","address","city","working_hours","delivery_region","logo","favicon","company_image","primary_color","accent_color","primary_cta_text","primary_cta_url","footer_text","footer_disclaimer","seo_title","seo_description","og_title","og_description","default_og_image"];

function harness(overrides = {}) {
  const row = { id: ID, updated_at: "2026-01-01T00:00:00Z", ...Object.fromEntries(ALLOWLIST.map(field => [field, null])), company_name: "Company", phone: "+70000000000", email: "a@example.test", ...(overrides.row ?? {}) };
  const calls = [];
  const accountability = { user: "caller", admin: false };
  const context = { accountability, params: { collection: "site_settings", id: ID }, body: { expected: { id: ID, updated_at: row.updated_at, company_name: row.company_name }, changes: { company_name: "Changed" } } };
  const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  const trx = collection => {
    const query = { where(filter) { query.filter = filter; return query; }, forUpdate() { query.locked = true; return query; }, count() { query.counting = true; return query; }, async first(...fields) {
      calls.push(["first", collection, query.filter, query.locked, fields]);
      if (query.counting) return { count: String(overrides.count ?? 1) };
      if (collection === "site_settings") return overrides.count === 0 ? undefined : { id: ID };
      if (collection === "directus_files") return Object.hasOwn(overrides, "file") ? overrides.file : { id: FILE, folder: FOLDER, type: "image/png" };
      return undefined;
    } };
    return query;
  };
  const database = { transaction: async callback => callback(Object.assign(trx, { raw: async (...args) => { calls.push(["raw", ...args]); } })) };
  const instances = [];
  class ItemsService {
    constructor(collection, options) { this.collection = collection; this.options = options; instances.push(this); }
    async readOne(id, { fields }) {
      calls.push(["readOne", this.collection, id, fields]);
      if (this.collection === "directus_files" && overrides.fileError) throw overrides.fileError;
      if (overrides.readError) throw overrides.readError;
      if (this.collection === "site_settings") return Object.fromEntries(fields.map(field => [field, row[field]]));
      return Object.hasOwn(overrides, "file") ? overrides.file : { id: FILE, folder: FOLDER, type: "image/png" };
    }
    async readByQuery(query) { calls.push(["readByQuery", this.collection, query]); if (overrides.readError) throw overrides.readError; return [overrides.file ?? { id: FILE, folder: FOLDER, type: "image/png" }]; }
    async updateOne(id, changes) { calls.push(["updateOne", this.collection, id, changes]); Object.assign(row, changes); }
    async deleteOne() { calls.push(["deleteOne", this.collection]); }
  }
  const schema = { collections: { site_settings: { collection: "site_settings", singleton: true, fields: Object.fromEntries(ALLOWLIST.map(field => [field, { field, nullable: true, generated: false, alias: false, type: ["logo","favicon","company_image","default_og_image"].includes(field) ? "uuid" : "string" }])) } }, relations: [] };
  const handler = createGuardedMutationHandler({ database, services: { ItemsService }, getSchema: async () => overrides.schema ?? schema, logger: { warn() {} }, env: overrides.env ?? { COMMERCE_STOREFRONT_PUBLIC_FOLDER_ID: FOLDER } });
  return { handler, context, response, calls, row, instances, accountability, schema };
}

async function run(state) { await state.handler(state.context, state.response); return state; }

test("site settings preserves identifier strings, nullable values and CAS response", async () => {
  const state = harness({ row: { inn: "0012345678", kpp: "000001001", vat_info: "без НДС" } });
  state.context.body = { expected: { id: ID, updated_at: state.row.updated_at, inn: "0012345678", kpp: "000001001", vat_info: "без НДС" }, changes: { inn: "0098765432", kpp: "000002002", vat_info: null } };
  await run(state);
  assert.equal(state.response.statusCode, 200);
  assert.equal(state.row.inn, "0098765432"); assert.equal(state.row.kpp, "000002002"); assert.equal(state.row.vat_info, null);
  assert.deepEqual(state.response.body.data, { id: ID, updated_at: state.row.updated_at, inn: "0098765432", kpp: "000002002", vat_info: null });
  const nullableVersion = harness({ row: { updated_at: null } }); nullableVersion.context.body.expected.updated_at = null; await run(nullableVersion);
  assert.equal(nullableVersion.response.statusCode, 200);
});

test("site settings rejects protected, unknown, JSON and nested relation mutations before writing", async () => {
  for (const changes of [{ messengers: {} }, { social_links: { telegram: "x" } }, { commerce_profile: {} }, { yandex_metrica_id: "x" }, { gtm_id: "x" }, { translations: [] }, { messenger: "x" }, { id: ID }, { logo: { id: FILE } }]) {
    const state = harness(); state.context.body = { expected: { id: ID, updated_at: state.row.updated_at, ...Object.fromEntries(Object.keys(changes).map(key => [key, state.row[key] ?? null])) }, changes };
    await run(state); assert.equal(state.response.statusCode, 400); assert.equal(state.calls.some(call => call[0] === "updateOne"), false);
  }
  for (const [field,value] of [["company_name","  "],["phone",17],["email",{}]]) {
    const state = harness(); state.context.body = { expected: { id: ID, updated_at: state.row.updated_at, [field]: state.row[field] }, changes: { [field]: value } };
    await run(state); assert.equal(state.response.statusCode, 400, field);
  }
});

test("site settings requires confirmed singleton schema, identity and version, and one matching row", async () => {
  for (const invalid of [
    { body: { expected: { company_name: "Company" }, changes: { company_name: "New" } } },
    { body: { expected: { id: ID, updated_at: null, company_name: "Company" }, changes: { company_name: "New" } }, schema: { collections: { site_settings: { collection: "site_settings", singleton: false, fields: {} } } } },
    { count: 0 }, { count: 2 },
  ]) {
    const state = harness(invalid); if (invalid.body) state.context.body = invalid.body;
    await run(state); assert.notEqual(state.response.statusCode, 200); assert.equal(state.calls.some(call => call[0] === "updateOne"), false);
  }
});

test("site settings rejects generated and alias fields from Directus internal schema", async () => {
  for (const [field, metadata] of [["company_name", { generated: true }], ["city", { alias: true }]]) {
    const schema = structuredClone(harness().schema);
    Object.assign(schema.collections.site_settings.fields[field], metadata);
    const blocked = harness({ schema }); blocked.context.body = { expected: { id: ID, updated_at: blocked.row.updated_at, [field]: blocked.row[field] }, changes: { [field]: "value" } };
    await run(blocked); assert.equal(blocked.response.statusCode, 400, field); assert.equal(blocked.calls.some(call => call[0] === "updateOne"), false);
  }
});

test("site settings preserves caller accountability and CAS conflict behavior", async () => {
  const state = harness({ readError: Object.assign(new Error("denied"), { code: "FORBIDDEN" }) });
  await run(state); assert.equal(state.response.statusCode, 403); assert.ok(state.instances.every(instance => instance.options.accountability === state.accountability));
  assert.equal(state.calls.some(call => call[0] === "raw"), false);
  const stale = harness(); stale.context.body.expected.company_name = "Stale"; await run(stale);
  assert.equal(stale.response.statusCode, 409); assert.equal(stale.calls.some(call => call[0] === "updateOne"), false);
});

test("site settings accepts a readable image in the configured public folder and explicit unlink", async () => {
  const linked = harness(); linked.context.body = { expected: { id: ID, updated_at: linked.row.updated_at, logo: null }, changes: { logo: FILE } }; await run(linked);
  assert.equal(linked.response.statusCode, 200); assert.equal(linked.row.logo, FILE);
  const unlinked = harness({ row: { logo: FILE }, file: { id: FILE, folder: "private", type: "application/pdf" } });
  unlinked.context.body = { expected: { id: ID, updated_at: unlinked.row.updated_at, logo: FILE }, changes: { logo: null } }; await run(unlinked);
  assert.equal(unlinked.response.statusCode, 200); assert.equal(unlinked.row.logo, null);
  assert.equal(unlinked.calls.some(call => call[0] === "deleteOne"), false);
});

test("site settings preserves an existing unreadable file relation when another field changes", async () => {
  const state = harness({ row: { logo: FILE }, fileError: Object.assign(new Error("unreadable"), { code: "FORBIDDEN" }) });
  state.context.body = { expected: { id: ID, updated_at: state.row.updated_at, company_name: state.row.company_name }, changes: { company_name: "Updated" } };
  await run(state); assert.equal(state.response.statusCode, 200); assert.equal(state.row.logo, FILE);
  assert.equal(state.calls.some(call => call[1] === "directus_files"), false);
});

test("site settings rejects malformed, private, nonimage and unreadable new file links", async () => {
  for (const [overrides,fileId] of [[{ file: { id: FILE, folder: "private", type: "image/png" } },FILE], [{ file: { id: FILE, folder: FOLDER, type: "application/pdf" } },FILE], [{ file: null },FILE], [{ env: {} },FILE], [{ fileError: Object.assign(new Error("denied"), { code: "FORBIDDEN" }) },FILE], [{ fileError: Object.assign(new Error("missing"), { code: "NOT_FOUND" }) },FILE],[{},"not-a-uuid"]]) {
    const state = harness(overrides); state.context.body = { expected: { id: ID, updated_at: state.row.updated_at, logo: null }, changes: { logo: fileId } }; await run(state);
    assert.notEqual(state.response.statusCode, 200); assert.equal(state.calls.some(call => call[0] === "updateOne"), false);
  }
});

test("site settings forbids deletes without affecting other collection mutation behavior", async () => {
  const state = harness(); state.context.body.action = "delete"; await run(state);
  assert.equal(state.response.statusCode, 400); assert.equal(state.calls.some(call => call[0] === "deleteOne"), false);
});
