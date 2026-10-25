import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const source = await readFile(resolve(root, "src/sections/site_settings.js"), "utf8");
const stateUrl = pathToFileURL(resolve(root, "src/admin-state.mjs")).href;
const harness = source
  .replace('import { useApi } from "@directus/extensions-sdk";', "const useApi = () => globalThis.__a5Api;")
  .replace('import { defineComponent, h, onMounted, onUnmounted, ref, resolveComponent } from "vue";', `const ref = (value) => ({ value }); const defineComponent = (value) => value; const onMounted = (callback) => { globalThis.__a5OnMounted = callback; }; const onUnmounted = () => {}; const resolveComponent = () => "component"; const h = (...args) => ({ type: args[0], props: args[1] && typeof args[1] === "object" && !Array.isArray(args[1]) ? args[1] : {}, children: args.length >= 3 ? args[2] : (Array.isArray(args[1]) || typeof args[1] === "string" ? args[1] : undefined) });`)
  .replace('import { createEditorState } from "../admin-state.mjs";', `import { createEditorState } from ${JSON.stringify(stateUrl)};`)
  .replace('import { AdminShell, SectionTabs, EditorToolbar, NativeFieldGroup, MediaPicker, ReadonlyDetails } from "../admin-shell.js";', "const AdminShell = {}; const SectionTabs = {}; const EditorToolbar = {}; const NativeFieldGroup = {}; const MediaPicker = {}; const ReadonlyDetails = {};");
const module = await import(`data:text/javascript;base64,${Buffer.from(harness).toString("base64")}`);
const { createSiteSettingsController, createSiteSettingsState, isConfirmedSingleton, isRecordIdentity, siteSettingsFields, SiteSettingsSection, toNativeImageMetadata, validateSiteSettings } = module;

test("singleton is confirmed only by an unfiltered full-read count of exactly one", () => {
  assert.equal(isConfirmedSingleton({ count: { id: 1 }, fullRead: true }), true);
  for (const proof of [
    { count: { id: 0 }, fullRead: true }, { count: { id: 2 }, fullRead: true },
    { count: { id: 1 }, fullRead: false }, { count: 1, fullRead: true },
    { count: [{ id: 1 }], fullRead: true }, { count: { id: "2" }, fullRead: true },
  ]) assert.equal(isConfirmedSingleton(proof), false);
});

test("record acceptance requires a plain object with exact identity and version", () => {
  assert.equal(isRecordIdentity({ id: "main", updated_at: "2026-01-01" }, "main"), true);
  for (const value of [null, [], { id: "other", updated_at: "x" }, { id: "main" }]) assert.equal(isRecordIdentity(value, "main"), false);
});

test("A0 state excludes protected/raw fields and remains fail-closed without field contract", async () => {
  const state = createSiteSettingsState({ permissions: { read: true, update: true } });
  const result = await state.load(async () => ({ id: "main", updated_at: "v1", company_name: "Shop", commerce_profile: { secret: "hidden" }, yandex_metrica_id: "raw" }), "main", { count: { id: 1 }, fullRead: true });
  assert.equal(result.ok, true);
  assert.equal(state.change("company_name", "Changed"), false);
  assert.equal(state.dirty, false);
  assert.equal(state.change("messengers", [{ url: "https://example.test" }]), false);
  assert.deepEqual(state.payload(), null);
  assert.equal(state.canSave, false);
  assert.equal(siteSettingsFields.includes("commerce_profile"), false);
  assert.equal(siteSettingsFields.includes("yandex_metrica_id"), false);
});

test("full singleton read permission and cardinality proof are mandatory", async () => {
  const partial = createSiteSettingsState({ permissions: { read: ["id", "updated_at", "company_name"], update: true } });
  const denied = await partial.load(async () => ({}), "main", { count: { id: 1 }, fullRead: false });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, "singleton");
  const multiple = createSiteSettingsState({ permissions: { read: true, update: true } });
  const rejected = await multiple.load(async () => ({}), "main", { count: { id: 2 }, fullRead: true });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "singleton");
});

const fileNames = new Set(["logo", "favicon", "company_image", "default_og_image"]);
const siteFields = [...siteSettingsFields, "messengers", "social_links"].map((field) => ({ field, type: fileNames.has(field) ? "uuid" : "string", schema: { is_nullable: !["company_name", "phone", "email"].includes(field) }, meta: { ...(fileNames.has(field) ? { special: ["m2o"] } : {}), interface: fileNames.has(field) && ["logo", "favicon"].includes(field) ? "file-image" : fileNames.has(field) ? "select-dropdown-m2o" : "input", required: ["company_name", "phone", "email"].includes(field) } }));
const siteRecord = (overrides = {}) => ({ id: "primary", updated_at: "v1", company_name: "Example", inn: "001234567890", kpp: "001234567", ogrn: "0012345678901", phone: "+7 900 000-00-00", email: "team@example.test", city: "Москва", requisites_url: "/requisites", primary_cta_url: "/contact", logo: null, favicon: null, company_image: null, default_og_image: null, messengers: [], social_links: {}, ...overrides });
const permit = (fields, access = fields.includes("*") ? "full" : "partial") => ({ access, fields });
function siteApi({ record = siteRecord(), count = "1", read = ["*"], update = ["*"], readAccess, fileRead = ["*"], itemUpdate = true, post, onRead, metadata = siteFields } = {}) {
  let current = record; const calls = [];
  const api = {
    async get(url, config = {}) {
      calls.push({ method: "GET", url, config });
      if (url === "/collections/site_settings") return { data: { data: { collection: "site_settings", meta: { singleton: true } } } };
      if (url === "/fields/site_settings") return { data: { data: metadata } };
      if (url === "/permissions/me") return { data: { data: { site_settings: { read: readAccess ?? permit(read), update: permit(update) }, directus_files: { read: permit(fileRead) } } } };
      if (url.startsWith("/files/")) return { data: { data: { id: decodeURIComponent(url.split("/").at(-1)), filename_download: "synthetic.png", type: "image/png", filesize: 12, folder: "public", storage: "local" } } };
      if (url === "/items/site_settings" && config.params?.["aggregate[count]"] === "id") return { data: { data: { count: { id: count } } } };
      if (url === "/items/site_settings") {
        if (onRead) await onRead();
        const fields = config.params?.fields?.split(",") ?? [];
        assert.equal(fields.includes("commerce_profile"), false);
        assert.equal(fields.includes("yandex_metrica_id"), false);
        return { data: { data: Object.fromEntries(fields.filter((field) => Object.hasOwn(current, field)).map((field) => [field, current[field]])) } };
      }
      if (url === `/permissions/me/site_settings/${current.id}`) return { data: { data: { update: { access: itemUpdate } } } };
      throw new Error(`Unexpected GET ${url}`);
    },
    async post(url, payload) {
      calls.push({ method: "POST", url, payload });
      if (post) { const value = await post(url, payload, { current, replace: (next) => { current = next; } }); return { data: { data: value } }; }
      current = { ...current, ...payload.changes, updated_at: "v2" };
      return { data: { data: current } };
    },
    replace(next) { current = next; }, calls, current: () => current,
  };
  return api;
}

test("controller opens native string cardinality and accepts full row read with restricted fields", async () => {
  const api = siteApi({ read: ["id", "updated_at", "company_name"], update: ["company_name"], readAccess: permit(["id", "updated_at", "company_name"], "full") });
  const controller = createSiteSettingsController(api);
  const opened = await controller.open(); assert.equal(opened.ok, true, opened.error);
  assert.equal(controller.snapshot().fullRead, true);
  assert.equal(controller.snapshot().values.company_name, "Example");
  assert.deepEqual(controller.snapshot().dirtyFields, []);
  assert.equal(controller.change("company_name", "Blocked until contract"), false);
});

test("partial row access, missing identity permission and item update denial fail closed", async () => {
  const partial = createSiteSettingsController(siteApi({ read: ["id", "updated_at", "company_name"], update: ["company_name"], readAccess: permit(["id", "updated_at", "company_name"], "partial") }));
  assert.equal((await partial.open()).ok, false);
  assert.equal(partial.snapshot().canSave, false);
  const missing = createSiteSettingsController(siteApi({ read: ["company_name"], update: ["company_name"] }));
  assert.equal((await missing.open()).ok, false);
  const denied = createSiteSettingsController(siteApi({ itemUpdate: false }));
  const opened = await denied.open(); assert.equal(opened.ok, true, opened.error);
  assert.equal(denied.snapshot().itemUpdate, false);
  assert.equal(denied.change("company_name", "No"), false);
});

test("controller rejects zero, multiple, malformed and filtered cardinality before reading record", async () => {
  for (const count of ["0", "2", "1x"]) {
    const api = siteApi({ count }); const controller = createSiteSettingsController(api);
    assert.equal((await controller.open()).ok, false);
    assert.equal(api.calls.some((entry) => entry.url === "/items/site_settings" && !entry.config.params?.["aggregate[count]"]), false);
  }
  const filtered = createSiteSettingsController(siteApi({ readAccess: permit(["id", "updated_at", "company_name"], "partial") }));
  assert.equal((await filtered.open()).ok, false);
});

test("one draft survives group changes and quick-edit dismissal; metadata readonly and required validation apply", async () => {
  const controller = createSiteSettingsController(siteApi(), { guardedContract: true });
  await controller.open();
  assert.equal(controller.change("company_name", "New name"), true);
  controller.changeGroup("contacts"); controller.toggleQuick("phone"); controller.toggleQuick("phone");
  assert.equal(controller.snapshot().values.company_name, "New name");
  assert.equal(controller.change("social_links", "raw"), false);
  assert.ok(controller.validate().length === 0);
  assert.ok(validateSiteSettings({ company_name: "", email: "bad", primary_cta_url: "javascript:alert(1)" }, siteFields).length >= 3);
  assert.equal(controller.metadata.find((field) => field.field === "company_name").name, "Название компании");
  assert.deepEqual(controller.snapshot().dirtyFields, ["company_name"]);
});

test("metadata hidden, readonly and generated fields cannot enter a draft", async () => {
  const metadata = siteFields.map((item) => item.field === "company_name" ? { ...item, meta: { ...item.meta, readonly: true } } : item.field === "phone" ? { ...item, meta: { ...item.meta, hidden: true } } : item.field === "email" ? { ...item, schema: { ...item.schema, is_generated: true } } : item);
  const controller = createSiteSettingsController(siteApi({ metadata }), { guardedContract: true });
  await controller.open();
  assert.equal(controller.change("company_name", "Blocked"), false);
  assert.equal(controller.change("phone", "Blocked"), false);
  assert.equal(controller.change("email", "blocked@example.test"), false);
  assert.equal(controller.snapshot().dirty, false);
});

test("missing field permission cannot stage that field and a retry cannot replace a dirty draft", async () => {
  const api = siteApi({ readAccess: { access: "full", fields: ["id", "updated_at", "phone"] }, update: ["phone"] });
  const controller = createSiteSettingsController(api, { guardedContract: true });
  await controller.open();
  assert.equal(Object.hasOwn(controller.snapshot().values, "company_name"), false);
  assert.equal(controller.change("company_name", "Unverified"), false);
  assert.equal(controller.snapshot().dirty, false);

  assert.equal(controller.change("phone", "+7 900 111-22-33"), true);
  const before = api.calls.length;
  assert.deepEqual(await controller.open(), { ok: false, reason: "dirty" });
  assert.equal(api.calls.length, before);
  assert.equal(controller.snapshot().values.phone, "+7 900 111-22-33");
  assert.equal(controller.snapshot().baseline.phone, "+7 900 000-00-00");
  assert.deepEqual(Object.keys(controller.snapshot().baseline).includes("company_name"), false);
});

test("guarded save posts only changed values and confirms with a fresh read", async () => {
  const api = siteApi(); const controller = createSiteSettingsController(api, { guardedContract: true });
  await controller.open(); controller.change("company_name", "Updated");
  assert.equal(controller.snapshot().canSave, true);
  const saved = await controller.save();
  assert.equal(saved.ok, true);
  const call = api.calls.find((entry) => entry.method === "POST");
  assert.equal(call.url, "/commerce/mutations/site_settings/primary");
  assert.deepEqual(Object.keys(call.payload.changes), ["company_name"]);
  assert.equal(call.payload.expected.updated_at, "v1");
  assert.equal(controller.snapshot().values.company_name, "Updated");
  assert.equal(controller.snapshot().dirty, false);
});

test("409 keeps the original baseline and draft until explicit resolution, then never saves automatically", async () => {
  let remote = siteRecord({ company_name: "Coworker", updated_at: "v2", city: "Казань" });
  const api = siteApi({ post: async (_url, _body, ctx) => { ctx.replace(remote); const error = new Error("conflict"); error.status = 409; throw error; } });
  const controller = createSiteSettingsController(api, { guardedContract: true });
  await controller.open(); controller.change("company_name", "Mine");
  const result = await controller.save();
  assert.equal(result.conflict, true);
  assert.equal(controller.snapshot().baseline.company_name, "Example");
  assert.equal(controller.snapshot().canSave, false);
  assert.equal(controller.snapshot().comparison.company_name.saved, "Coworker");
  assert.equal(controller.snapshot().values.company_name, "Mine");
  assert.equal(controller.snapshot().values.city, "Москва");
  const posts = api.calls.filter((entry) => entry.method === "POST").length;
  await controller.resolveConflict("mine");
  assert.equal(controller.snapshot().values.city, "Казань");
  assert.equal(api.calls.filter((entry) => entry.method === "POST").length, posts);
  assert.equal(controller.snapshot().dirty, true);
  assert.equal(controller.snapshot().conflict, false);
  assert.equal(controller.snapshot().canSave, true);
  assert.equal(controller.snapshot().baseline.company_name, "Coworker");
});

test("lost acknowledgement is reconciled as committed or left for explicit conflict handling", async () => {
  const api = siteApi({ post: async (_url, payload, ctx) => { ctx.replace({ ...ctx.current, ...payload.changes, updated_at: "v2" }); throw new Error("connection lost"); } });
  const controller = createSiteSettingsController(api, { guardedContract: true });
  await controller.open(); controller.change("company_name", "Committed");
  assert.equal((await controller.save()).ok, false);
  assert.equal(controller.snapshot().writeUncertain, true);
  const checked = await controller.checkResult();
  assert.equal(checked.committed, true);
  assert.equal(controller.snapshot().dirty, false);
  assert.equal(controller.snapshot().lastResult, "verified-saved");
});

test("uncertain-save confirmation adopts the same checked version even if another write follows", async () => {
  const committed = siteRecord({ company_name: "Committed", updated_at: "v2" });
  const later = siteRecord({ company_name: "Later write", updated_at: "v3" });
  let checking = false; let firstCheckRead = true; let api;
  api = siteApi({ post: async () => { throw new Error("connection lost"); }, onRead: async () => {
    if (!checking) return;
    if (firstCheckRead) { firstCheckRead = false; api.replace(committed); }
    else api.replace(later);
  } });
  const controller = createSiteSettingsController(api, { guardedContract: true });
  await controller.open(); controller.change("company_name", "Committed");
  await controller.save(); checking = true;
  const checked = await controller.checkResult();
  assert.equal(checked.committed, true);
  assert.equal(controller.snapshot().baseline.company_name, "Committed");
  assert.equal(controller.snapshot().baseline.updated_at, "v2");
  assert.equal(controller.snapshot().values.company_name, "Committed");
  assert.equal(controller.snapshot().dirty, false);
});

test("malformed acknowledgement preserves input and save notifications expose async transitions", async () => {
  let unblock; const observed = [];
  const api = siteApi({ post: async () => new Promise((resolve) => { unblock = resolve; }) });
  const controller = createSiteSettingsController(api, { guardedContract: true, onSnapshot: (snapshot) => observed.push(snapshot.saving) });
  await controller.open(); controller.change("company_name", "Draft");
  const pending = controller.save(); await new Promise((resolve) => setImmediate(resolve));
  assert.equal(controller.snapshot().saving, true);
  const second = await controller.save(); assert.equal(second.reason, "unavailable");
  unblock({ id: "wrong", updated_at: "v2", company_name: "Draft" });
  assert.equal((await pending).ok, false);
  assert.equal(controller.snapshot().values.company_name, "Draft");
  assert.ok(observed.includes(true)); assert.equal(controller.snapshot().saving, false);
});

test("uncertain result mismatch does not rebase baseline before explicit conflict resolution", async () => {
  const api = siteApi({ post: async () => { throw new Error("connection lost"); } });
  const controller = createSiteSettingsController(api, { guardedContract: true });
  await controller.open(); controller.change("company_name", "Mine");
  await controller.save();
  api.replace(siteRecord({ company_name: "Coworker", updated_at: "v2" }));
  const checked = await controller.checkResult();
  assert.equal(checked.committed, false);
  assert.equal(controller.snapshot().baseline.company_name, "Example");
  assert.equal(controller.snapshot().values.company_name, "Mine");
  assert.equal(controller.snapshot().comparison.company_name.saved, "Coworker");
  assert.equal(controller.snapshot().canSave, false);
  await controller.resolveConflict("saved");
  assert.equal(controller.snapshot().baseline.company_name, "Coworker");
  assert.equal(controller.snapshot().dirty, false);
});

test("explicit cancel rereads baseline and discards a draft without a mutation request", async () => {
  const api = siteApi(); const controller = createSiteSettingsController(api, { guardedContract: true });
  await controller.open(); controller.change("company_name", "Draft");
  const cancelled = await controller.cancel();
  assert.equal(cancelled.ok, true);
  assert.equal(controller.snapshot().values.company_name, "Example");
  assert.equal(controller.snapshot().dirty, false);
  assert.equal(api.calls.some((entry) => entry.method === "POST"), false);
});

test("save surfaces required, email and URL errors before any request", async () => {
  const api = siteApi(); const controller = createSiteSettingsController(api, { guardedContract: true });
  await controller.open();
  controller.change("company_name", ""); controller.change("email", "bad"); controller.change("primary_cta_url", "javascript:alert(1)");
  const result = await controller.save();
  assert.equal(result.reason, "validation");
  assert.deepEqual(new Set(result.errors.map((item) => item.field)), new Set(["company_name", "email", "primary_cta_url"]));
  assert.equal(api.calls.some((entry) => entry.method === "POST"), false);
  assert.equal(controller.snapshot().validationErrors.length, 3);
});

test("the editable contract is exactly the 29 guarded fields and file relations remain selectable", async () => {
  assert.equal(siteSettingsFields.length, 29);
  assert.equal(siteSettingsFields.includes("messengers"), false);
  assert.equal(siteSettingsFields.includes("social_links"), false);
  const fileFields = new Set(["logo", "favicon", "company_image", "default_og_image"]);
  const metadata = siteFields.map((item) => fileFields.has(item.field)
    ? { ...item, type: "uuid", meta: { ...item.meta, special: ["m2o"], interface: item.field === "logo" || item.field === "favicon" ? "file-image" : "select-dropdown-m2o" } }
    : item);
  const controller = createSiteSettingsController(siteApi({ metadata }), { guardedContract: true });
  assert.equal((await controller.open()).ok, true);
  for (const field of fileFields) assert.equal(controller.change(field, `asset-${field}`), true, field);
  assert.deepEqual(new Set(controller.snapshot().dirtyFields), fileFields);
});

test("incomplete field metadata blocks the singleton editor before it can accept changes", async () => {
  const api = siteApi({ metadata: siteFields.filter((item) => item.field !== "footer_text") });
  const controller = createSiteSettingsController(api, { guardedContract: true });
  const result = await controller.open();
  assert.equal(result.ok, false);
  assert.equal(controller.snapshot().canSave, false);
  assert.equal(controller.change("company_name", "Blocked"), false);
});

test("native image metadata adapter preserves Directus schema and changes only the local interface", () => {
  const field = { field: "company_image", type: "uuid", schema: { foreign_key_table: "directus_files" }, meta: { special: ["m2o"], interface: "select-dropdown-m2o", options: { placeholder: "Файл" }, conditions: [{ rule: true }] } };
  assert.deepEqual(module.toNativeImageMetadata(field), {
    ...field,
    meta: { ...field.meta, interface: "file-image" },
  });
});

test("mixed tab edits send a dirty-only snapshot and leave protected JSON untouched", async () => {
  const original = siteRecord({ inn: "001234567890", commerce_profile: { private: "preserve" }, translations: { ru: { title: "keep" } }, messengers: [{ label: "чат", url: "/chat", custom: "keep" }] });
  const api = siteApi({ record: original });
  const controller = createSiteSettingsController(api, { guardedContract: true });
  assert.equal((await controller.open()).ok, true);
  assert.equal(controller.change("inn", "009876543210"), true);
  controller.changeGroup("contacts");
  assert.equal(controller.change("phone", "+7 900 123-45-67"), true);
  assert.deepEqual(new Set(controller.snapshot().dirtyFields), new Set(["inn", "phone"]));
  const saved = await controller.save();
  assert.equal(saved.ok, true);
  const mutation = api.calls.find((call) => call.method === "POST");
  assert.deepEqual(mutation.payload.changes, { inn: "009876543210", phone: "+7 900 123-45-67" });
  assert.deepEqual(mutation.payload.expected, { id: "primary", updated_at: "v1", inn: "001234567890", phone: "+7 900 000-00-00" });
  assert.deepEqual(api.current().commerce_profile, original.commerce_profile);
  assert.deepEqual(api.current().translations, original.translations);
  assert.deepEqual(api.current().messengers, original.messengers);
});

test("file selection stays readonly without Directus file-read permission", async () => {
  const controller = createSiteSettingsController(siteApi({ fileRead: [] }), { guardedContract: true });
  assert.equal((await controller.open()).ok, true);
  assert.equal(controller.change("logo", "asset-id"), false);
  assert.equal(controller.change("company_name", "Allowed scalar"), true);
});

test("file labels are read by id and a late singleton load cannot replace a newer response", async () => {
  const base = siteApi({ record: siteRecord({ logo: "logo-id" }) });
  let unblock; let collectionReads = 0;
  const api = { ...base, async get(url, config) {
    if (url === "/collections/site_settings" && ++collectionReads === 1) return new Promise((resolve) => { unblock = () => resolve({ data: { data: { collection: "site_settings", meta: { singleton: true } } } }); });
    return base.get(url, config);
  } };
  const controller = createSiteSettingsController(api, { guardedContract: true });
  const stale = controller.open();
  await new Promise((resolve) => setImmediate(resolve));
  const fresh = await controller.open();
  assert.equal(fresh.ok, true, fresh.error);
  assert.equal(controller.snapshot().fileDetails.logo.name, "synthetic.png");
  unblock();
  assert.equal((await stale).stale, true);
  assert.equal(controller.snapshot().identity, "primary");
});

test("rendered file fields use native pickers with the local adapter and no identifier input", async () => {
  globalThis.__a5Api = siteApi({ record: siteRecord({ logo: "logo-id", favicon: "favicon-id", company_image: "company-image-id", default_og_image: "og-id" }) });
  const component = SiteSettingsSection.setup({ guardedContract: true }, {});
  await globalThis.__a5OnMounted();
  const find = (node, predicate, found = []) => {
    if (node == null) return found;
    if (Array.isArray(node)) { for (const child of node) find(child, predicate, found); return found; }
    if (typeof node !== "object") return found;
    if (predicate(node)) found.push(node);
    find(node.children, predicate, found);
    return found;
  };
  const sectionTabs = () => find(component().children.default(), (node) => Array.isArray(node.props?.tabs))[0];
  sectionTabs().props["onUpdate:modelValue"]("appearance");
  let picks = find(sectionTabs().children.default(), (node) => Boolean(node.props?.field?.field));
  assert.deepEqual(new Set(picks.map((node) => node.props.field.field)), new Set(["logo", "favicon", "company_image"]));
  for (const pick of picks) {
    assert.equal(pick.props.field.meta.interface, "file-image");
    assert.equal(pick.props.allowSelect, true);
    assert.equal(pick.props.allowUpload, false);
    assert.equal(pick.props.readonly, false);
  }
  sectionTabs().props["onUpdate:modelValue"]("search");
  picks = find(sectionTabs().children.default(), (node) => Boolean(node.props?.field?.field));
  assert.deepEqual(picks.map((node) => node.props.field.field), ["default_og_image"]);
  const systemDetails = find(component().children.default(), (node) => Array.isArray(node.props?.fields) && node.props.fields.some((field) => field.field === "updated_at"));
  assert.ok(systemDetails.every((node) => node.props.fields.every((field) => field.field !== "id")));
});

test("native reset omission restores baseline while other tab edits stay in the shared draft", async () => {
  globalThis.__a5Api = siteApi();
  const render = SiteSettingsSection.setup({ guardedContract: true }, {});
  await globalThis.__a5OnMounted();
  const find = (node, predicate, found = []) => {
    if (node == null) return found;
    if (Array.isArray(node)) { for (const child of node) find(child, predicate, found); return found; }
    if (typeof node !== "object") return found;
    if (predicate(node)) found.push(node);
    find(node.children, predicate, found);
    return found;
  };
  const tabs = () => find(render().children.default(), (node) => Array.isArray(node.props?.tabs))[0];
  tabs().props["onUpdate:modelValue"]("company");
  let form = find(tabs().children.default(), (node) => node.props?.fieldSubset?.includes("inn"))[0];
  form.props["onUpdate:modelValue"]({ inn: "000123" });
  tabs().props["onUpdate:modelValue"]("contacts");
  form = find(tabs().children.default(), (node) => node.props?.fieldSubset?.includes("phone"))[0];
  form.props["onUpdate:modelValue"]({ email: "changed@example.test" });
  const dirtyValues = render().props.state.values;
  assert.equal(dirtyValues.inn, "000123");
  assert.equal(dirtyValues.phone, "+7 900 000-00-00");
  assert.equal(dirtyValues.email, "changed@example.test");
});



test("validation focuses the Directus native field attribute after selecting its tab", async () => {
  globalThis.__a5Api = siteApi();
  const render = SiteSettingsSection.setup({ guardedContract: true }, {});
  await globalThis.__a5OnMounted();
  const find = (node, predicate, found = []) => {
    if (node == null) return found;
    if (Array.isArray(node)) { for (const child of node) find(child, predicate, found); return found; }
    if (typeof node !== "object") return found;
    if (predicate(node)) found.push(node);
    find(node.children, predicate, found);
    return found;
  };
  const content = render().children.default();
  const tabset = find(content, (node) => Array.isArray(node.props?.tabs))[0];
  tabset.props["onUpdate:modelValue"]("company");
  const form = find(tabset.children.default(), (node) => node.props?.fieldSubset?.includes("company_name"))[0];
  form.props["onUpdate:modelValue"]({ company_name: "" });
  assert.equal(render().props.state.values.company_name, "");
  assert.equal(render().props.state.dirty, true);
  let selector; let focused = false;
  globalThis.document = { querySelector(value) { selector = value; return value === '[field="company_name"]' ? { matches: () => true, focus: () => { focused = true; } } : null; } };
  globalThis.requestAnimationFrame = (callback) => callback();
  const toolbar = find(render().children.default(), (node) => typeof node.props?.onSave === "function")[0];
  const result = await toolbar.props.onSave();
  assert.equal(result.reason, "validation");
  assert.equal(render().props.state.group, "company");
  assert.equal(selector, '[field="company_name"]');
  assert.equal(focused, true);
  delete globalThis.document;
  delete globalThis.requestAnimationFrame;
});


test("a newly selected file is resolved through Directus files metadata and remains selectable after save", async () => {
  const api = siteApi();
  const controller = createSiteSettingsController(api, { guardedContract: true });
  assert.equal((await controller.open()).ok, true);
  assert.equal(controller.change("logo", "new-file-id"), true);
  assert.equal(controller.snapshot().fileDetails.logo?.status, "checking");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(controller.snapshot().fileDetails.logo, { status: "readable", name: "synthetic.png" });
  assert.equal(api.calls.some((call) => call.url === "/files/new-file-id"), true);
  const result = await controller.save();
  assert.equal(result.ok, true);
  assert.deepEqual(controller.snapshot().fileDetails.logo, { status: "readable", name: "synthetic.png" });
  assert.equal(api.calls.filter((call) => call.url === "/files/new-file-id").length, 2);
});


test("known conflicts show comparison without uncertain-save controls; unknown saves keep one wired check action", async () => {
  const find = (node, predicate, found = []) => {
    if (node == null) return found;
    if (Array.isArray(node)) { for (const child of node) find(child, predicate, found); return found; }
    if (typeof node !== "object") return found;
    if (predicate(node)) found.push(node);
    find(node.children, predicate, found);
    return found;
  };
  const openAndEdit = async (api) => {
    globalThis.__a5Api = api;
    const render = SiteSettingsSection.setup({ guardedContract: true }, {});
    await globalThis.__a5OnMounted();
    const tree = () => render().children.default();
    const tabs = find(tree(), (node) => Array.isArray(node.props?.tabs))[0];
    tabs.props["onUpdate:modelValue"]("company");
    const form = find(tabs.children.default(), (node) => node.props?.fieldSubset?.includes("company_name"))[0];
    form.props["onUpdate:modelValue"]({ company_name: "Mine" });
    const toolbar = () => find(tree(), (node) => typeof node.props?.onSave === "function")[0];
    await toolbar().props.onSave();
    return { render, tree, toolbar };
  };
  let remote = siteRecord({ company_name: "Coworker", updated_at: "v2" });
  const conflictApi = siteApi({ post: async (_url, _body, ctx) => { ctx.replace(remote); const error = new Error("conflict"); error.status = 409; throw error; } });
  const known = await openAndEdit(conflictApi);
  assert.equal(known.render().props.state.conflict, true);
  assert.equal(known.toolbar().props.state.writeUncertain, false);
  assert.equal(known.toolbar().props.state.saveError, null);
  assert.equal(find(known.tree(), (node) => node.props?.class === "a5__uncertain").length, 0);

  const unknownApi = siteApi({ post: async () => { throw new Error("connection lost"); } });
  const unknown = await openAndEdit(unknownApi);
  assert.equal(unknown.render().props.state.conflict, false);
  assert.equal(unknown.toolbar().props.state.writeUncertain, true);
  assert.equal(find(unknown.tree(), (node) => node.props?.class === "a5__uncertain").length, 0);
  assert.equal(typeof unknown.toolbar().props.onReconcile, "function");
  const posts = unknownApi.calls.filter((call) => call.method === "POST").length;
  await unknown.toolbar().props.onReconcile({ action: "verify" });
  assert.equal(unknownApi.calls.filter((call) => call.method === "POST").length, posts);
});
