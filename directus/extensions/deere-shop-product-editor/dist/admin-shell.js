import { defineComponent, h, onMounted, onUnmounted, resolveComponent } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate } from "vue-router";

const fieldList = (metadata) => Array.isArray(metadata) ? metadata : Object.values(metadata ?? {});
const fieldName = (field) => field?.field ?? field?.name;
const canRead = (permissions, field) => permissions?.read === true || (Array.isArray(permissions?.read) && (permissions.read.includes("*") || permissions.read.includes(field)));
const canUpdate = (permissions, field) => permissions?.update === true || (Array.isArray(permissions?.update) && (permissions.update.includes("*") || permissions.update.includes(field)));

/**
 * Build a controlled v-form contract for an explicit subset of Directus metadata.
 * Group and note presentation fields are omitted while native interfaces and relation metadata remain intact.
 */
export function buildNativeFieldProps({ metadata, fields, fieldSubset = [], primaryKey = "+", initialValues = {}, modelValue = {}, permissions = {}, readonly = true, disabled = false, validationErrors = [] } = {}) {
  const source = fieldList(fields ?? metadata);
  const byName = new Map(source.map((field) => [fieldName(field), field]));
  const selected = (Array.isArray(fieldSubset) ? fieldSubset : []).map((name) => byName.get(name)).filter((field) => {
    const name = fieldName(field);
    const iface = field?.meta?.interface ?? field?.interface;
    return name && canRead(permissions, name) && !["group-detail", "group-accordion", "presentation-divider", "presentation-notice"].includes(iface);
  }).map((field, index) => {
    const name = fieldName(field);
    const writable = canUpdate(permissions, name) && !readonly && !disabled && field.type !== "alias" && field.meta?.readonly !== true && field.readonly !== true && field.schema?.is_generated !== true;
    const { group: _group, note: _note, ...nativeMeta } = field.meta ?? {};
    const meta = { ...nativeMeta, width: field.meta?.width ?? "full", sort: index + 1 };
    if (!writable) meta.readonly = true;
    return { ...field, field: name, meta };
  });
  const picked = Object.fromEntries(selected.filter(({ field }) => Object.hasOwn(modelValue ?? {}, field)).map(({ field }) => [field, modelValue[field]]));
  const baseline = { ...(initialValues ?? {}) };
  return { primaryKey, initialValues: baseline, modelValue: picked, fields: selected, disabled: Boolean(disabled), nonEditable: Boolean(readonly || disabled), validationErrors: Array.isArray(validationErrors) ? validationErrors : [] };
}

export const NativeFieldGroup = defineComponent({
  name: "NativeFieldGroup",
  props: {
    metadata: { type: [Object, Array], default: null }, fields: { type: Array, default: null }, fieldSubset: { type: Array, default: () => [] },
    primaryKey: { type: [String, Number], default: "+" }, initialValues: { type: Object, default: () => ({}) }, modelValue: { type: Object, default: () => ({}) },
    permissions: { type: Object, default: () => ({}) }, readonly: { type: Boolean, default: true }, disabled: { type: Boolean, default: false },
    validationErrors: { type: Array, default: () => [] },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    const vForm = resolveComponent("v-form");
    return () => {
      const form = buildNativeFieldProps(props);
      const renderedPrimaryKey = props.primaryKey;
      const renderedSubset = (props.fieldSubset ?? []).join("\u0000");
      return h(vForm, { ...form, "onUpdate:modelValue": (next = {}) => {
        if (props.primaryKey !== renderedPrimaryKey || (props.fieldSubset ?? []).join("\u0000") !== renderedSubset || props.readonly || props.disabled) return;
        const current = buildNativeFieldProps(props);
        const writable = current.fields.filter(({ field, meta }) => canUpdate(props.permissions, field) && meta.readonly !== true).map(({ field }) => field);
        const merged = { ...props.modelValue }; let changed = false;
        for (const field of writable) {
          if (Object.hasOwn(next, field) && !Object.is(merged[field], next[field])) { merged[field] = next[field]; changed = true; }
          else if (!Object.hasOwn(next, field) && Object.hasOwn(merged, field)) { delete merged[field]; changed = true; }
        }
        if (changed) emit("update:modelValue", merged);
      } });
    };
  },
});

/** Controlled single-file wrapper; Directus owns the picker UI and asset lifecycle. */
export const MediaPicker = defineComponent({
  name: "MediaPicker",
  props: {
    field: { type: Object, default: () => ({}) }, primaryKey: { type: [String, Number], default: "+" }, initialValue: { type: Object, default: () => ({}) },
    modelValue: { type: [String, Object], default: null }, permissions: { type: Object, default: () => ({}) },
    readonly: { type: Boolean, default: true }, disabled: { type: Boolean, default: false }, allowSelect: { type: Boolean, default: false }, allowUpload: { type: Boolean, default: false }, missingAsset: { type: Boolean, default: false },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    return () => {
      const name = fieldName(props.field);
      if (!name || !canRead(props.permissions, name)) return h("p", { role: "status" }, "Поле файла Directus недоступно.");
      const writable = canUpdate(props.permissions, name) && !props.readonly && !props.disabled && props.field.type !== "alias" && props.field.meta?.readonly !== true && props.field.readonly !== true && props.field.schema?.is_generated !== true;
      const field = { ...props.field, meta: { ...(props.field.meta ?? {}), options: { ...(props.field.meta?.options ?? {}), enableSelect: Boolean(props.allowSelect && writable), enableCreate: Boolean(props.allowUpload && writable) } } };
      const hasObjectModel = props.modelValue && typeof props.modelValue === "object";
      const objectValue = hasObjectModel ? (Object.hasOwn(props.modelValue, name) ? props.modelValue[name] : props.modelValue) : props.modelValue;
      const value = objectValue && typeof objectValue === "object" ? objectValue.id ?? null : objectValue ?? null;
      const renderedPrimaryKey = props.primaryKey;
      return h("div", [props.missingAsset ? h("p", { role: "status" }, "Связанный файл отсутствует.") : null,
        h(NativeFieldGroup, { metadata: [field], fieldSubset: [name], primaryKey: props.primaryKey, initialValues: props.initialValue, modelValue: { [name]: value }, permissions: props.permissions, readonly: props.readonly || !writable, disabled: props.disabled, "onUpdate:modelValue": (next) => {
          const allowed = canUpdate(props.permissions, name) && !props.readonly && !props.disabled && props.field.type !== "alias" && props.field.meta?.readonly !== true && props.field.readonly !== true && props.field.schema?.is_generated !== true;
          if (allowed && props.primaryKey === renderedPrimaryKey && canRead(props.permissions, name)) emit("update:modelValue", next[name]?.id ?? next[name] ?? null);
        } }),
        props.allowUpload && !writable ? h("p", { role: "status" }, "Загрузка недоступна без прав на добавление файлов.") : null]);
    };
  },
});

const shellId = (prefix) => `${prefix}-${++componentSequence}`;
let componentSequence = 0;
const statusText = (state = {}) => state.loading ? "Загрузка…" : state.readError ? "Не удалось загрузить данные." : state.saving ? "Сохранение…" : state.saveError ? "Не удалось сохранить изменения." : state.conflict ? "Данные изменились в другом окне." : state.writeUncertain ? "Результат сохранения не подтверждён." : state.dirty ? "Есть несохранённые изменения." : state.saved ? "Изменения сохранены." : state.readonly ? "Режим просмотра." : "Все изменения сохранены.";
const errorMessage = (error) => typeof error === "string" ? error : error?.message ? String(error.message) : "Не удалось сохранить изменения.";
const statusMessages = (state = {}, retry) => [
  state.loading ? h("p", { role: "status" }, "Загрузка данных…") : null,
  state.readError ? h("div", { role: "alert" }, [h("span", "Не удалось загрузить данные."), retry ? h("button", { type: "button", onClick: retry }, "Повторить") : null]) : null,
  state.saveError ? h("p", { role: "alert" }, state.saveError === true ? "Не удалось сохранить изменения." : errorMessage(state.saveError)) : null,
  state.writeUncertain ? h("p", { role: "alert" }, "Результат сохранения не подтверждён. Обновите данные перед продолжением.") : null,
  state.conflict ? h("p", { role: "alert" }, "Данные изменились в другом окне. Сравните версии и выберите решение.") : null,
  state.permissionDenied ? h("p", { role: "status" }, "Недостаточно прав для изменения данных.") : null,
  state.saved ? h("p", { role: "status" }, "Изменения сохранены.") : null,
  state.readonly ? h("p", { role: "status" }, "Доступен только просмотр.") : null,
].filter(Boolean);

/** Native Directus layout and navigation guard for controlled extension views. */
export const AdminShell = defineComponent({
  name: "AdminShell",
  props: { title: { type: String, default: "" }, state: { type: Object, default: () => ({}) }, dirty: { type: Boolean, default: null }, saving: { type: Boolean, default: false }, readonly: { type: Boolean, default: true }, guardNavigation: { type: Boolean, default: true } },
  emits: ["save", "back", "retry", "reconcile"],
  setup(props, { slots, emit }) {
    const dirtyNow = () => props.dirty ?? Boolean(props.state?.dirty);
    const savingNow = () => Boolean(props.saving || props.state?.saving);
    const confirmNavigation = () => {
      if (savingNow()) return false;
      return !dirtyNow() || (typeof window !== "undefined" && window.confirm("Есть несохранённые изменения. Покинуть страницу?"));
    };
    const routeGuard = () => savingNow() ? false : (!props.guardNavigation || confirmNavigation());
    onBeforeRouteLeave(routeGuard); onBeforeRouteUpdate(routeGuard);
    const unload = (event) => { if (!props.guardNavigation || (!dirtyNow() && !savingNow())) return; event.preventDefault(); event.returnValue = ""; };
    onMounted(() => typeof window !== "undefined" && window.addEventListener("beforeunload", unload));
    onUnmounted(() => typeof window !== "undefined" && window.removeEventListener("beforeunload", unload));
    return () => {
      const state = { ...props.state, dirty: dirtyNow(), saving: savingNow(), readonly: props.readonly || props.state?.readonly };
      const view = resolveComponent("private-view");
      const toolbar = slots.toolbar?.({ state, title: props.title }) ?? h(EditorToolbar, { title: props.title, state, readonly: state.readonly, onSave: () => emit("save"), onBack: () => emit("back"), onReconcile: (choice) => emit("reconcile", choice) });
      const context = slots.context?.({ state });
      const hasContext = context != null && (!Array.isArray(context) || context.length > 0);
      return h(view, { title: props.title }, { default: () => h("main", { class: "ac-shell" }, [
        h("style", null, shellStyle),
        h("header", { class: "ac-shell__header" }, [h("div", [h("h1", props.title), h("p", { class: "ac-shell__status", "aria-live": "polite" }, statusText(state))]), toolbar]),
        ...statusMessages(state, () => { if (slots.retry) slots.retry(); else emit("retry"); }),
        slots.conflict?.({ state }),
        h("div", { class: `ac-shell__grid${hasContext ? "" : " ac-shell__grid--single"}` }, [h("section", { class: "ac-shell__main" }, slots.main?.({ state }) ?? slots.default?.({ state })), hasContext ? h("aside", { class: "ac-shell__context" }, context) : null]),
      ]) });
    };
  },
});

/** Accessible controlled tab set with per-instance panel identifiers. */
export const SectionTabs = defineComponent({
  name: "SectionTabs",
  props: { tabs: { type: Array, default: () => [] }, modelValue: { type: String, default: "" }, disabled: { type: Boolean, default: false }, idPrefix: { type: String, default: "admin-tab" } },
  emits: ["update:modelValue"],
  setup(props, { emit, slots }) {
    const base = shellId(props.idPrefix);
    return () => {
      const selectedIndex = Math.max(0, props.tabs.findIndex((tab) => tab.id === props.modelValue));
      const buttons = props.tabs.map((tab, index) => h("button", { id: `${base}-tab-${tab.id}`, type: "button", role: "tab", "aria-selected": index === selectedIndex ? "true" : "false", "aria-controls": `${base}-panel-${tab.id}`, tabindex: index === selectedIndex ? 0 : -1, disabled: props.disabled, onClick: () => !props.disabled && emit("update:modelValue", tab.id), onKeydown: (event) => {
        const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        const next = event.key === "Home" ? 0 : event.key === "End" ? props.tabs.length - 1 : delta ? (index + delta + props.tabs.length) % props.tabs.length : -1;
        if (next < 0 || props.disabled) return;
        event.preventDefault(); emit("update:modelValue", props.tabs[next].id);
        event.currentTarget?.parentElement?.querySelectorAll?.('[role="tab"]')?.[next]?.focus?.();
      } }, tab.label));
      const active = props.tabs[selectedIndex];
      return h("section", { class: "ac-tabs" }, [h("div", { class: "ac-tabs__list", role: "tablist", "aria-label": "Разделы редактора" }, buttons), active ? h("div", { id: `${base}-panel-${active.id}`, role: "tabpanel", "aria-labelledby": `${base}-tab-${active.id}`, tabindex: 0 }, slots.default?.({ tab: active }) ?? null) : null]);
    };
  },
});

/** Toolbar actions stay controlled and only emit user intent. */
export const EditorToolbar = defineComponent({
  name: "EditorToolbar",
  props: { title: { type: String, default: "" }, state: { type: Object, default: () => ({}) }, readonly: { type: Boolean, default: true }, canPublish: { type: Boolean, default: false } },
  emits: ["save", "publish", "back", "reconcile"],
  setup(props, { emit, slots }) {
    return () => {
      const s = props.state ?? {};
      const saveDisabled = props.readonly || !s.canSave || s.loading || s.saving || s.conflict || s.writeUncertain || s.readError;
      const publishDisabled = props.readonly || !props.canPublish || s.loading || s.saving || s.conflict || s.writeUncertain || s.readError;
      return h("div", { class: "ac-toolbar" }, [h("div", [h("strong", props.title), h("p", { "aria-live": "polite" }, statusText(s))]), h("div", { class: "ac-toolbar__actions" }, [
        h("button", { type: "button", disabled: Boolean(saveDisabled), onClick: () => emit("save") }, "Сохранить"),
        props.canPublish ? h("button", { type: "button", disabled: Boolean(publishDisabled), onClick: () => emit("publish") }, "Опубликовать") : null,
        h("button", { type: "button", disabled: Boolean(s.saving), onClick: () => emit("back") }, "Назад"),
        s.conflict ? h("div", { class: "ac-toolbar__conflict" }, [h("p", { role: "alert" }, "Обнаружен конфликт данных."), h("button", { type: "button", disabled: Boolean(s.saving), onClick: () => emit("reconcile", { keepEdits: true }) }, "Сохранить мои изменения"), h("button", { type: "button", disabled: Boolean(s.saving), onClick: () => emit("reconcile", { keepEdits: false }) }, "Загрузить актуальные данные")]) : null,
        slots.default?.({ state: s }),
      ])]);
    };
  },
});

/** Validate a bounded Directus collection query without performing a request. */
export function buildCollectionQuery({ fields = [], page = 1, pageSize = 25, sort, search, filter } = {}) {
  if (!Array.isArray(fields) || fields.length === 0 || fields.some((field) => typeof field !== "string" || !field.trim() || field !== field.trim() || field.includes(",") || field.includes("*"))) throw new TypeError("fields must be explicit field names");
  if (!Number.isSafeInteger(page) || page < 1) throw new RangeError("page must be a positive integer");
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new RangeError("pageSize must be between 1 and 100");
  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(offset)) throw new RangeError("page offset exceeds the safe integer range");
  const params = { fields: fields.join(","), limit: pageSize, offset };
  if (sort) params.sort = sort;
  if (typeof search === "string" && search.trim()) params.search = search.trim();
  if (filter && typeof filter === "object" && Object.keys(filter).length) params.filter = filter;
  return params;
}

/** Read-only field/value presentation for technical and system fields. */
export const ReadonlyDetails = defineComponent({
  name: "ReadonlyDetails",
  props: { values: { type: Object, default: () => ({}) }, fields: { type: Array, default: () => [] } },
  setup(props) { return () => h("dl", { class: "ac-details" }, props.fields.map(({ field, label }) => { const value = props.values?.[field]; return h("div", { key: field }, [h("dt", label ?? field), h("dd", value && typeof value === "object" ? JSON.stringify(value) : value == null || value === "" ? "—" : String(value))]); })); },
});

/** Controlled table with explicit fields and bounded pagination. */
export const CollectionList = defineComponent({
  name: "CollectionList",
  props: { rows: { type: Array, default: () => [] }, columns: { type: Array, default: () => [] }, page: { type: Number, default: 1 }, pageSize: { type: Number, default: 25 }, total: { type: Number, default: null }, loading: { type: Boolean, default: false }, error: { type: [String, Boolean], default: false }, search: { type: String, default: "" }, sort: { type: String, default: "" }, filters: { type: Object, default: () => ({}) } },
  emits: ["select", "update:page", "update:search", "update:sort", "update:filters", "retry"],
  setup(props, { emit }) {
    return () => {
      const nextEnabled = props.total == null ? props.rows.length >= props.pageSize : props.page * props.pageSize < props.total;
      const filterControls = props.columns.filter((column) => Array.isArray(column.filterOptions) && column.filterOptions.length).map((column) => h("select", { value: props.filters[column.field] ?? "", "aria-label": `Фильтр: ${column.label}`, onChange: (event) => emit("update:filters", { ...props.filters, [column.field]: event.target.value || null }) }, [h("option", { value: "" }, `Все: ${column.label}`), ...column.filterOptions.map((option) => h("option", { value: option.value }, option.label))]));
      const children = [h("form", { class: "ac-list__controls", onSubmit: (event) => event.preventDefault() }, [h("input", { value: props.search, type: "search", "aria-label": "Поиск", onInput: (event) => emit("update:search", event.target.value) }), props.columns.some((column) => column.sortable) ? h("select", { value: props.sort, "aria-label": "Сортировка", onChange: (event) => emit("update:sort", event.target.value) }, [h("option", { value: "" }, "Без сортировки"), ...props.columns.filter((column) => column.sortable).map((column) => h("option", { value: column.field }, column.label))]) : null, ...filterControls]),
        props.loading ? h("p", { role: "status" }, "Загрузка списка…") : props.error ? h("div", { role: "alert" }, [h("span", typeof props.error === "string" ? props.error : "Не удалось загрузить список."), h("button", { type: "button", onClick: () => emit("retry") }, "Повторить")]) : props.rows.length ? h("div", { class: "ac-list__scroll", tabindex: 0, role: "region", "aria-label": "Таблица результатов" }, [h("table", [
          h("thead", [h("tr", props.columns.map((column) => h("th", { scope: "col" }, column.label)))]),
          h("tbody", props.rows.map((row) => h("tr", { key: row.id ?? JSON.stringify(row), tabindex: 0, onClick: () => emit("select", row), onKeydown: (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault(); emit("select", row);
          } }, props.columns.map((column) => h("td", row[column.field] == null ? "—" : String(row[column.field])))))),
        ])]) : h("p", { role: "status" }, "Нет записей."),
        h("nav", { class: "ac-list__pagination", "aria-label": "Страницы списка" }, [h("button", { type: "button", disabled: props.page <= 1 || props.loading, onClick: () => emit("update:page", props.page - 1) }, "Назад"), h("span", `Страница ${props.page}`), h("button", { type: "button", disabled: !nextEnabled || props.loading, onClick: () => emit("update:page", props.page + 1) }, "Дальше")])];
      return h("section", { class: "ac-list" }, children);
    };
  },
});

const shellStyle = `
.ac-shell{--input-height-md:40px;box-sizing:border-box;max-width:1440px;margin:0 auto;padding:24px;color:var(--theme--foreground,inherit)}.ac-shell *{box-sizing:border-box}.ac-shell__header,.ac-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px}.ac-shell__header h1{margin:0}.ac-shell__status{margin:4px 0;color:var(--theme--foreground-subdued,#66788a)}.ac-shell__grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:24px;margin-top:20px}.ac-shell__grid--single{grid-template-columns:minmax(0,1fr)}.ac-shell__main,.ac-shell__context{min-width:0}.ac-shell input,.ac-shell select,.ac-shell textarea,.ac-list input,.ac-list select{min-height:40px}.ac-shell button:focus-visible,.ac-list button:focus-visible,.ac-tabs button:focus-visible{outline:2px solid var(--theme--primary,#6644ff);outline-offset:2px}.ac-tabs__list{display:flex;gap:4px;overflow-x:auto;border-bottom:1px solid var(--theme--border-color,#d9e1e8)}.ac-tabs [role=tab]{white-space:nowrap}.ac-list__scroll{max-width:100%;overflow:auto}.ac-list table{width:100%;border-collapse:collapse}.ac-list th,.ac-list td{padding:10px 12px;border-bottom:1px solid var(--theme--border-color,#d9e1e8);text-align:left}.ac-list__pagination,.ac-list__controls,.ac-toolbar__actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ac-details{display:grid;grid-template-columns:minmax(120px,.7fr) minmax(0,1fr);gap:8px}.ac-details div{display:contents}.ac-details dt,.ac-details dd{margin:0;padding:8px;border-bottom:1px solid var(--theme--border-color,#d9e1e8);overflow-wrap:anywhere}@media(max-width:720px){.ac-shell{padding:16px}.ac-shell__header,.ac-toolbar{align-items:flex-start;flex-direction:column}.ac-shell__grid{grid-template-columns:minmax(0,1fr);gap:16px}.ac-shell__context{order:2}.ac-list__controls>*{min-width:0;max-width:100%}}
`;
/* Styles are rendered by AdminShell because Vue components do not mount arbitrary `.styles` properties. */
