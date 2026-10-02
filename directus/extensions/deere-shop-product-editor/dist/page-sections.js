import { computed, defineComponent, h, onBeforeUnmount, ref, watch } from "vue";
import { createEditorState } from "./admin-state.mjs";
import { NativeFieldGroup, SectionTabs, EditorToolbar, ReadonlyDetails } from "./admin-shell.js";

const COLLECTION = "page_sections";
const PAGE_SIZE = 25;
const REQUIRED = ["id", "updated_at", "page", "home_page"];
const SYSTEM_FIELDS = new Set(["id", "status", "page", "home_page", "sort_order", "created_at", "updated_at", "user_created", "user_updated"]);
const copy = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const allowed = (permissions, action, field) => permissions?.[action] === true ||
  (Array.isArray(permissions?.[action]) && (permissions[action].includes("*") || permissions[action].includes(field)));
const ownerField = (collection) => collection === "home_page" ? "home_page" : collection === "pages" ? "page" : null;
const metadataWritable = (metadata, field) => {
  const meta = metadata?.[field];
  return !meta || (meta.type !== "alias" && meta.readonly !== true && meta.schema?.is_generated !== true && meta.meta?.readonly !== true && !String(meta.field ?? field).startsWith("group_") &&
    !["group-detail", "presentation", "note"].includes(meta.meta?.interface));
};

function unwrapList(response) {
  const body = response?.data;
  if (!body || !Array.isArray(body.data)) throw new Error("Invalid page section list response");
  if (body.data.length > PAGE_SIZE) throw new Error("Page section list exceeded its page limit");
  const reportedTotal = body.meta?.filter_count ?? body.meta?.total_count;
  const total = reportedTotal == null ? null : Number(reportedTotal);
  if (total != null && (!Number.isSafeInteger(total) || total < body.data.length)) throw new Error("Invalid page section list count");
  return { rows: body.data, total };
}

function unwrapRecord(response) {
  const record = response?.data?.data;
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("Invalid page section response");
  return record;
}

export function createPageSectionController(config = {}) {
  let parentCollection = config.parentCollection;
  let owner = ownerField(parentCollection);
  let opposite = owner === "page" ? "home_page" : "page";
  const api = config.api;
  const rows = new Map();
  let parentId = config.parentId ?? null;
  let generation = 0;
  let ownerGeneration = 0;
  let page = 1;
  let total = null;
  let visiblePageIds = [];
  let listLoading = false;
  let listError = null;
  let listValid = false;
  let selectedId = null;
  let selectedLoading = false;
  let comparison = null;
  let disposed = false;
  let blockedTarget = null;
  const editableFields = [...new Set((config.editableFields ?? []).filter((field) => !SYSTEM_FIELDS.has(field)))];
  const canReadRequired = () => REQUIRED.every((field) => allowed(config.permissions, "read", field));

  const notify = () => config.onChange?.(controller.snapshot);
  const rowFor = (record) => {
    const id = String(record.id);
    let entry = rows.get(id);
    if (!entry) {
      const state = createEditorState({
        collection: COLLECTION, editableFields,
        get permissions() { return config.permissions; },
        fieldMetadata: config.metadata, get guardedContract() { return config.guardedContract === true; },
      });
      entry = { id: record.id, preview: copy(record), state, loadPromise: null };
      rows.set(id, entry);
    } else entry.preview = copy(record);
    return entry;
  };
  const getRow = (id) => rows.get(String(id)) ?? null;
  const isOwnerRecord = (record, expectedId = null) => record && String(record[owner] ?? "") === String(parentId ?? "") &&
    (record[opposite] == null || record[opposite] === "") && (expectedId == null || String(record.id) === String(expectedId));
  const fieldsForRead = () => [...new Set([...REQUIRED, ...editableFields.filter((field) => allowed(config.permissions, "read", field))])];
  const canWrite = () => {
    const requestedParent = config.getParent?.();
    return !disposed && listValid && config.guardedContract === true && config.readonly !== true &&
    (!requestedParent || requestedParent.collection === parentCollection && String(requestedParent.id) === String(parentId)) && allowed(config.permissions, "read", "id") &&
    allowed(config.permissions, "read", "updated_at") && editableFields.some((field) =>
      allowed(config.permissions, "read", field) && allowed(config.permissions, "update", field));
  };

  async function list(nextPage = 1) {
    const request = ++generation;
    if (!owner || parentId == null) { listValid = false; listError = new Error("Page sections need a pages or home_page parent"); notify(); return { ok: false, reason: "parent" }; }
    if (!canReadRequired()) { listValid = false; listError = new Error("Read permission for id, updated_at and both owner fields is required"); notify(); return { ok: false, reason: "permission" }; }
    if (!api?.get) { listValid = false; listError = new Error("Page section API is unavailable"); notify(); return { ok: false, reason: "api" }; }
    page = Math.max(1, Number(nextPage) || 1);
    listLoading = true;
    listError = null;
    listValid = false;
    notify();
    const params = {
      fields: fieldsForRead(), limit: PAGE_SIZE, page,
      sort: ["sort_order", "id"],
      filter: { _and: [{ [owner]: { _eq: parentId } }, { [opposite]: { _null: true } }] },
    };
    try {
      const result = unwrapList(await api.get(`/items/${COLLECTION}`, { params }));
      if (request !== generation || disposed) return { ok: false, stale: true };
      if (result.rows.some((record) => !record || record.id == null || record.updated_at == null ||
        record[owner] == null || String(record[owner]) !== String(parentId) || record[opposite] !== null)) {
        throw new Error("Page section list contained an invalid or differently owned row");
      }
      result.rows.forEach(rowFor);
      visiblePageIds = result.rows.map((record) => String(record.id));
      total = result.total;
      listValid = true;
      return { ok: true, rows: result.rows.map((record) => copy(record)), page, total };
    } catch (error) {
      if (request === generation) { listError = error; listValid = false; }
      return { ok: false, error };
    } finally {
      if (request === generation) { listLoading = false; notify(); }
    }
  }

  async function select(id, { discardEdits = false } = {}) {
    const entry = getRow(id);
    if (!entry || !listValid) return { ok: false, reason: "unavailable" };
    selectedId = entry.id;
    selectedLoading = false;
    comparison = null;
    if (entry.state.baseline && !entry.state.readError && !discardEdits) { notify(); return { ok: true, record: entry.state.baseline }; }
    selectedLoading = true;
    notify();
    const requestOwnerGeneration = ownerGeneration;
    const requestParentId = parentId;
    const requestOwner = owner;
    const requestOpposite = opposite;
    const loader = async (recordId, fields) => {
      const safeFields = [...new Set([...REQUIRED, ...fields])];
      const record = unwrapRecord(await api.get(`/items/${COLLECTION}/${recordId}`, { params: { fields: safeFields } }));
      if (ownerGeneration !== requestOwnerGeneration) throw new Error("Stale page section request");
      if (String(record.id) !== String(id) || String(record[requestOwner] ?? "") !== String(requestParentId) || record[requestOpposite] !== null) throw new Error("Page section response did not match its parent");
      return record;
    };
    const result = entry.state.readError
      ? await entry.state.reconcile(loader, entry.id, { keepEdits: true })
      : await entry.state.load(loader, entry.id, { discardEdits });
    if (String(selectedId) !== String(id) || ownerGeneration !== requestOwnerGeneration || disposed) return { ok: false, stale: true };
    selectedLoading = false;
    notify();
    return result;
  }

  function change(id, field, value) {
    const entry = getRow(id);
    if (!entry || String(selectedId) !== String(id) || !canWrite() || !allowed(config.permissions, "read", field) ||
      !allowed(config.permissions, "update", field) || !metadataWritable(config.metadata, field)) return false;
    const result = entry.state.change(field, value);
    if (result) notify();
    return result;
  }

  function changeTab(id, fields, values) {
    const entry = getRow(id);
    if (!entry || String(selectedId) !== String(id) || !canWrite()) return false;
    for (const field of fields ?? []) if (Object.hasOwn(values ?? {}, field) &&
      JSON.stringify(values[field] ?? null) !== JSON.stringify(entry.state.values[field] ?? null) &&
      (!allowed(config.permissions, "read", field) || !allowed(config.permissions, "update", field) || !metadataWritable(config.metadata, field))) return false;
    const result = entry.state.changeTab(fields, values);
    if (result) notify();
    return result;
  }

  async function save(id = selectedId) {
    const entry = getRow(id);
    if (!entry || String(selectedId) !== String(id) || !canWrite() || !entry.state.canSave || entry.state.dirtyFields.some((field) =>
      !allowed(config.permissions, "read", field) || !allowed(config.permissions, "update", field) || !metadataWritable(config.metadata, field))) return { ok: false, reason: "unavailable" };
    const requestOwnerGeneration = ownerGeneration;
    notify();
    const pending = entry.state.save(async (_collection, recordId, payload) => unwrapRecord(await api.post(`/commerce/mutations/${COLLECTION}/${recordId}`, payload)));
    notify();
    const result = await pending;
    if (ownerGeneration !== requestOwnerGeneration || disposed) return { ok: false, stale: true };
    notify();
    const requestedParent = config.getParent?.();
    if (requestedParent && (requestedParent.collection !== parentCollection || String(requestedParent.id) !== String(parentId))) {
      return { ok: false, stale: true };
    }
    if (result.ok) config.onSaved?.({ id: entry.id, record: result.record });
    else config.onError?.(result.error);
    return result;
  }

  async function compare(id = selectedId) {
    const entry = getRow(id);
    if (!entry || String(selectedId) !== String(id) || !entry.state.baseline || !api?.get) return { ok: false, reason: "unavailable" };
    const requestOwnerGeneration = ownerGeneration;
    const requestParentId = parentId;
    const requestOwner = owner;
    const requestOpposite = opposite;
    try {
      const remote = unwrapRecord(await api.get(`/items/${COLLECTION}/${entry.id}`, { params: { fields: fieldsForRead() } }));
      if (String(remote.id) !== String(id) || String(remote[requestOwner] ?? "") !== String(requestParentId) || remote[requestOpposite] !== null) throw new Error("Page section comparison did not match its parent");
      if (String(selectedId) !== String(id) || ownerGeneration !== requestOwnerGeneration || disposed) return { ok: false, stale: true };
      comparison = { remote: copy(remote), own: entry.state.values };
      notify();
      return { ok: true, remote: copy(remote), own: entry.state.values };
    } catch (error) { config.onError?.(error); return { ok: false, error }; }
  }

  async function reconcile(id = selectedId, { keepEdits = false } = {}) {
    const entry = getRow(id);
    if (!entry || String(selectedId) !== String(id) || !api?.get) return { ok: false, reason: "unavailable" };
    const requestOwnerGeneration = ownerGeneration;
    const requestParentCollection = parentCollection;
    const requestParentId = parentId;
    const requestOwner = owner;
    const requestOpposite = opposite;
    const result = await entry.state.reconcile(async (recordId, fields) => {
      const record = unwrapRecord(await api.get(`/items/${COLLECTION}/${recordId}`, { params: { fields: [...new Set([...REQUIRED, ...fields])] } }));
      if (ownerGeneration !== requestOwnerGeneration || String(record.id) !== String(id) || String(record[requestOwner] ?? "") !== String(requestParentId) || record[requestOpposite] !== null) throw new Error("Page section reconciliation did not match its parent");
      return record;
    }, entry.id, { keepEdits });
    if (ownerGeneration !== requestOwnerGeneration || parentCollection !== requestParentCollection || disposed) return { ok: false, stale: true };
    comparison = null;
    notify();
    return result;
  }

  function setParent(collection, id, { discardEdits = false } = {}) {
    if (collection === parentCollection && String(id) === String(parentId)) { blockedTarget = null; notify(); return true; }
    const saving = [...rows.values()].some((entry) => entry.state.saving);
    const dirty = [...rows.values()].some((entry) => entry.state.dirty);
    if (!ownerField(collection) || saving || (dirty && !discardEdits)) {
      blockedTarget = { collection, id };
      config.onNavigationBlocked?.({ from: { collection: parentCollection, id: parentId }, to: { collection, id } });
      notify();
      return false;
    }
    blockedTarget = null;
    ownerGeneration++;
    generation++;
    rows.clear(); selectedId = null; selectedLoading = false; comparison = null; visiblePageIds = []; page = 1; total = null; listValid = false;
    parentCollection = collection; owner = ownerField(collection); opposite = owner === "page" ? "home_page" : "page"; parentId = id;
    notify();
    return true;
  }

  function snapshot() {
    return {
      parentCollection, parentId, rows: visiblePageIds.map((id) => rows.get(id)).filter(Boolean).map((entry) => ({ id: entry.id, preview: copy(entry.preview),
        dirty: entry.state.dirty, loading: entry.state.loading, saving: entry.state.saving, conflict: entry.state.conflict,
        writeUncertain: entry.state.writeUncertain, readError: entry.state.readError, saveError: entry.state.saveError,
        saved: entry.state.saved, canSave: entry.state.canSave, baseline: entry.state.baseline, values: entry.state.values })),
      selectedId, selected: selectedId == null ? null : snapshotRow(getRow(selectedId)), page, total, listLoading, listError,
      listValid, selectedLoading, comparison: copy(comparison), blockedParent: Boolean(blockedTarget && (blockedTarget.collection !== parentCollection || String(blockedTarget.id) !== String(parentId))), canWrite: canWrite(),
      dirty: [...rows.values()].some((entry) => entry.state.dirty || entry.state.saving), saving: [...rows.values()].some((entry) => entry.state.saving),
    };
  }
  function snapshotRow(entry) {
    if (!entry) return null;
    const state = entry.state;
    return { id: entry.id, preview: copy(entry.preview), baseline: state.baseline, values: state.values, dirty: state.dirty,
      loading: state.loading, saving: state.saving, conflict: state.conflict, writeUncertain: state.writeUncertain,
      readError: state.readError, saveError: state.saveError, saved: state.saved, canSave: state.canSave,
      dirtyFields: state.dirtyFields };
  }

  const controller = {
    list, select, change, changeTab, save, compare, reconcile, setParent, getRow: (id) => snapshotRow(getRow(id)),
    get parentId() { return parentId; }, get parentCollection() { return parentCollection; },
    editorState: (id) => getRow(id)?.state ?? null,
    get dirty() { return [...rows.values()].some((entry) => entry.state.dirty || entry.state.saving); },
    get snapshot() { return snapshot(); }, dispose() { disposed = true; generation++; ownerGeneration++; },
  };
  return controller;
}

const fieldTabs = (fields, metadata) => {
  const grouped = new Map();
  for (const field of fields) {
    const key = metadata?.[field]?.meta?.group ?? "content";
    const label = String(key).replaceAll("_", " ");
    if (!grouped.has(key)) grouped.set(key, { id: key, label: label.charAt(0).toUpperCase() + label.slice(1), fields: [] });
    grouped.get(key).fields.push(field);
  }
  return [...grouped.values()];
};

export const PageSectionEditor = defineComponent({
  name: "PageSectionEditor",
  props: {
    parentCollection: { type: String, required: true }, parentId: { type: [String, Number], required: true },
    metadata: { type: Object, default: () => ({}) }, editableFields: { type: Array, default: () => [] },
    permissions: { type: Object, default: () => ({ read: false, update: false }) },
    guardedContract: { type: Boolean, default: false }, readonly: { type: Boolean, default: true }, api: { type: Object, required: true },
  },
  emits: ["dirty-change", "saved", "error", "navigation-blocked", "state-change"],
  setup(props, { emit }) {
    const revision = ref(0);
    const tabId = ref("content");
    const controllerConfig = {
      parentCollection: props.parentCollection, parentId: props.parentId, editableFields: props.editableFields,
      getParent: () => ({ collection: props.parentCollection, id: props.parentId }),
      get metadata() { return props.metadata; }, get permissions() { return props.permissions; },
      get guardedContract() { return props.guardedContract; }, get readonly() { return props.readonly; }, get api() { return props.api; },
      onChange: (snapshot) => { revision.value++; emit("dirty-change", snapshot.dirty); emit("state-change", { dirty: snapshot.dirty, saving: snapshot.saving }); },
      onSaved: (value) => emit("saved", value), onError: (error) => emit("error", error), onNavigationBlocked: (value) => emit("navigation-blocked", value) };
    const controller = createPageSectionController(controllerConfig);
    onBeforeUnmount(() => controller.dispose());
    const state = computed(() => { revision.value; return controller.snapshot; });
    const selected = computed(() => state.value.selected);
    const tabs = computed(() => fieldTabs(props.editableFields.filter((field) => !SYSTEM_FIELDS.has(field) && allowed(props.permissions, "read", field)), props.metadata));
    const activeTab = computed(() => tabs.value.find((tab) => tab.id === tabId.value) ?? tabs.value[0] ?? { id: "content", label: "Content", fields: [] });
    const nativeValues = computed(() => Object.fromEntries(activeTab.value.fields.map((field) => [field, selected.value?.values?.[field]]).filter(([, value]) => value !== undefined)));
    const selectRow = async (id) => { await controller.select(id); revision.value++; };
    const controllerChangeTab = (id, fields, next) => controller.changeTab(id, fields, next);
    watch(() => [props.parentCollection, props.parentId], ([collection, id]) => {
      if (controller.setParent(collection, id)) controller.list(1);
      revision.value++;
    }, { immediate: true });
    watch(() => [props.readonly, props.permissions, props.guardedContract, props.metadata], () => revision.value++);
    const retry = () => controller.list(state.value.page);
    const save = async () => { if (selected.value) await controller.save(selected.value.id); revision.value++; };
    const reconcile = async (options) => { if (selected.value) await controller.reconcile(selected.value.id, options); revision.value++; };
    const compare = async () => { if (selected.value) await controller.compare(selected.value.id); revision.value++; };
    const displayedFields = computed(() => [...new Set(["id", "updated_at", "page", "home_page", ...props.editableFields])]);
    const renderDetails = (values, fields) => h(ReadonlyDetails, { values, fields: fields.map((field) => ({ field, label: props.metadata?.[field]?.name ?? field })) });
    return () => {
      revision.value;
      const current = selected.value;
      const busy = Boolean(state.value.selectedLoading || current?.loading || current?.saving);
      const locked = Boolean(props.readonly || !state.value.canWrite || busy ||
          current?.readError || current?.conflict || current?.writeUncertain);
      const controls = [h("div", { class: "page-sections-list" }, [
        h("h3", "Page sections"),
        state.value.listLoading ? h("p", "Loading sections…") : null,
        state.value.listError ? h("div", { role: "alert" }, [h("p", "Sections could not be loaded. Writes are disabled."), h("button", { onClick: retry }, "Retry")]) : null,
        !state.value.listLoading && !state.value.listError && !state.value.rows.length ? h("p", "No sections on this page.") : null,
        ...state.value.rows.map((row) => h("button", { key: row.id, type: "button", disabled: !state.value.listValid,
          "aria-pressed": String(row.id) === String(state.value.selectedId), onClick: () => selectRow(row.id) },
          `${row.preview?.title || row.preview?.section_type || "Section"}${row.dirty ? " • Unsaved" : ""}`)),
        (state.value.page > 1 || state.value.total > PAGE_SIZE || state.value.total == null && state.value.rows.length === PAGE_SIZE) ? h("div", [h("button", { disabled: state.value.page <= 1, onClick: () => controller.list(state.value.page - 1) }, "Previous"),
          h("span", ` Page ${state.value.page} `), h("button", { disabled: state.value.total != null ? state.value.page * PAGE_SIZE >= state.value.total : state.value.rows.length < PAGE_SIZE, onClick: () => controller.list(state.value.page + 1) }, "Next")]) : null,
      ])];
      if (!current) controls.push(h("p", "Select a section to edit its native Directus fields."));
      else {
        const row = controller.getRow(current.id);
        controls.push(h(EditorToolbar, { title: row?.values?.title || row?.values?.section_type || "Page section", state: controller.editorState(row.id),
          readonly: locked, canPublish: false, onSave: save, onReconcile: reconcile, onBack: () => { controller.setParent(props.parentCollection, props.parentId); } }));
        if (state.value.selectedLoading) controls.push(h("p", "Loading section…"));
        if (row?.readError) controls.push(h("div", { role: "alert" }, [h("p", "This section could not be read."), h("button", { onClick: () => selectRow(row.id) }, "Retry") ]));
        if (row?.conflict || row?.writeUncertain) controls.push(h("div", { role: "alert" }, [h("p", "The save needs a fresh comparison before another write."), h("button", { onClick: compare }, "Compare current record"),
          h("button", { onClick: () => reconcile({ keepEdits: true }) }, "Keep my edits after reload"), h("button", { onClick: () => reconcile({ keepEdits: false }) }, "Use current values") ]));
        if (tabs.value.length) controls.push(h(SectionTabs, { tabs: tabs.value.map(({ id, label }) => ({ id, label })), modelValue: activeTab.value.id, disabled: busy,
          "onUpdate:modelValue": (value) => { tabId.value = value; } }));
        const renderedFields = activeTab.value.fields;
        const renderedTabId = activeTab.value.id;
        const renderedRowId = row?.id;
        controls.push(h(NativeFieldGroup, { metadata: props.metadata, fieldSubset: renderedFields, primaryKey: renderedRowId,
          initialValues: row?.baseline ?? {}, modelValue: nativeValues.value, permissions: props.permissions,
          readonly: locked, disabled: locked, validationErrors: [],
          "onUpdate:modelValue": (next) => {
            if (String(controller.snapshot.selectedId) !== String(renderedRowId) || activeTab.value.id !== renderedTabId) return;
            controllerChangeTab(renderedRowId, renderedFields, next);
          } }));
        if (row?.saveError) controls.push(h("p", { role: "alert" }, row.saveError.message));
        if (row?.saved) controls.push(h("p", { role: "status" }, "Section saved."));
        if (state.value.comparison) controls.push(h("section", { class: "page-section-compare" }, [h("h4", "Current record"), renderDetails(state.value.comparison.remote, displayedFields.value), h("h4", "Your values"), renderDetails(state.value.comparison.own, displayedFields.value)]));
        controls.push(h("p", { class: "page-section-support-note" }, "This editor preserves the section fields and JSON values. It does not imply that every section type is rendered by the storefront."));
      }
      if (state.value.blockedParent) controls.push(h("div", { role: "alert" }, [h("p", "This parent changed while section edits were pending."),
        h("button", { onClick: () => { if (controller.setParent(props.parentCollection, props.parentId, { discardEdits: true })) controller.list(1); } }, "Discard pending edits and continue")]));
      if (!state.value.canWrite && !props.readonly && state.value.listValid) controls.push(h("p", { role: "note" }, "Editing is disabled until the guarded update contract and field permissions are available."));
      return h("section", { class: "page-section-editor", "aria-label": "Page sections" }, controls);
    };
  },
});
