import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createEditorState } from "../src/admin-state.mjs";

const record = (id = "p1", version = "v1", extra = {}) => ({ id, updated_at: version, title: "Before", price: 4, seo: "SEO", ...extra });
const config = (extra = {}) => ({
  collection: "products", editableFields: ["title", "price", "seo"],
  permissions: { read: true, update: true }, guardedContract: true, ...extra,
});
const loaderFor = (value) => async (id, fields) => {
  assert.ok(fields.includes("id") && fields.includes("updated_at"));
  return typeof value === "function" ? value(id, fields) : value;
};
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const load = (state, value = record()) => state.load(loaderFor(value), value.id ?? "p1");

test("loads a detached immutable baseline and returns detached snapshots", async () => {
  const original = record();
  const state = createEditorState(config());
  assert.equal((await load(state, original)).ok, true);
  original.title = "mutated source";
  const snapshot = state.baseline;
  snapshot.title = "mutated snapshot";
  assert.equal(state.baseline.title, "Before");
  assert.equal(state.values.title, "Before");
  assert.equal(state.canWrite("title"), true);
});

test("tab edits retain other tabs and omitted fields restore baseline values", async () => {
  const state = createEditorState(config());
  await load(state);
  assert.equal(state.changeTab(["title", "price"], { title: "Edited", price: 7 }), true);
  assert.equal(state.changeTab(["title"], {}), true);
  assert.equal(state.values.price, 7);
  assert.equal(state.changeTab(["price"], {}), true);
  assert.deepEqual(state.values, record());
  assert.equal(state.dirty, false);
});

test("undefined edits never become omitted wire changes", async () => {
  const state = createEditorState(config());
  await load(state);
  assert.equal(state.change("title", undefined), false);
  assert.equal(state.change("title", null), true);
  assert.deepEqual(state.payload().changes, { title: null });

  assert.equal(state.changeTab(["title"], { title: "Edited" }), true);
  assert.equal(state.changeTab(["title"], { title: undefined }), true);
  assert.equal(state.values.title, "Before");
  assert.equal(state.dirty, false);

  state.change("title", "After");
  let received;
  const result = await state.save(async (_collection, _id, request) => {
    received = JSON.parse(JSON.stringify(request));
    return record("p1", "v2", { title: "After" });
  });
  assert.equal(result.ok, true);
  assert.deepEqual(received.changes, { title: "After" });
});

test("tab updates reject unauthorized changes without partial mutation", async () => {
  const state = createEditorState(config({ permissions: { read: true, update: ["title"] } }));
  await load(state);
  assert.equal(state.changeTab(["title", "price"], { title: "Edited", price: 8 }), false);
  assert.deepEqual(state.values, record());
});

test("payload contains only dirty changes and their original expected values", async () => {
  const state = createEditorState(config());
  await load(state);
  state.change("title", "After");
  assert.deepEqual(state.payload(), {
    expected: { id: "p1", updated_at: "v1", title: "Before" },
    changes: { title: "After" },
  });
});

test("system, alias, readonly, generated, and layout fields cannot be edited", async () => {
  const state = createEditorState(config({
    editableFields: ["title", "id", "updated_at", "computed", "locked", "generated", "group_main"],
    fieldMetadata: {
      computed: { type: "alias" }, locked: { meta: { readonly: true } },
      generated: { schema: { is_generated: true } },
      group_main: { meta: { interface: "group-detail" } },
    },
  }));
  await load(state, record("p1", "v1", { computed: "x", locked: "y", generated: "z", group_main: "z" }));
  for (const field of ["id", "updated_at", "computed", "locked", "generated", "group_main"]) assert.equal(state.canWrite(field), false);
  assert.equal(state.change("computed", "changed"), false);
  assert.equal(state.change("generated", "changed"), false);
});

test("missing baseline fields cannot be changed", async () => {
  const state = createEditorState(config());
  await load(state, { id: "p1", updated_at: "v1", title: "Before" });
  assert.equal(state.change("price", 8), false);
});

test("read failure disables writes and a failed cross-record load clears the old baseline", async () => {
  const state = createEditorState(config());
  await load(state);
  const failedRead = await state.load(async () => { throw new Error("offline"); }, "p1");
  assert.equal(failedRead.ok, false);
  assert.equal(state.canWrite("title"), false);
  await state.reconcile(loaderFor(record()), "p1");
  const switched = await state.load(async () => { throw new Error("offline"); }, "p2", { discardEdits: true });
  assert.equal(switched.ok, false);
  assert.equal(state.identity, "p2");
  assert.equal(state.baseline, null);
  assert.equal(state.canWrite("title"), false);
});

test("overlapping loads allow the latest record to win", async () => {
  const state = createEditorState(config());
  const a = deferred();
  const b = deferred();
  const first = state.load(() => a.promise, "p1");
  const second = state.load(() => b.promise, "p2");
  b.resolve(record("p2", "v2"));
  assert.equal((await second).ok, true);
  a.resolve(record("p1", "v1"));
  assert.equal((await first).stale, true);
  assert.equal(state.identity, "p2");
  assert.equal(state.baseline.id, "p2");
});

test("saving locks edits and loads until the acknowledgement arrives", async () => {
  const state = createEditorState(config());
  await load(state);
  state.change("title", "After");
  const pending = deferred();
  const saving = state.save(() => pending.promise);
  assert.equal(state.saving, true);
  assert.equal(state.change("title", "Later"), false);
  assert.deepEqual(await state.load(loaderFor(record()), "p1"), { ok: false, reason: "busy" });
  pending.resolve(record("p1", "v2", { title: "After" }));
  assert.equal((await saving).ok, true);
  assert.equal(state.saved, true);
});

test("successful save projects only acknowledged changed fields into the baseline", async () => {
  const state = createEditorState(config());
  await load(state);
  state.change("title", "After");
  const result = await state.save(async (collection, id, request) => {
    assert.equal(collection, "products");
    assert.equal(id, "p1");
    assert.deepEqual(request, { expected: { id: "p1", updated_at: "v1", title: "Before" }, changes: { title: "After" } });
    return { id: "p1", updated_at: "v2", title: "After", price: 999 };
  });
  assert.equal(result.ok, true);
  assert.equal(state.baseline.price, 4);
  assert.equal(state.baseline.title, "After");
  assert.equal(state.baseline.updated_at, "v2");
});

test("without the verified contract or required read permissions no request is made", async () => {
  for (const options of [
    { guardedContract: false },
    { permissions: { read: ["title"], update: true } },
  ]) {
    const state = createEditorState(config(options));
    await state.load(loaderFor(record()), "p1");
    assert.equal(state.canSave, false);
    let calls = 0;
    await state.save(async () => { calls++; return record("p1", "v2", { title: "After" }); });
    assert.equal(calls, 0);
  }
});

test("lost permission on any dirty field blocks the entire save", async () => {
  const permissions = { read: true, update: true };
  const state = createEditorState(config({ permissions }));
  await load(state);
  state.change("title", "After");
  state.change("price", 8);
  permissions.update = ["title"];
  assert.equal(state.canSave, false);
  let calls = 0;
  await state.save(async () => { calls++; });
  assert.equal(calls, 0);
});

test("409 conflict preserves edits and blocks retry until explicit reconciliation", async () => {
  const state = createEditorState(config());
  await load(state);
  state.change("title", "Keep me");
  const failed = await state.save(async () => { const error = new Error("conflict"); error.status = 409; throw error; });
  assert.equal(failed.ok, false);
  assert.equal(state.conflict, true);
  assert.equal(state.values.title, "Keep me");
  let calls = 0;
  await state.save(async () => { calls++; });
  assert.equal(calls, 0);
  assert.equal((await state.reconcile(loaderFor(record("p1", "v2")), "p1", { keepEdits: true })).ok, true);
  assert.equal(state.values.title, "Keep me");
  assert.equal(state.baseline.title, "Before");
  assert.equal(state.dirty, true);
  assert.equal(state.conflict, false);
});

test("malformed acknowledgement preserves edits and failed-retry state until reconcile", async () => {
  const state = createEditorState(config());
  await load(state);
  state.change("title", "Keep me");
  assert.equal((await state.save(async () => ({ id: "p1", updated_at: "v2" }))).ok, false);
  assert.equal(state.writeUncertain, true);
  assert.equal(state.values.title, "Keep me");
  let calls = 0;
  await state.save(async () => { calls++; });
  assert.equal(calls, 0);
  assert.equal((await state.reconcile(loaderFor(record("p1", "v3")), "p1")).ok, true);
  assert.equal(state.values.title, "Before");
  assert.equal(state.dirty, false);
  assert.equal(state.writeUncertain, false);
});

test("failed reconciliation keeps baseline and local edits", async () => {
  const state = createEditorState(config());
  await load(state);
  state.change("title", "Keep me");
  const before = state.baseline;
  assert.equal((await state.reconcile(async () => { throw new Error("offline"); })).ok, false);
  assert.deepEqual(state.baseline, before);
  assert.equal(state.values.title, "Keep me");
  assert.deepEqual(state.dirtyFields, ["title"]);
});

test("successful reconciliation defaults to discarding edits and can explicitly retain them", async () => {
  const state = createEditorState(config());
  await load(state);
  state.change("title", "Keep me");
  assert.equal((await state.reconcile(loaderFor(record("p1", "v2")), "p1")).ok, true);
  assert.equal(state.values.title, "Before");
  state.change("title", "Retain me");
  assert.equal((await state.reconcile(loaderFor(record("p1", "v3", { title: "Remote" })), "p1", { keepEdits: true })).ok, true);
  assert.equal(state.baseline.title, "Remote");
  assert.equal(state.values.title, "Retain me");
  assert.equal(state.dirty, true);
});


{

const sourcePath = fileURLToPath(new URL("../src/admin-shell.js", import.meta.url));
let leaveGuard; let updateGuard; let unloadHandler; let unmountCallback; let unloadRemoved = false;
const source = (await readFile(sourcePath, "utf8"))
  .replace('import { defineComponent, h, onMounted, onUnmounted, resolveComponent } from "vue";', "const { defineComponent, h, onMounted, onUnmounted, resolveComponent } = globalThis.__shellVue;")
  .replace('import { onBeforeRouteLeave, onBeforeRouteUpdate } from "vue-router";', "const { onBeforeRouteLeave, onBeforeRouteUpdate } = globalThis.__shellRouter;");
const vue = {
  defineComponent: (component) => component,
  h: (type, props = {}, children = null) => Array.isArray(props) ? ({ type, props: {}, children: props }) : ({ type, props, children }),
  resolveComponent: (name) => name,
  onMounted: (callback) => callback(),
  onUnmounted: (callback) => { unmountCallback = callback; },
};
globalThis.__shellVue = vue;
globalThis.__shellRouter = { onBeforeRouteLeave: (fn) => { leaveGuard = fn; }, onBeforeRouteUpdate: (fn) => { updateGuard = fn; } };
globalThis.window = { addEventListener: (_name, fn) => { unloadHandler = fn; }, removeEventListener: (_name, fn) => { unloadRemoved = fn === unloadHandler; }, confirm: () => true };
const { buildNativeFieldProps, NativeFieldGroup, MediaPicker, AdminShell, SectionTabs, EditorToolbar, CollectionList, ReadonlyDetails, buildCollectionQuery } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
delete globalThis.__shellVue;
delete globalThis.__shellRouter;

const setup = (component, props, emitted = []) => component.setup(props, { emit: (event, value) => emitted.push([event, value]), slots: {} });

test("native props honor an explicit subset and preserve native relation metadata", () => {
  const relation = { field: "image", collection: "product_images", interface: "file-image", special: ["file"], required: true, meta: { group: "group_media", note: "layout only", options: { folder: "f1", conditions: [{ name: "x" }] } } };
  const result = buildNativeFieldProps({ metadata: [relation, { field: "secret", collection: "products" }, { field: "group_media", meta: { interface: "group-detail" } }], fieldSubset: ["image", "group_media"], initialValues: { image: "old" }, modelValue: { image: "new", secret: "no" }, readonly: false, permissions: { read: true, update: true } });
  assert.equal(Object.hasOwn(result, "collection"), false);
  assert.deepEqual(result.fields.map(({ field }) => field), ["image"]);
  assert.deepEqual(result.modelValue, { image: "new" });
  assert.equal(result.fields[0].collection, "product_images");
  assert.equal(result.fields[0].interface, "file-image");
  assert.deepEqual(result.fields[0].meta.options, relation.meta.options);
  assert.equal("group" in result.fields[0].meta, false);
  assert.equal("note" in result.fields[0].meta, false);
  assert.equal(result.fields[0].meta.readonly, undefined);
});

test("native props filter unread fields and keep alias, generated, and metadata-readonly fields locked", () => {
  const result = buildNativeFieldProps({ metadata: [{ field: "hidden" }, { field: "locked", meta: { readonly: true } }, { field: "generated", schema: { is_generated: true } }, { field: "virtual", type: "alias" }], fieldSubset: ["hidden", "locked", "generated", "virtual"], readonly: false, permissions: { read: ["locked", "generated", "virtual"], update: true }, validationErrors: [{ field: "locked", collection: "x" }] });
  assert.deepEqual(result.fields.map(({ field }) => field), ["locked", "generated", "virtual"]);
  assert.equal(result.fields.every(({ meta }) => meta.readonly === true), true);
  assert.deepEqual(result.validationErrors, [{ field: "locked", collection: "x" }]);
  assert.deepEqual(buildNativeFieldProps({ validationErrors: { bad: true } }).validationErrors, []);
});

test("NativeFieldGroup emits only authorized changed fields from its explicit subset", () => {
  const emitted = [];
  const props = { metadata: [{ field: "title" }, { field: "secret" }], fieldSubset: ["title"], modelValue: { title: "old", secret: "kept" }, permissions: { read: true, update: ["title"] }, readonly: false, disabled: false, primaryKey: "1", initialValues: {}, validationErrors: [] };
  const render = setup(NativeFieldGroup, props, emitted);
  const form = render();
  form.props["onUpdate:modelValue"]({ title: "new", secret: "stolen" });
  assert.deepEqual(emitted, [["update:modelValue", { title: "new", secret: "kept" }]]);
  props.modelValue = { ...props.modelValue, title: "new" };
  form.props["onUpdate:modelValue"]({ title: "new", secret: "stolen" });
  assert.equal(emitted.length, 1);
});

test("NativeFieldGroup is inert in readonly mode", () => {
  const emitted = [];
  const form = setup(NativeFieldGroup, { metadata: [{ field: "title" }], fieldSubset: ["title"], modelValue: { title: "old" }, permissions: { read: true, update: true }, readonly: true, disabled: false }, emitted)();
  form.props["onUpdate:modelValue"]({ title: "attempt" });
  assert.deepEqual(emitted, []);
});

test("MediaPicker preserves file-image metadata and gates select/upload affordances by explicit permissions", () => {
  const emitted = [];
  const props = { field: { field: "image", collection: "products", special: ["file"], interface: "file-image", meta: { interface: "file-image", options: { folder: "media" } } }, primaryKey: "p1", initialValue: { image: "old" }, modelValue: "old", permissions: { read: true, update: true }, readonly: false, disabled: false, allowSelect: true, allowUpload: false, missingAsset: true };
  const wrapper = setup(MediaPicker, props, emitted)();
  const group = wrapper.children[1];
  assert.equal(group.type, NativeFieldGroup);
  assert.equal(group.props.metadata[0].collection, "products");
  assert.equal(group.props.metadata[0].interface, "file-image");
  assert.equal(group.props.metadata[0].meta.options.enableSelect, true);
  assert.equal(group.props.metadata[0].meta.options.enableCreate, false);
  group.props["onUpdate:modelValue"]({ image: "next" });
  assert.deepEqual(emitted, [["update:modelValue", "next"]]);

  const denied = setup(MediaPicker, { ...props, permissions: { read: true, update: false }, allowSelect: true, allowUpload: true })();
  assert.equal(denied.children[1].props.metadata[0].meta.options.enableSelect, false);
  assert.equal(denied.children[1].props.metadata[0].meta.options.enableCreate, false);
});

test("native fields preserve subset order, full context baseline, deny missing permissions, and emit removals", () => {
  const props = { metadata: [{ field: "first" }, { field: "second" }], fieldSubset: ["second", "first"], initialValues: { first: "base", second: "base", context: "kept" }, modelValue: { first: "edit", second: "edit" }, permissions: { read: true, update: true }, readonly: false, primaryKey: "a" };
  const built = buildNativeFieldProps(props);
  assert.deepEqual(built.fields.map((field) => field.field), ["second", "first"]);
  assert.deepEqual(built.initialValues, props.initialValues);
  assert.deepEqual(buildNativeFieldProps({ metadata: [{ field: "x" }], fieldSubset: ["x"] }).fields, []);
  const emitted = [];
  const oldHandler = setup(NativeFieldGroup, props, emitted)().props["onUpdate:modelValue"];
  oldHandler({ second: "edit" });
  assert.deepEqual(emitted, [["update:modelValue", { second: "edit" }]]);
  props.primaryKey = "b";
  oldHandler({ first: "wrong-record" });
  assert.equal(emitted.length, 1);
});

test("NativeFieldGroup ignores delayed updates from a previous tab subset", () => {
  const emitted = [];
  const props = { metadata: [{ field: "first" }, { field: "second" }], fieldSubset: ["first"], initialValues: { first: "base", second: "base" },
    modelValue: { first: "base" }, permissions: { read: true, update: true }, readonly: false, primaryKey: "a" };
  const oldHandler = setup(NativeFieldGroup, props, emitted)().props["onUpdate:modelValue"];
  props.fieldSubset = ["second"];
  props.modelValue = { second: "newer-tab-edit" };
  oldHandler({ first: "delayed-old-tab-event" });
  assert.deepEqual(emitted, []);
});

test("MediaPicker normalizes expanded assets and rejects stale-record events", () => {
  const emitted = [];
  const props = { field: { field: "image" }, primaryKey: "a", modelValue: { id: "asset-1" }, permissions: { read: true, update: true }, readonly: false, allowSelect: true };
  const wrapper = setup(MediaPicker, props, emitted)();
  assert.deepEqual(wrapper.children[1].props.modelValue, { image: "asset-1" });
  const cleared = setup(MediaPicker, { ...props, modelValue: { image: null } })();
  assert.deepEqual(cleared.children[1].props.modelValue, { image: null });
  wrapper.children[1].props["onUpdate:modelValue"]({ image: "asset-2" });
  assert.deepEqual(emitted, [["update:modelValue", "asset-2"]]);
  props.primaryKey = "b";
  wrapper.children[1].props["onUpdate:modelValue"]({ image: "wrong" });
  assert.equal(emitted.length, 1);
});

test("SectionTabs renders isolated accessible IDs and handles keyboard navigation", () => {
  const emitted = [];
  const props = { tabs: [{ id: "main", label: "Основное" }, { id: "seo", label: "SEO" }], modelValue: "main", disabled: false, idPrefix: "x" };
  const render = setup(SectionTabs, props, emitted);
  const first = render(); const second = setup(SectionTabs, props)();
  const tablist = first.children[0];
  assert.equal(tablist.props.role, "tablist");
  assert.equal(tablist.children[0].props["aria-controls"], `${first.children[1].props.id}`);
  assert.notEqual(first.children[0].children[0].props.id, second.children[0].children[0].props.id);
  let focused = false; let prevented = false;
  tablist.children[0].props.onKeydown({ key: "End", currentTarget: { parentElement: { querySelectorAll: () => [{}, { focus: () => { focused = true; } }] } }, preventDefault: () => { prevented = true; } });
  assert.deepEqual(emitted, [["update:modelValue", "seo"]]);
  assert.equal(focused && prevented, true);
});

test("EditorToolbar gates save and publish and emits explicit conflict resolution", () => {
  const emitted = [];
  const props = { title: "Item", state: { canSave: true, conflict: true }, readonly: false, canPublish: true };
  const tree = setup(EditorToolbar, props, emitted)();
  const actions = tree.children[1].children;
  assert.equal(actions[0].props.disabled, true);
  assert.equal(actions[1].props.disabled, true);
  actions[3].children[1].props.onClick(); actions[3].children[2].props.onClick();
  assert.deepEqual(emitted, [["reconcile", { keepEdits: true }], ["reconcile", { keepEdits: false }]]);
  props.state = { canSave: true };
  assert.equal(setup(EditorToolbar, props)().children[1].children[0].props.disabled, false);
});

test("collection query validates explicit fields and pagination bounds", () => {
  assert.deepEqual(buildCollectionQuery({ fields: ["id", "title"], page: 3, pageSize: 25, search: "  pump " }), { fields: "id,title", limit: 25, offset: 50, search: "pump" });
  assert.throws(() => buildCollectionQuery({ fields: ["*"] }), /explicit/);
  for (const fields of [["id,*"], ["category.*"], [" * "], ["id,title"], [" title "]]) assert.throws(() => buildCollectionQuery({ fields }), /explicit/);
  assert.deepEqual(buildCollectionQuery({ fields: ["category.title", "category.translations.name"] }).fields, "category.title,category.translations.name");
  assert.throws(() => buildCollectionQuery({ fields: [] }), /explicit/);
  assert.throws(() => buildCollectionQuery({ fields: ["id"], page: 0 }), /positive/);
  assert.throws(() => buildCollectionQuery({ fields: ["id"], pageSize: 101 }), /between/);
  assert.throws(() => buildCollectionQuery({ fields: ["id"], page: Number.MAX_SAFE_INTEGER }), /offset/);
});

test("CollectionList uses rows for unknown-total pagination and exposes retry", () => {
  const emitted = [];
  const props = { rows: new Array(25).fill(null).map((_, i) => ({ id: i })), columns: [{ field: "id", label: "ID" }], page: 2, pageSize: 25, total: null, loading: false, error: false };
  const tree = setup(CollectionList, props, emitted)();
  const walk = (node, predicate, result = []) => {
    if (!node) return result;
    if (Array.isArray(node)) node.forEach((child) => walk(child, predicate, result));
    else if (typeof node === "object") { if (predicate(node)) result.push(node); walk(node.children, predicate, result); }
    return result;
  };
  const row = walk(tree, (node) => node.type === "tr" && node.props.tabindex === 0)[1];
  assert.ok(row);
  let prevented = false;
  row.props.onKeydown({ key: "Enter", preventDefault: () => { prevented = true; } });
  row.props.onKeydown({ key: " ", preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(emitted.filter(([name]) => name === "select").length, 2);
  const pager = tree.children[2];
  assert.equal(pager.children[2].props.disabled, false);
  pager.children[2].props.onClick();
  assert.deepEqual(emitted.at(-1), ["update:page", 3]);
  props.error = "network";
  const retryTree = setup(CollectionList, props, emitted)();
  retryTree.children[1].children[1].props.onClick();
  assert.deepEqual(emitted.at(-1), ["retry", undefined]);
});

test("ReadonlyDetails formats object values without edit controls", () => {
  const tree = setup(ReadonlyDetails, { values: { system: { id: 4 } }, fields: [{ field: "system", label: "System" }] })();
  assert.equal(tree.children[0].children[1].props, '{"id":4}');
});

test("AdminShell blocks navigation while saving and prompts for dirty route changes", () => {
  const props = { title: "Editor", state: { dirty: true, saving: false }, dirty: null, saving: false, readonly: false, guardNavigation: true };
  setup(AdminShell, props);
  assert.equal(leaveGuard(), true);
  assert.equal(updateGuard(), true);
  let prevented = false;
  unloadHandler({ preventDefault: () => { prevented = true; }, set returnValue(_value) {} });
  assert.equal(prevented, true);
  props.saving = true;
  assert.equal(leaveGuard(), false);
  props.saving = false; props.state = { dirty: false };
  assert.equal(leaveGuard(), true);
  unmountCallback();
  assert.equal(unloadRemoved, true);
});

test("AdminShell delivers its styles, uses one column without context, and renders Error messages as text", () => {
  const props = { title: "Editor", state: { saveError: new Error("network broke") }, dirty: false, saving: false, readonly: false, guardNavigation: false };
  const render = AdminShell.setup(props, { emit: () => {}, slots: { main: () => "editor" } });
  const view = render();
  const main = view.children.default();
  assert.equal(main.children[0].type, "style");
  assert.match(main.children[0].children, /--input-height-md:40px/);
  const grid = main.children.find((node) => node?.props?.class?.startsWith("ac-shell__grid"));
  assert.equal(grid.props.class, "ac-shell__grid ac-shell__grid--single");
  const error = main.children.find((node) => node?.props?.role === "alert");
  assert.equal(error.children, "network broke");
});
}
