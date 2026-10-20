import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const uri = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const vue = uri(`export const defineComponent=x=>x; export const h=(...args)=>({type:args[0],props:args[1]&&typeof args[1]==="object"&&!Array.isArray(args[1])?args[1]:{},children:args.length>2?args[2]:(Array.isArray(args[1])||typeof args[1]==="string"?args[1]:undefined)}); export const onMounted=()=>{}; export const onUnmounted=()=>{}; export const resolveComponent=x=>x; export const ref=value=>({value});`);
const router = uri(`export const guards=[]; export const onBeforeRouteLeave=guard=>guards.push(guard); export const onBeforeRouteUpdate=guard=>guards.push(guard);`);
const { guards } = await import(router);
const source = await readFile(new URL("../src/admin-shell.js", import.meta.url), "utf8");
const moduleUrl = uri(source.replace('"vue"', JSON.stringify(vue)).replace('"vue-router"', JSON.stringify(router)));
const { AdminShell, EditorToolbar } = await import(moduleUrl);
const walk = (node, predicate, found = []) => {
  if (Array.isArray(node)) node.forEach((child) => walk(child, predicate, found));
  else if (node && typeof node === "object") {
    if (predicate(node)) found.push(node);
    walk(node.children, predicate, found);
  }
  return found;
};
const strings = (node, found = []) => {
  if (typeof node === "string") found.push(node);
  else if (Array.isArray(node)) node.forEach((child) => strings(child, found));
  else if (node && typeof node === "object") strings(node.children, found);
  return found;
};
const shellContent = (render) => render().children.default();

test("an untouched editor reports a neutral state, never a saved claim", () => {
  const render = AdminShell.setup({ title: "Категории", mode: "editor", state: {}, dirty: null, saving: false, readonly: false, guardNavigation: true }, { slots: { default: () => [] }, emit: () => {} });
  const tree = shellContent(render);
  const toolbar = walk(tree, (node) => node.type === EditorToolbar)[0];
  const toolbarTree = EditorToolbar.setup(toolbar.props, { emit: () => {}, slots: {} })();
  const status = walk(toolbarTree, (node) => node.type === "p" && node.props["aria-live"] === "polite")[0];
  assert.equal(status.children, "Нет несохранённых изменений");
  assert.ok(!strings(tree).some((value) => value.startsWith("Все изменения сохранены")));
});

test("a conflict offers comparison and a separate explicit save path", () => {
  const emitted = [];
  const render = EditorToolbar.setup({ title: "Категории", readonly: false, canPublish: false, saveLabel: "Сохранить", state: { dirty: true, conflict: true, canSave: false } }, { emit: (...event) => emitted.push(event), slots: {} });
  const tree = render();
  const labels = strings(tree);
  assert.ok(labels.includes("Сравнить изменения"));
  assert.ok(!labels.includes("Сохранить мои изменения"));
  assert.ok(!labels.includes("Загрузить актуальные данные"));
  const compare = walk(tree, (node) => node.type === "button" && node.children === "Сравнить изменения")[0];
  compare.props.onClick();
  assert.deepEqual(emitted, [["reconcile", { action: "compare" }]]);
});

test("unexpected save errors are presented without exposing technical details", () => {
  const error = new Error("Save acknowledgement does not contain the changed fields and version");
  const render = AdminShell.setup({ title: "Категории", mode: "editor", state: { writeUncertain: true, saveError: error }, dirty: true, saving: false, readonly: false, guardNavigation: true }, { slots: { default: () => [] }, emit: () => {} });
  const tree = shellContent(render);
  const toolbar = walk(tree, (node) => node.type === EditorToolbar)[0];
  const toolbarTree = EditorToolbar.setup(toolbar.props, { emit: () => {}, slots: {} })();
  const visible = [...strings(tree), ...strings(toolbarTree)].join(" ");
  assert.ok(visible.includes("Не удалось проверить, сохранились ли изменения. Введённые данные остались в открытой форме"));
  assert.ok(visible.includes("Проверить сохранение"));
  assert.ok(!visible.includes(error.message));
});

test("an internal dirty-form transition uses one accessible Directus confirmation", async () => {
  const render = AdminShell.setup({ title: "Категории", mode: "editor", state: { dirty: true }, dirty: null, saving: false, readonly: false, guardNavigation: true }, { slots: { default: () => [] }, emit: () => {} });
  const guard = guards.at(-1);
  const pending = guard();
  assert.equal(typeof pending.then, "function");
  const tree = shellContent(render);
  const dialogs = walk(tree, (node) => node.type === "v-dialog");
  assert.equal(dialogs.length, 1);
  assert.equal(dialogs[0].props.persistent, true);
  assert.equal(dialogs[0].props.modelValue, true);
  const buttons = walk(dialogs[0].children.default(), (node) => node.type === "v-button");
  assert.equal(buttons[0].props.autofocus, true);
  assert.equal(buttons[0].children.default(), "Остаться");
  assert.equal(buttons[1].children.default(), "Выйти без сохранения");
  dialogs[0].props.onEsc();
  assert.equal(await pending, false);
});

test("confirming a pending transition after saving starts still blocks navigation", async () => {
  const props = { title: "Категории", mode: "editor", state: { dirty: true }, dirty: null, saving: false, readonly: false, guardNavigation: true };
  const render = AdminShell.setup(props, { slots: { default: () => [] }, emit: () => {} });
  const pending = guards.at(-1)();
  const dialog = walk(shellContent(render), (node) => node.type === "v-dialog")[0];
  props.saving = true;
  const leave = walk(dialog.children.default(), (node) => node.type === "v-button")[1];
  leave.props.onClick();
  assert.equal(await pending, false);
});
