import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const source = await readFile(resolve(root, "src/sections/home_page.js"), "utf8");
const stateUrl = pathToFileURL(resolve(root, "src/admin-state.mjs")).href;
const testSource = source
  .replace('import { useApi } from "@directus/extensions-sdk";', "const useApi = () => globalThis.__a2Api;")
  .replace('import { defineComponent, h, ref } from "vue";', `const ref = (value) => ({ value }); const defineComponent = (value) => value; const onMounted = (callback) => { globalThis.__a2OnMounted = callback; }; const h = (...args) => ({ type: args[0], props: args[1] && typeof args[1] === "object" && !Array.isArray(args[1]) ? args[1] : {}, children: args.length >= 3 ? args[2] : (Array.isArray(args[1]) || typeof args[1] === "string" ? args[1] : undefined) });`)
  .replace('import { useRouter } from "vue-router";', "const useRouter = () => ({ push: () => {} });")
  .replace('import { AdminShell, SectionTabs, EditorToolbar, NativeFieldGroup, MediaPicker, ReadonlyDetails } from "../admin-shell.js";', `const AdminShell = {}; export const SectionTabs = {}; export const EditorToolbar = {}; export const NativeFieldGroup = {}; const MediaPicker = {}; const ReadonlyDetails = {};`)
  .replace('import { PageSectionEditor } from "../page-sections.js";', "const PageSectionEditor = {};")
  .replace('import { createEditorState } from "../admin-state.mjs";', `import { createEditorState } from ${JSON.stringify(stateUrl)};`);
const module = await import(`data:text/javascript;base64,${Buffer.from(testSource).toString("base64")}`);

const { HOME_PAGE_FIELDS, HomePageSection, SectionTabs, EditorToolbar, NativeFieldGroup, createHomePageController, projectHomeReadonlyValues, validateHomePage } = module;
const response = (data) => ({ data: { data } });
const metadata = HOME_PAGE_FIELDS.map((field) => ({ field, type: field === "sections" ? "alias" : field === "is_indexable" ? "boolean" : ["hero_text", "seo_description", "canonical_url", "og_description"].includes(field) ? "text" : field === "hero_image" || field === "og_image" || field === "source_page" ? "uuid" : "string", schema: { is_nullable: !["h1", "hero_title", "hero_text", "hero_image", "hero_image_alt", "hero_search_label", "hero_search_placeholder", "hero_search_button_text", "hero_bulk_prompt", "hero_bulk_link_text", "hero_bulk_link_url", "hero_excel_link_text", "hero_excel_link_url", "hero_photo_link_text", "hero_photo_link_url"].includes(field) }, meta: { required: ["h1", "hero_title", "hero_text", "hero_image", "hero_image_alt", "hero_search_label", "hero_search_placeholder", "hero_search_button_text", "hero_bulk_prompt", "hero_bulk_link_text", "hero_bulk_link_url", "hero_excel_link_text", "hero_excel_link_url", "hero_photo_link_text", "hero_photo_link_url"].includes(field), interface: field === "hero_image" ? "file-image" : field === "og_image" ? "select-dropdown-m2o" : "input", readonly: field === "source_page" } }));
const homeRecord = (overrides = {}) => ({ ...Object.fromEntries(HOME_PAGE_FIELDS.filter((field) => field !== "sections").map((field) => [field, field === "id" ? "home-singleton" : field === "updated_at" ? null : field === "status" ? "published" : field === "source_page" ? "source-id" : field === "is_indexable" ? true : field === "seo" || field === "translations" ? {} : ""])),
  h1: "Synthetic H1", hero_title: "Synthetic hero", hero_text: "Synthetic hero description", hero_image: "asset-id", hero_image_alt: "Synthetic asset",
  hero_search_label: "Search", hero_search_placeholder: "Search here", hero_search_button_text: "Find", hero_bulk_prompt: "Send list", hero_bulk_link_text: "Upload list", hero_bulk_link_url: "/bulk", hero_excel_link_text: "Excel", hero_excel_link_url: "/excel", hero_photo_link_text: "Photos", hero_photo_link_url: "/photos", ...overrides });
const permit = (fields = ["*"]) => ({ access: fields.includes("*") ? "full" : "partial", fields });

function apiFor({ count = "1", record = homeRecord(), getRecord, read = ["*"], update = ["*"], readPermission, updatePermission, fileReadPermission, itemUpdate = true, onMutation } = {}) {
  const currentRecord = () => typeof getRecord === "function" ? getRecord() : record;
  const calls = [];
  const api = {
    async get(url, config = {}) {
      calls.push({ method: "GET", url, config });
      if (url === "/collections/home_page") return response({ collection: "home_page", meta: { singleton: true, versioning: true } });
      if (url === "/fields/home_page") return response(metadata);
      if (url === "/fields/page_sections") return response([]);
      if (url === "/permissions/me") return response({ home_page: { read: readPermission ?? permit(read), update: updatePermission ?? permit(update) }, page_sections: { read: permit(), update: permit() }, directus_files: { read: fileReadPermission ?? permit(), update: permit() } });
      if (url === `/permissions/me/home_page/${currentRecord().id}`) return response({ update: { access: itemUpdate }, delete: { access: true }, share: { access: true } });
      if (url === "/items/home_page" && config.params?.["aggregate[count]"] === "id") return response({ count: { id: count } });
      if (url === "/items/home_page") {
        const requested = config.params?.fields;
        const fields = Array.isArray(requested) ? requested : typeof requested === "string" ? requested.split(",") : Object.keys(currentRecord());
        return response(Object.fromEntries(fields.filter((field) => Object.hasOwn(currentRecord(), field)).map((field) => [field, currentRecord()[field]])));
      }
      if (url === "/items/page_sections") return { data: { data: [], meta: { filter_count: 0 } } };
      throw new Error(`Unexpected GET ${url}`);
    },
    async post(url, body) {
      calls.push({ method: "POST", url, body });
      if (onMutation) return onMutation(url, body, calls);
      throw new Error(`Unexpected POST ${url}`);
    },
  };
  return { api, calls };
}

test("opens the hero tab by default and retains edits when switching tabs", async () => {
  const { api } = apiFor();
  const controller = createHomePageController(api);
  const opened = await controller.open();
  assert.equal(opened.ok, true, opened.error?.message ?? controller.snapshot().blockedReason?.message);
  assert.equal(controller.snapshot().tab, "hero");
  assert.equal(controller.changeTab("hero", { hero_title: "Changed hero" }), true);
  assert.equal(controller.changeTab("search", { seo_title: "Changed SEO" }), true);
  assert.equal(controller.selectTab("search"), true);
  assert.equal(controller.snapshot().values.hero_title, "Changed hero");
  assert.equal(controller.snapshot().values.seo_title, "Changed SEO");
});

test("proves singleton cardinality before reading one object and fails closed for missing or ambiguous rows", async (t) => {
  for (const count of ["0", "2"]) await t.test(`count=${count}`, async () => {
    const { api, calls } = apiFor({ count });
    const controller = createHomePageController(api);
    assert.equal((await controller.open()).ok, false);
    assert.equal(controller.snapshot().readonly, true);
    assert.equal(calls.some(({ url, config }) => url === "/items/home_page" && !config.params?.["aggregate[count]"]), false);
  });
  const { api, calls } = apiFor();
  const controller = createHomePageController(api);
  await controller.open();
  const aggregate = calls.find(({ url, config }) => url === "/items/home_page" && config.params?.["aggregate[count]"] === "id");
  const singleton = calls.find(({ url, config }) => url === "/items/home_page" && !config.params?.["aggregate[count]"]);
  assert.ok(aggregate);
  assert.ok(singleton);
});

test("singleton status and source reference are readonly and permissions fail closed", async () => {
  const { api } = apiFor({ read: ["id", "updated_at", "source_page", "h1"], update: ["h1"] });
  const controller = createHomePageController(api);
  assert.equal((await controller.open()).ok, true);
  assert.equal(controller.snapshot().readonly, false);
  assert.equal(controller.change("status", "draft"), false);
  assert.equal(controller.change("source_page", "other"), false);
  assert.equal(controller.change("h1", "Updated heading"), true);
  const denied = createHomePageController(apiFor({ read: ["id", "updated_at", "h1"] }).api);
  assert.equal((await denied.open()).ok, false);
  assert.equal(denied.snapshot().readonly, true);
});

test("explicit item update denial leaves the readable singleton available in view mode", async () => {
  const { api } = apiFor({ itemUpdate: false });
  const controller = createHomePageController(api);
  assert.equal((await controller.open()).ok, true);
  assert.equal(controller.snapshot().values.id, "home-singleton");
  assert.equal(controller.snapshot().readonly, true);
  assert.equal(controller.change("hero_title", "No write"), false);
});

test('honors explicit field subsets even when effective access is reported as full', async () => {
  const { api, calls } = apiFor({
    readPermission: { access: "full", fields: ["id", "updated_at", "source_page", "h1"] },
    updatePermission: { access: "full", fields: ["h1"] },
  });
  const controller = createHomePageController(api);
  assert.equal((await controller.open()).ok, true);
  assert.equal(controller.snapshot().values.h1, "Synthetic H1");
  assert.equal(Object.hasOwn(controller.snapshot().values, "hero_title"), false);
  assert.equal(controller.change("hero_title", "Must remain unavailable"), false);
  assert.equal(controller.change("h1", "Allowed heading"), true);
  const request = calls.find(({ url, config }) => url === "/items/home_page" && config.params?.fields?.includes("h1"));
  assert.deepEqual(request.config.params.fields.split(",").sort(), ["h1", "id", "source_page", "updated_at"]);
});

test("fails closed for missing or malformed permission field lists and file-library read access", async (t) => {
  for (const permission of [{ access: "full" }, { access: "partial", fields: "hero_title" }, { access: "partial", fields: null }]) {
    await t.test(JSON.stringify(permission), async () => {
      const { api } = apiFor({ readPermission: permission });
      const controller = createHomePageController(api);
      assert.equal((await controller.open()).ok, false);
      assert.equal(controller.snapshot().readonly, true);
    });
  }

  for (const [permission, expected] of [[{ access: "full", fields: ["name"] }, false], [{ access: "none", fields: [] }, false], [{ access: "full", fields: ["*"] }, true]]) {
    await t.test(`file read=${JSON.stringify(permission)}`, async () => {
      const { api } = apiFor({ fileReadPermission: permission });
      const controller = createHomePageController(api);
      assert.equal((await controller.open()).ok, true);
      assert.equal(controller.snapshot().fileReadAccess, expected);
    });
  }
});

test("required fields hidden by read permissions do not block an allowed H1-only save", async () => {
  let written;
  const { api } = apiFor({ read: ["id","updated_at","source_page","h1"], update: ["h1"], onMutation: async (_url, body) => { written = body.changes; return response({ id: "home-singleton", updated_at: "v2", ...body.changes }); } });
  const controller = createHomePageController(api, { metadata });
  assert.equal((await controller.open()).ok, true);
  assert.equal(Object.hasOwn(controller.snapshot().values, "hero_title"), false);
  assert.equal(controller.change("h1", "Only readable heading"), true);
  assert.equal((await controller.save()).ok, true);
  assert.deepEqual(written, { h1: "Only readable heading" });
});

test("late singleton read from an older open cannot replace the newer record", async () => {
  let releaseFirst;
  let firstStarted = false;
  let fullReads = 0;
  const stale = homeRecord({ hero_title: "Old response" });
  const latest = homeRecord({ hero_title: "Newest response" });
  const { api } = apiFor({ record: latest });
  const get = api.get.bind(api);
  api.get = async (url, config = {}) => {
    if (url === "/items/home_page" && config.params?.fields?.includes("hero_title")) {
      fullReads++;
      if (fullReads === 1) { firstStarted = true; return await new Promise((resolve) => { releaseFirst = resolve; }); }
      return response(latest);
    }
    return get(url, config);
  };
  const controller = createHomePageController(api);
  const oldOpen = controller.open();
  for (let i = 0; i < 5 && !firstStarted; i++) await new Promise((resolveTick) => setTimeout(resolveTick, 0));
  assert.equal(firstStarted, true);
  assert.equal((await controller.open()).ok, true);
  releaseFirst(response(stale));
  assert.equal((await oldOpen).stale, true);
  assert.equal(controller.snapshot().values.hero_title, "Newest response");
});

test("parent save sends only dirty editable deltas and refetches hook projections", async () => {
  let current = homeRecord({ seo_title: "Before", seo: { title: "Before" } });
  let mutationPayload;
  const { api, calls } = apiFor({ getRecord: () => current, onMutation: async (url, body) => {
    mutationPayload = { url, body };
    current = { ...current, ...body.changes, updated_at: "v2", seo_title: "Hook projection", seo: { title: "Hook projection" } };
    return response({ id: current.id, updated_at: current.updated_at, ...body.changes });
  } });
  const controller = createHomePageController(api);
  await controller.open();
  assert.equal(controller.change("hero_title", "New hero"), true);
  assert.equal(controller.change("seo_title", "Submitted SEO"), true);
  assert.equal(controller.change("status", "draft"), false);
  const result = await controller.save();
  assert.equal(result.ok, true);
  assert.equal(mutationPayload.url, "/commerce/mutations/home_page/home-singleton");
  assert.deepEqual(Object.keys(mutationPayload.body.changes).sort(), ["hero_title", "seo_title"]);
  assert.equal(mutationPayload.body.expected.updated_at, null);
  assert.equal(Object.hasOwn(mutationPayload.body.changes, "status"), false);
  assert.equal(Object.hasOwn(mutationPayload.body.changes, "sections"), false);
  assert.equal(controller.snapshot().values.seo_title, "Hook projection");
  assert.equal(controller.snapshot().values.seo.title, "Hook projection");
  assert.equal(calls.filter(({ url, config }) => url === "/items/home_page" && !config.params?.["aggregate[count]"]).length >= 2, true);
});

test("409 retains edits, blocks repeat writes, and requires an explicit reconciliation", async () => {
  let current = homeRecord({ hero_title: "Current" });
  let writes = 0;
  const { api } = apiFor({ getRecord: () => current, onMutation: async () => { writes++; throw Object.assign(new Error("conflict"), { status: 409 }); } });
  const controller = createHomePageController(api);
  await controller.open();
  assert.equal(controller.change("hero_title", "My edit"), true);
  assert.equal((await controller.save()).ok, false);
  assert.equal(controller.snapshot().values.hero_title, "My edit");
  assert.equal((await controller.save()).ok, false);
  assert.equal(writes, 1);
  assert.equal((await controller.compare()).ok, true);
  current = { ...current, hero_title: "Remote change", updated_at: "v3" };
  assert.equal((await controller.reconcile({ keepEdits: true })).ok, true);
  assert.equal(controller.snapshot().values.hero_title, "My edit");
  assert.equal(controller.snapshot().baseline.hero_title, "Remote change");
});

test("renders one conflict panel after a definite parent 409", async () => {
  const { api } = apiFor({ onMutation: async () => { throw Object.assign(new Error("conflict"), { status: 409 }); } });
  globalThis.__a2Api = api;
  const render = HomePageSection.setup();
  globalThis.__a2OnMounted?.();
  const nextTick = () => new Promise((resolveTick) => setImmediate(resolveTick));
  let shell;
  for (let attempt = 0; attempt < 10; attempt++) {
    await nextTick();
    shell = render();
    const tabNode = shell.children.main().find((node) => node?.props?.modelValue === "hero");
    if (tabNode) break;
  }
  const mainContent = shell.children.main();
  const tabs = mainContent.find((node) => node?.props?.modelValue === "hero");
  assert.ok(tabs);
  const heroPanel = tabs.children.default().find((node) => node?.props?.class === "home-page-tab home-page-tab--hero");
  const findNode = (node, predicate) => Array.isArray(node) ? node.map((child) => findNode(child, predicate)).find(Boolean)
    : node && typeof node === "object" ? predicate(node) ? node : findNode(node.children, predicate) : null;
  const nativeGroup = findNode(heroPanel, (node) => Array.isArray(node.props?.fieldSubset) && node.props.fieldSubset.includes("hero_title"));
  assert.ok(nativeGroup);
  nativeGroup.props["onUpdate:modelValue"]({ ...homeRecord(), hero_title: "Local edit" });
  await shell.children.toolbar().props.onSave();

  shell = render();
  const conflictSlot = shell.children.conflict();
  const countConflictPanels = (node) => Array.isArray(node) ? node.reduce((count, child) => count + countConflictPanels(child), 0)
    : node && typeof node === "object" ? (node.props?.class === "home-page-conflict" ? 1 : 0) + countConflictPanels(node.children) : 0;
  assert.equal(countConflictPanels(conflictSlot), 1);
  assert.equal(countConflictPanels(shell.children.main()), 0);
  assert.equal(conflictSlot.children[0].children[0].children, "Запись изменилась в другом окне");
  delete globalThis.__a2Api;
  delete globalThis.__a2OnMounted;
});

test("malformed acknowledgement blocks a second write until explicit reconciliation", async () => {
  let writes = 0;
  const { api } = apiFor({ onMutation: async () => { writes++; return response({ id: "home-singleton", updated_at: "v2" }); } });
  const controller = createHomePageController(api);
  await controller.open();
  controller.change("hero_title", "New heading");
  assert.equal((await controller.save()).ok, false);
  assert.equal(controller.snapshot().writeUncertain, true);
  assert.equal((await controller.save()).ok, false);
  assert.equal(writes, 1);
  assert.equal((await controller.reconcile({ keepEdits: true })).ok, true);
});

test("committed save with failed projection refetch stays blocked and reports committed state", async () => {
  let committed = false;
  const { api } = apiFor({ onMutation: async (_url, body) => { committed = true; return response({ id: "home-singleton", updated_at: "v2", ...body.changes }); } });
  const get = api.get.bind(api);
  api.get = async (url, config) => {
    if (committed && url === "/items/home_page" && config.params?.fields?.includes("seo_title")) throw new Error("projection unavailable");
    return get(url, config);
  };
  const controller = createHomePageController(api);
  await controller.open();
  controller.change("seo_title", "New SEO title");
  const result = await controller.save();
  assert.equal(result.ok, false);
  assert.equal(result.committed, true);
  assert.equal(result.reason, "refetch");
  assert.ok(controller.snapshot().blockedReason);
});

test("required content and unsafe destinations are rejected before mutation", async () => {
  assert.ok(validateHomePage({ ...homeRecord(), hero_title: "  " }, metadata).some(({ field }) => field === "hero_title"));
  assert.ok(validateHomePage({ ...homeRecord(), hero_primary_button_url: "javascript:alert(1)" }, metadata).some(({ field }) => field === "hero_primary_button_url"));
  assert.deepEqual(validateHomePage(homeRecord({ hero_primary_button_url: "/catalog" }), metadata), []);
});

test("A2 parent contract accepts only live-consumer fields and preserves SEO projection data on readback", async () => {
  const unknownSeo = { title: "Before", meta_description: "Old", custom: { keep: true }, additional_fields: { canonical_url: "/old", untouched: 7 } };
  let current = homeRecord({ seo: unknownSeo, seo_title: "Before", seo_description: "Old", canonical_url: "/old" });
  let sent;
  const { api } = apiFor({ getRecord: () => current, onMutation: async (_url, body) => {
    sent = body.changes;
    current = { ...current, ...body.changes, updated_at: "v2", seo: { ...unknownSeo, title: body.changes.seo_title, meta_description: body.changes.seo_description, additional_fields: { ...unknownSeo.additional_fields, canonical_url: body.changes.canonical_url } } };
    return response({ id: current.id, updated_at: current.updated_at, ...body.changes });
  } });
  const controller = createHomePageController(api);
  assert.equal((await controller.open()).ok, true);
  for (const field of ["hero_search_label", "hero_bulk_prompt", "hero_bulk_link_text", "hero_bulk_link_url", "hero_excel_link_text", "hero_photo_link_url", "og_title", "og_description", "og_image", "seo", "translations"]) {
    assert.equal(controller.change(field, "Should stay readonly"), false, `${field} must not become editable`);
  }
  assert.equal(controller.change("seo_title", "New title"), true);
  assert.equal(controller.change("canonical_url", "/new"), true);
  assert.equal((await controller.save()).ok, true);
  assert.deepEqual(Object.keys(sent).sort(), ["canonical_url", "seo_title"]);
  assert.deepEqual(controller.snapshot().values.seo.custom, { keep: true });
  assert.equal(controller.snapshot().values.seo.additional_fields.untouched, 7);
  assert.equal(controller.snapshot().values.seo.additional_fields.canonical_url, "/new");
});

test("configured Open Graph image is shown as file state and remains outside the save payload", async () => {
  const fileId = "private-og-image-file-uuid";
  const record = homeRecord({ og_image: fileId });
  const displayValues = projectHomeReadonlyValues(record, ["og_image"]);
  assert.deepEqual(displayValues, { og_image: "Файл выбран" });
  assert.equal(record.og_image, fileId);
  assert.equal(projectHomeReadonlyValues({ og_image: null }, ["og_image"]).og_image, null);
  assert.equal(projectHomeReadonlyValues({ og_image: "" }, ["og_image"]).og_image, "");

  let sent;
  const { api } = apiFor({ record, onMutation: async (_url, body) => { sent = body.changes; return response({ id: record.id, updated_at: "v2", ...body.changes }); } });
  const controller = createHomePageController(api);
  assert.equal((await controller.open()).ok, true);
  assert.equal(controller.snapshot().baseline.og_image, fileId);
  assert.equal(controller.change("hero_title", "Updated title"), true);
  assert.equal((await controller.save()).ok, true);
  assert.deepEqual(sent, { hero_title: "Updated title" });
  assert.equal(controller.snapshot().baseline.og_image, fileId);
  assert.equal(projectHomeReadonlyValues(controller.snapshot().baseline, ["og_image"]).og_image, "Файл выбран");
});

test("parent reconciliation retains parent edits and reports independent child dirty state", async () => {
  const { api } = apiFor();
  const controller = createHomePageController(api);
  await controller.open();
  controller.change("hero_title", "Keep parent draft");
  controller.childState({ dirty: true, saving: false });
  assert.equal((await controller.reconcile({ keepEdits: true })).ok, true);
  assert.equal(controller.snapshot().values.hero_title, "Keep parent draft");
  assert.equal(controller.snapshot().parentDirty, true);
  assert.equal(controller.snapshot().childDirty, true);
  assert.equal(controller.snapshot().dirty, true);
});

test("native validation failure points to its owning tab without clearing another tab's draft", async () => {
  let writes = 0;
  const { api } = apiFor({ onMutation: async () => { writes++; throw new Error("unexpected write"); } });
  const controller = createHomePageController(api);
  await controller.open();
  controller.change("hero_title", "Draft heading");
  controller.change("canonical_url", "javascript:bad");
  const result = await controller.save();
  assert.equal(result.reason, "validation");
  assert.deepEqual(result.errors.map(({ field }) => field), ["canonical_url"]);
  assert.equal(controller.snapshot().values.hero_title, "Draft heading");
  assert.equal(controller.snapshot().values.canonical_url, "javascript:bad");
  assert.equal(writes, 0);
});

test("required but readonly legacy fields do not block a permitted parent change", async () => {
  const staleLegacy = homeRecord({ hero_search_label: "", hero_bulk_prompt: "", hero_bulk_link_text: "", hero_bulk_link_url: "", hero_excel_link_text: "", hero_excel_link_url: "", hero_photo_link_text: "", hero_photo_link_url: "", hero_primary_button_url: "javascript:legacy" });
  let written;
  const { api } = apiFor({ record: staleLegacy, read: ["*"], update: ["hero_title"], onMutation: async (_url, body) => { written = body.changes; return response({ id: "home-singleton", updated_at: "v2", ...body.changes }); } });
  const controller = createHomePageController(api, { metadata });
  assert.equal((await controller.open()).ok, true);
  assert.equal(controller.change("hero_title", "A permitted update"), true);
  assert.equal((await controller.save()).ok, true);
  assert.deepEqual(written, { hero_title: "A permitted update" });
  assert.equal(controller.snapshot().values.hero_bulk_prompt, "");
  assert.equal(controller.snapshot().values.hero_search_label, "");
  assert.equal(controller.snapshot().values.hero_primary_button_url, "javascript:legacy");
});

test("home view routes validation to its owning tab and retains the invalid value", async () => {
  globalThis.__a2Api = apiFor().api;
  const render = HomePageSection.setup();
  globalThis.__a2OnMounted?.();
  const walk = (node, predicate, result = []) => {
    if (!node) return result;
    if (Array.isArray(node)) node.forEach((child) => walk(child, predicate, result));
    else if (typeof node === "object") { if (predicate(node)) result.push(node); walk(node.children, predicate, result); }
    return result;
  };
  let tree;
  let tabs;
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise((resolveTick) => setImmediate(resolveTick));
    tree = render().children.main();
    tabs = walk(tree, (node) => node.type === SectionTabs)[0];
    if (tabs) break;
  }
  assert.ok(tabs);
  assert.equal(tabs.props.modelValue, "hero");
  assert.equal(walk(tree, (node) => node.type === NativeFieldGroup).some((node) => node.props.fieldSubset.includes("source_page")), false);
  tabs.props["onUpdate:modelValue"]("search");
  tree = render().children.main();
  tabs = walk(tree, (node) => node.type === SectionTabs)[0];
  let panels = tabs.children.default();
  const seoNative = walk(panels, (node) => node.type === NativeFieldGroup && node.props.fieldSubset.includes("canonical_url"))[0];
  assert.ok(seoNative);
  seoNative.props["onUpdate:modelValue"]({ canonical_url: "javascript:bad" });
  await walk(render().children.toolbar(), (node) => node.type === EditorToolbar)[0].props.onSave();
  tree = render().children.main();
  tabs = walk(tree, (node) => node.type === SectionTabs)[0];
  assert.equal(tabs.props.modelValue, "search");
  panels = tabs.children.default();
  const searchPanel = walk(panels, (node) => node.props?.class === "home-page-tab home-page-tab--search")[0];
  assert.ok(walk(searchPanel, (node) => node.type === NativeFieldGroup && node.props.validationErrors.some(({ field }) => field === "canonical_url")).length);
  delete globalThis.__a2Api;
  delete globalThis.__a2OnMounted;
});
