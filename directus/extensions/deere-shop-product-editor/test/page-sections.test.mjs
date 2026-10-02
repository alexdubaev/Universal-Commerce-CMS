import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = await readFile(resolve(root, "src/page-sections.js"), "utf8");
const stateUrl = pathToFileURL(resolve(root, "src/admin-state.mjs")).href;
const testSource = source
  .replace('import { computed, defineComponent, h, onBeforeUnmount, ref, watch } from "vue";', `const computed = (get) => ({ get value() { return typeof get === "function" ? get() : get.get(); } }); const ref = (value) => ({ value }); const defineComponent = (value) => value; const h = (...args) => ({ type: args[0], props: args[1] && typeof args[1] === "object" && !Array.isArray(args[1]) ? args[1] : {}, children: args.length >= 3 ? args[2] : (Array.isArray(args[1]) || typeof args[1] === "string" ? args[1] : undefined) }); const onBeforeUnmount = () => {}; const watch = (getter, callback, options) => { if (options?.immediate) callback(getter()); };`)
  .replace('import { createEditorState } from "./admin-state.mjs";', `import { createEditorState } from ${JSON.stringify(stateUrl)};`)
  .replace('import { NativeFieldGroup, SectionTabs, EditorToolbar, ReadonlyDetails } from "./admin-shell.js";', "export const NativeFieldGroup = {}; export const SectionTabs = {}; export const EditorToolbar = {}; export const ReadonlyDetails = {};");
const { createPageSectionController, PageSectionEditor, NativeFieldGroup, SectionTabs, EditorToolbar } = await import(`data:text/javascript;base64,${Buffer.from(testSource).toString("base64")}`);

const permissions = { read: true, update: true };
const record = (id, page = 7, title = `Title ${id}`, updated_at = `v${id}`) => ({
  id, updated_at, page, home_page: null, status: "published", section_type: "text", title,
  subtitle: "", text: "", image: null, image_alt: "", button_text: "", button_url: "",
  items: [], settings: {}, is_visible: true, sort_order: id, translations: {},
});
const response = (value) => ({ data: { data: value } });
const listResponse = (rows, total = rows.length) => ({ data: { data: rows, meta: { filter_count: total } } });
const setup = (api, overrides = {}) => createPageSectionController({ parentCollection: "pages", parentId: 7,
  editableFields: ["title", "text", "items", "settings"], permissions, guardedContract: true, readonly: false, api, ...overrides });

test("lists with bounded fields, page size, stable sort, and both owner constraints", async () => {
  let options;
  const controller = setup({ get: async (_url, config) => { options = config; return listResponse([record(1)], 51); } });
  const result = await controller.list(2);
  assert.equal(result.ok, true);
  assert.equal(options.params.limit, 25);
  assert.equal(options.params.page, 2);
  assert.deepEqual(options.params.sort, ["sort_order", "id"]);
  assert.deepEqual(options.params.fields.slice(0, 4), ["id", "updated_at", "page", "home_page"]);
  assert.deepEqual(options.params.filter._and, [{ page: { _eq: 7 } }, { home_page: { _null: true } }]);
  assert.equal(controller.snapshot.total, 51);
});

test("requires permission to read identity and both owners before any request", async () => {
  let calls = 0;
  const controller = setup({ get: async () => { calls++; } }, { permissions: { read: ["title", "updated_at", "id", "page"], update: true } });
  const result = await controller.list();
  assert.equal(result.reason, "permission");
  assert.equal(calls, 0);
  assert.equal(controller.snapshot.canWrite, false);
});

test("rechecks required read permissions when they arrive after controller creation", async () => {
  let currentPermissions = { read: ["id", "updated_at", "page"], update: true };
  const controller = createPageSectionController({ parentCollection: "pages", parentId: 7,
    editableFields: ["title"], get permissions() { return currentPermissions; }, guardedContract: true, readonly: false,
    api: { get: async () => listResponse([record(1)]) } });
  assert.equal((await controller.list()).reason, "permission");
  currentPermissions = { read: true, update: true };
  assert.equal((await controller.list()).ok, true);
});

test("rejects a list containing a row owned by another parent and disables writes", async () => {
  const controller = setup({ get: async () => listResponse([record(1, 99)]) });
  const result = await controller.list();
  assert.equal(result.ok, false);
  assert.equal(controller.snapshot.listValid, false);
  assert.equal(controller.snapshot.rows.length, 0);
  assert.equal(controller.snapshot.canWrite, false);
});

test("keeps each child baseline and edit cache independent while saving one row", async () => {
  const records = new Map([["1", record(1)], ["2", record(2)]]);
  const controller = setup({
    get: async (url) => url === "/items/page_sections" ? listResponse([...records.values()]) : response(records.get(url.split("/").at(-1))),
    post: async (url, payload) => {
      const id = url.split("/").at(-1); const current = records.get(id);
      assert.deepEqual(payload.expected, { id: current.id, updated_at: current.updated_at, title: current.title });
      const saved = { ...current, ...payload.changes, updated_at: `${current.updated_at}+` };
      records.set(id, saved); return response({ id: saved.id, updated_at: saved.updated_at, ...payload.changes });
    },
  });
  await controller.list();
  await controller.select(1);
  controller.change(1, "title", "Edited one");
  await controller.select(2);
  controller.change(2, "text", "Edited two");
  assert.equal(controller.dirty, true);
  assert.equal(await controller.setParent("pages", 8), false);
  await controller.select(1);
  const saved = await controller.save(1);
  assert.equal(saved.ok, true);
  assert.equal(controller.getRow(1).dirty, false);
  assert.equal(controller.getRow(1).baseline.title, "Edited one");
  assert.equal(controller.getRow(2).dirty, true);
  assert.equal(controller.getRow(2).baseline.text, "");
});

test("parent navigation stays blocked while a child save is in flight, even after discard is requested", async () => {
  let acknowledge;
  const current = record(1);
  const controller = setup({ get: async (url) => url === "/items/page_sections" ? listResponse([current]) : response(current),
    post: () => new Promise((resolve) => { acknowledge = resolve; }) });
  await controller.list(); await controller.select(1); controller.change(1, "title", "Saving");
  const pendingSave = controller.save(1);
  assert.equal(controller.getRow(1).saving, true);
  assert.equal(controller.setParent("pages", 8, { discardEdits: true }), false);
  assert.equal(controller.parentId, 7);
  acknowledge(response({ id: 1, updated_at: "v2", title: "Saving" }));
  assert.equal((await pendingSave).ok, true);
});

test("suppresses a saved callback if the requested parent changes during a child save", async () => {
  let requestedParent = { collection: "pages", id: 7 };
  let acknowledge;
  let savedEvents = 0;
  const current = record(1);
  const controller = createPageSectionController({ parentCollection: "pages", parentId: 7, editableFields: ["title"],
    permissions, guardedContract: true, readonly: false, getParent: () => requestedParent,
    onSaved: () => { savedEvents++; }, api: {
      get: async (url) => url === "/items/page_sections" ? listResponse([current]) : response(current),
      post: () => new Promise((resolve) => { acknowledge = resolve; }),
    } });
  await controller.list(); await controller.select(1); controller.change(1, "title", "Saved old parent");
  const pendingSave = controller.save(1);
  requestedParent = { collection: "pages", id: 8 };
  acknowledge(response({ id: 1, updated_at: "v2", title: "Saved old parent" }));
  assert.deepEqual(await pendingSave, { ok: false, stale: true });
  assert.equal(savedEvents, 0);
  assert.equal(controller.snapshot.saving, false);
});

test("failed list read blocks writes and does not drop edited row values", async () => {
  let fail = false;
  const current = record(1);
  const controller = setup({ get: async (url) => {
    if (url === "/items/page_sections") { if (fail) throw new Error("offline"); return listResponse([current]); }
    return response(current);
  }, post: async () => { throw new Error("must not write"); } });
  await controller.list(); await controller.select(1); controller.change(1, "title", "Keep me");
  fail = true;
  assert.equal((await controller.list()).ok, false);
  assert.equal(controller.snapshot.canWrite, false);
  assert.equal(controller.getRow(1).values.title, "Keep me");
});

test("denies writes without the guarded contract, update permission, or editable mode", async (t) => {
  for (const overrides of [
    { guardedContract: false }, { permissions: { read: true, update: [] } }, { readonly: true },
  ]) await t.test(JSON.stringify(overrides), async () => {
    let writes = 0;
    const current = record(1);
    const controller = setup({ get: async (url) => url === "/items/page_sections" ? listResponse([current]) : response(current),
      post: async () => { writes++; } }, overrides);
    await controller.list(); await controller.select(1); controller.change(1, "title", "No write");
    assert.equal(controller.snapshot.canWrite, false);
    assert.equal((await controller.save(1)).ok, false);
    assert.equal(writes, 0);
  });
});

test("field update permission is checked per change even when another field is writable", async () => {
  const current = record(1);
  const controller = setup({ get: async (url) => url === "/items/page_sections" ? listResponse([current]) : response(current),
    post: async () => { throw new Error("must not write"); } }, { permissions: { read: true, update: ["text"] } });
  await controller.list(); await controller.select(1);
  assert.equal(controller.snapshot.canWrite, true);
  assert.equal(controller.change(1, "title", "Denied"), false);
  assert.equal(controller.getRow(1).dirty, false);
});

test("generated Directus fields stay locked in the section controller and state machine", async () => {
  let writes = 0;
  const current = record(1);
  const controller = setup({ get: async (url) => url === "/items/page_sections" ? listResponse([current]) : response(current),
    post: async () => { writes++; return response(current); } }, { metadata: { title: { schema: { is_generated: true } } } });
  await controller.list(); await controller.select(1);
  assert.equal(controller.change(1, "title", "No write"), false);
  assert.equal(controller.changeTab(1, ["title"], { title: "No write" }), false);
  assert.equal((await controller.save(1)).ok, false);
  assert.equal(writes, 0);
});

test("row save eligibility follows replacement permission objects after render", async () => {
  let currentPermissions = { read: true, update: true };
  const current = record(1);
  const controller = createPageSectionController({ parentCollection: "pages", parentId: 7,
    editableFields: ["title", "text"], get permissions() { return currentPermissions; }, guardedContract: true, readonly: false,
    api: { get: async (url) => url === "/items/page_sections" ? listResponse([current]) : response(current),
      post: async () => response({ id: 1, updated_at: "v2", title: "Locally changed" }) } });
  await controller.list(); await controller.select(1); controller.change(1, "title", "Locally changed");
  currentPermissions = { read: ["id", "updated_at", "page", "home_page", "title", "text"], update: ["text"] };
  assert.equal(controller.getRow(1).canSave, false);
  assert.equal((await controller.save(1)).reason, "unavailable");
  currentPermissions = { read: true, update: true };
  assert.equal(controller.getRow(1).canSave, true);
  assert.equal((await controller.save(1)).ok, true);
});

test("preserves inputs after 409 and requires comparison followed by explicit reconcile", async () => {
  let remote = record(1);
  const controller = setup({ get: async (url) => url === "/items/page_sections" ? listResponse([record(1)]) : response(remote),
    post: async () => { const error = new Error("conflict"); error.status = 409; throw error; } });
  await controller.list(); await controller.select(1); controller.change(1, "title", "My edit");
  const result = await controller.save(1);
  assert.equal(result.ok, false);
  assert.equal(controller.getRow(1).values.title, "My edit");
  assert.equal(controller.getRow(1).conflict, true);
  remote = { ...remote, title: "Remote title", updated_at: "v2" };
  assert.equal((await controller.compare(1)).ok, true);
  assert.equal(controller.snapshot.comparison.remote.title, "Remote title");
  assert.equal((await controller.reconcile(1, { keepEdits: true })).ok, true);
  assert.equal(controller.getRow(1).values.title, "My edit");
  assert.equal(controller.getRow(1).baseline.title, "Remote title");
  assert.equal(controller.getRow(1).conflict, false);
});

test("ignores late list response after parent changes", async () => {
  let release;
  const pending = new Promise((resolveRequest) => { release = resolveRequest; });
  const controller = setup({ get: () => pending });
  const first = controller.list();
  assert.equal(controller.setParent("pages", 8), true);
  release(listResponse([record(1, 7)]));
  assert.equal((await first).stale, true);
  assert.equal(controller.snapshot.rows.length, 0);
  assert.equal(controller.parentId, 8);
});

test("cached row selection clears another row's stale detail loading state", async () => {
  let releaseDetail;
  const pendingDetail = new Promise((resolve) => { releaseDetail = resolve; });
  const controller = setup({ get: async (url) => url === "/items/page_sections"
    ? listResponse([record(1), record(2)]) : url.endsWith("/1") ? pendingDetail : response(record(2)) });
  await controller.list();
  await controller.select(2);
  const pendingFirst = controller.select(1);
  assert.equal(controller.snapshot.selectedLoading, true);
  await controller.select(2);
  assert.equal(controller.snapshot.selectedId, 2);
  assert.equal(controller.snapshot.selectedLoading, false);
  releaseDetail(response(record(1)));
  assert.equal((await pendingFirst).stale, true);
  assert.equal(controller.snapshot.selectedId, 2);
  assert.equal(controller.snapshot.selectedLoading, false);
});

test("changing parent clears selected detail loading while the old read is pending", async () => {
  let releaseDetail;
  const pendingDetail = new Promise((resolve) => { releaseDetail = resolve; });
  const controller = setup({ get: async (url) => url === "/items/page_sections"
    ? listResponse([record(1)]) : pendingDetail });
  await controller.list();
  const pendingSelection = controller.select(1);
  assert.equal(controller.snapshot.selectedLoading, true);
  assert.equal(controller.setParent("pages", 8), true);
  assert.equal(controller.snapshot.selectedLoading, false);
  releaseDetail(response(record(1)));
  assert.equal((await pendingSelection).stale, true);
  assert.equal(controller.snapshot.selectedLoading, false);
});

test("retries ownership failure without overwriting selected edits", async () => {
  let bad = false;
  const current = record(1);
  const controller = setup({ get: async (url) => {
    if (url === "/items/page_sections") return listResponse([current]);
    return response(bad ? { ...current, home_page: 9 } : current);
  } });
  await controller.list(); await controller.select(1); controller.change(1, "title", "Keep");
  bad = true;
  assert.equal((await controller.reconcile(1, { keepEdits: false })).ok, false);
  assert.equal(controller.getRow(1).values.title, "Keep");
});

test("exports a Vue component with the shell event contract", () => {
  assert.equal(PageSectionEditor.name, "PageSectionEditor");
  assert.deepEqual(PageSectionEditor.emits, ["dirty-change", "saved", "error", "navigation-blocked", "state-change"]);
});

test("renders native shell controls with row state and locks fields while a detail read is pending", async () => {
  let releaseDetail;
  let acknowledgeSave;
  const detail = new Promise((resolveDetail) => { releaseDetail = resolveDetail; });
  const current = record(1);
  const api = { get: (url, config) => url === "/items/page_sections"
    ? Promise.resolve(config.params.page === 2 ? listResponse([]) : listResponse([current], 26)) : detail,
    post: () => new Promise((resolveSave) => { acknowledgeSave = resolveSave; }) };
  const props = { parentCollection: "pages", parentId: 7, metadata: {}, editableFields: ["title"], permissions,
    guardedContract: true, readonly: false, api };
  const emitted = [];
  const render = PageSectionEditor.setup(props, { emit: (...event) => emitted.push(event) });
  await new Promise((resolveTick) => setTimeout(resolveTick, 0));
  const walk = (node, predicate, result = []) => {
    if (!node) return result;
    if (Array.isArray(node)) node.forEach((child) => walk(child, predicate, result));
    else if (typeof node === "object") {
      if (predicate(node)) result.push(node);
      walk(node.children, predicate, result);
    }
    return result;
  };
  const rowButton = walk(render(), (node) => node.type === "button" && node.props["aria-pressed"] === false)[0];
  assert.ok(rowButton);
  const selection = rowButton.props.onClick();
  const pendingTree = render();
  const native = walk(pendingTree, (node) => node.type === NativeFieldGroup)[0];
  const toolbar = walk(pendingTree, (node) => node.type === EditorToolbar)[0];
  assert.equal(native.props.disabled, true);
  assert.ok(Array.isArray(native.props.validationErrors));
  assert.equal(toolbar.props.state.loading, true);
  releaseDetail(response(current));
  await selection;
  const loadedToolbar = walk(render(), (node) => node.type === EditorToolbar)[0];
  assert.equal(typeof loadedToolbar.props.state.save, "function");
  const loadedNative = walk(render(), (node) => node.type === NativeFieldGroup)[0];
  loadedNative.props["onUpdate:modelValue"]({ title: "Edited" });
  const saving = loadedToolbar.props.onSave();
  assert.ok(emitted.some(([name, value]) => name === "state-change" && value.dirty && value.saving));
  const nextButton = walk(render(), (node) => node.type === "button" && node.children === "Next")[0];
  assert.ok(nextButton);
  nextButton.props.onClick();
  await new Promise((resolveTick) => setTimeout(resolveTick, 0));
  assert.ok(emitted.some(([name, value]) => name === "state-change" && value.saving));
  acknowledgeSave(response({ id: 1, updated_at: "v2", title: "Edited" }));
  await saving;
  assert.ok(emitted.some(([name, value]) => name === "state-change" && !value.dirty && !value.saving));
  assert.ok(emitted.some(([name]) => name === "dirty-change"));
});

test("readonly users can switch readable tabs while native fields stay readonly", async () => {
  const current = record(1);
  const props = { parentCollection: "pages", parentId: 7, metadata: {
    title: { name: "Title", meta: { group: "content" } }, text: { name: "Text", meta: { group: "details" } },
  }, editableFields: ["title", "text"], permissions: { read: true, update: false },
    guardedContract: false, readonly: true,
    api: { get: async (url) => url === "/items/page_sections" ? listResponse([current]) : response(current) } };
  const render = PageSectionEditor.setup(props, { emit: () => {} });
  await new Promise((resolveTick) => setTimeout(resolveTick, 0));
  const walk = (node, predicate, result = []) => {
    if (!node) return result;
    if (Array.isArray(node)) node.forEach((child) => walk(child, predicate, result));
    else if (typeof node === "object") {
      if (predicate(node)) result.push(node);
      walk(node.children, predicate, result);
    }
    return result;
  };
  const rowButton = walk(render(), (node) => node.type === "button" && node.props["aria-pressed"] === false)[0];
  await rowButton.props.onClick();
  const tabs = walk(render(), (node) => node.type === SectionTabs)[0];
  const native = walk(render(), (node) => node.type === NativeFieldGroup)[0];
  assert.equal(tabs.props.disabled, false);
  assert.equal(native.props.disabled, true);
});

test("PageSectionEditor ignores a delayed native event after switching tabs", async () => {
  const current = record(1);
  const props = { parentCollection: "pages", parentId: 7, metadata: {
    title: { name: "Title", meta: { group: "content" } }, text: { name: "Text", meta: { group: "details" } },
  }, editableFields: ["title", "text"], permissions, guardedContract: true, readonly: false,
    api: { get: async (url) => url === "/items/page_sections" ? listResponse([current]) : response(current) } };
  const render = PageSectionEditor.setup(props, { emit: () => {} });
  const walk = (node, predicate, result = []) => {
    if (!node) return result;
    if (Array.isArray(node)) node.forEach((child) => walk(child, predicate, result));
    else if (typeof node === "object") { if (predicate(node)) result.push(node); walk(node.children, predicate, result); }
    return result;
  };
  await new Promise((resolveTick) => setTimeout(resolveTick, 0));
  await walk(render(), (node) => node.type === "button" && node.props["aria-pressed"] === false)[0].props.onClick();
  const firstTabTree = render();
  const oldNative = walk(firstTabTree, (node) => node.type === NativeFieldGroup)[0];
  const tabs = walk(firstTabTree, (node) => node.type === SectionTabs)[0];
  assert.equal(oldNative.props.fieldSubset[0], "title");
  tabs.props["onUpdate:modelValue"]("details");
  const detailsNative = walk(render(), (node) => node.type === NativeFieldGroup)[0];
  detailsNative.props["onUpdate:modelValue"]({ text: "Edited in details" });
  oldNative.props["onUpdate:modelValue"]({ title: "Late old tab value" });
  const afterLateEvent = walk(render(), (node) => node.type === NativeFieldGroup)[0];
  assert.deepEqual(afterLateEvent.props.modelValue, { text: "Edited in details" });
});

test("keeps native fields disabled after a child read fails", async () => {
  const current = record(1);
  const api = { get: async (url) => url === "/items/page_sections" ? listResponse([current]) : Promise.reject(new Error("offline")) };
  const props = { parentCollection: "pages", parentId: 7, metadata: {}, editableFields: ["title"], permissions,
    guardedContract: true, readonly: false, api };
  const render = PageSectionEditor.setup(props, { emit: () => {} });
  await new Promise((resolveTick) => setTimeout(resolveTick, 0));
  const walk = (node, predicate, result = []) => {
    if (!node) return result;
    if (Array.isArray(node)) node.forEach((child) => walk(child, predicate, result));
    else if (typeof node === "object") {
      if (predicate(node)) result.push(node);
      walk(node.children, predicate, result);
    }
    return result;
  };
  const rowButton = walk(render(), (node) => node.type === "button" && node.props["aria-pressed"] === false)[0];
  await rowButton.props.onClick();
  const native = walk(render(), (node) => node.type === NativeFieldGroup)[0];
  assert.equal(native.props.disabled, true);
});
