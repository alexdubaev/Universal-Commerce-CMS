import { useApi } from "@directus/extensions-sdk";
import { defineComponent, h, ref } from "vue";
import { useRouter } from "vue-router";
import { createEditorState } from "../admin-state.mjs";
import { AdminShell, SectionTabs, EditorToolbar, NativeFieldGroup, MediaPicker, ReadonlyDetails } from "../admin-shell.js";
import { PageSectionEditor } from "../page-sections.js";

export const HOME_PAGE_FIELDS = Object.freeze(["id","status","h1","hero_title","hero_text","hero_image","hero_image_alt","hero_primary_button_text","hero_primary_button_url","hero_secondary_button_text","hero_secondary_button_url","hero_search_label","hero_search_placeholder","hero_search_button_text","hero_bulk_prompt","hero_bulk_link_text","hero_bulk_link_url","hero_excel_link_text","hero_excel_link_url","hero_photo_link_text","hero_photo_link_url","seo_title","seo_description","canonical_url","is_indexable","og_title","og_description","og_image","seo","sections","source_page","translations","created_at","updated_at"]);
const REQUIRED = Object.freeze(["h1","hero_title","hero_text","hero_image","hero_image_alt","hero_search_label","hero_search_placeholder","hero_search_button_text","hero_bulk_prompt","hero_bulk_link_text","hero_bulk_link_url","hero_excel_link_text","hero_excel_link_url","hero_photo_link_text","hero_photo_link_url"]);
const EDITABLE = Object.freeze(["h1","hero_title","hero_text","hero_image","hero_image_alt","hero_primary_button_text","hero_primary_button_url","hero_secondary_button_text","hero_secondary_button_url","hero_search_label","hero_search_placeholder","hero_search_button_text","hero_bulk_prompt","hero_bulk_link_text","hero_bulk_link_url","hero_excel_link_text","hero_excel_link_url","hero_photo_link_text","hero_photo_link_url","seo_title","seo_description","canonical_url","is_indexable","og_title","og_description","og_image","seo","translations"]);
const TABS = Object.freeze([
  { id: "main", label: "Основное", fields: ["h1"] },
  { id: "hero", label: "Первый экран", fields: ["hero_title","hero_text","hero_image","hero_image_alt","hero_primary_button_text","hero_primary_button_url","hero_secondary_button_text","hero_secondary_button_url","hero_search_label","hero_search_placeholder","hero_search_button_text","hero_bulk_prompt","hero_bulk_link_text","hero_bulk_link_url","hero_excel_link_text","hero_excel_link_url","hero_photo_link_text","hero_photo_link_url"] },
  { id: "sections", label: "Секции", fields: [] },
  { id: "seo", label: "SEO", fields: ["seo_title","seo_description","canonical_url","is_indexable","og_title","og_description","og_image","seo"] },
  { id: "other", label: "Дополнительно", fields: ["translations"] },
]);
const copy = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const unwrap = (response) => response?.data?.data;
const permitted = (perms, action, field) => perms?.[action] === true || (Array.isArray(perms?.[action]) && (perms[action].includes("*") || perms[action].includes(field)));
const parsePermission = (permission) => ["full", "partial"].includes(permission?.access) && Array.isArray(permission.fields) ? permission.fields : permission?.access === "none" ? [] : null;
const unwrapRecord = (response) => { const value = unwrap(response); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid singleton response"); return value; };
const safeHref = (value) => { if (value == null || value === "") return true; if (typeof value !== "string") return false; if (value.startsWith("/") && !value.startsWith("//")) return true; try { return ["https:","http:"].includes(new URL(value).protocol); } catch { return false; } };
const loadFailureText = (error) => {
  const message = String(error?.message ?? "");
  if (message.includes("Exactly one home_page record")) return "Для редактирования должна существовать ровно одна запись главной страницы. Проверьте данные экземпляра.";
  if (/permission|access|read access/i.test(message)) return "Не удалось подтвердить права чтения необходимых полей. Редактирование заблокировано.";
  if (/singleton|metadata|identity|version/i.test(message)) return "Не удалось подтвердить структуру записи главной страницы. Редактирование заблокировано.";
  return "Не удалось загрузить главную страницу. Проверьте соединение и повторите загрузку.";
};
const saveFailureText = (error) => {
  const status = error?.response?.status ?? error?.status;
  if (status === 403) return "Directus отклонил сохранение из-за недостатка прав. Ваши изменения сохранены на экране.";
  if (status === 404) return "Запись главной страницы больше недоступна. Ваши изменения сохранены на экране.";
  return "Не удалось подтвердить сохранение. Ваши изменения сохранены на экране; сверьте текущие данные перед повтором.";
};

export function validateHomePage(values, metadata = []) {
  const byName = new Map((Array.isArray(metadata) ? metadata : Object.values(metadata ?? {})).map((field) => [field.field, field]));
  const errors = [];
  for (const field of REQUIRED) if (Object.hasOwn(values ?? {}, field) && byName.get(field)?.meta?.required && (values[field] == null || String(values[field]).trim() === "")) errors.push({ field, message: "Обязательное поле" });
  for (const field of ["hero_primary_button_url","hero_secondary_button_url","hero_bulk_link_url","hero_excel_link_url","hero_photo_link_url","canonical_url"]) if (Object.hasOwn(values ?? {}, field) && !safeHref(values[field])) errors.push({ field, message: "Допустимы только относительные ссылки или HTTP(S)" });
  return errors;
}

export function createHomePageController(api, options = {}) {
  let metadata = options.metadata ?? [];
  let permissions = options.permissions ?? null;
  let itemPermissions = null;
  let fileReadAccess = false;
  let versioning = false;
  let ready = false;
  let loading = false;
  let blockedReason = null;
  let parentStale = false;
  let childSaving = false;
  let childDirty = false;
  let childPermissions = null;
  let childMetadata = [];
  let openGeneration = 0;
  let tab = "hero";
  const state = createEditorState({ collection: "home_page", editableFields: EDITABLE, get permissions() { return permissions; }, get fieldMetadata() { return Object.fromEntries((Array.isArray(metadata) ? metadata : Object.values(metadata)).map((field) => [field.field, field])); }, guardedContract: true });
  const fieldsReadable = () => HOME_PAGE_FIELDS.filter((field) => permitted(permissions, "read", field));
  const loader = async (id) => {
    const values = unwrapRecord(await api.get("/items/home_page", { params: { fields: fieldsReadable().join(",") } }));
    if (String(values.id) !== String(id) || !Object.hasOwn(values, "updated_at")) throw new Error("Invalid singleton identity/version");
    return values;
  };
  const fetchPermissions = async (id) => {
    const allPermissions = unwrap(await api.get("/permissions/me"));
    const collection = allPermissions?.home_page;
    if (!collection || !parsePermission(collection.read) || !parsePermission(collection.update)) throw new Error("Effective home_page permissions are unavailable");
    permissions = { read: parsePermission(collection.read), update: parsePermission(collection.update) };
    options.onPermissions?.(permissions);
    const fileRead = parsePermission(allPermissions?.directus_files?.read);
    fileReadAccess = permitted({ read: fileRead }, "read", "id");
    options.onFileReadAccess?.(fileReadAccess);
    const child = allPermissions?.page_sections;
    if (child && parsePermission(child.read) && parsePermission(child.update)) childPermissions = { read: parsePermission(child.read), update: parsePermission(child.update) };
    options.onChildPermissions?.(childPermissions);
    const item = unwrap(await api.get(`/permissions/me/home_page/${encodeURIComponent(id)}`));
    if (typeof item?.update?.access !== "boolean") throw new Error("Singleton item update permission is unavailable");
    itemPermissions = { read: null, update: item.update.access };
  };
  async function open() {
    const request = ++openGeneration;
    ready = false; loading = true; blockedReason = null; notify();
    try {
      const collection = unwrap(await api.get("/collections/home_page"));
      if (request !== openGeneration) return { ok: false, stale: true };
      if (collection?.collection !== "home_page" || collection.meta?.singleton !== true) throw new Error("home_page is not a confirmed singleton collection");
      versioning = collection.meta.versioning === true;
      const fieldResponse = unwrap(await api.get("/fields/home_page"));
      if (request !== openGeneration) return { ok: false, stale: true };
      const fields = Array.isArray(fieldResponse) ? fieldResponse : [];
      const names = new Set(fields.map((field) => field.field));
      if (HOME_PAGE_FIELDS.some((field) => !names.has(field))) throw new Error("home_page field metadata is incomplete");
      metadata = fields; options.onMetadata?.(fields);
      const childFieldResponse = unwrap(await api.get("/fields/page_sections"));
      if (request !== openGeneration) return { ok: false, stale: true };
      childMetadata = Array.isArray(childFieldResponse) ? childFieldResponse : [];
      options.onChildMetadata?.(childMetadata);
      const count = unwrap(await api.get("/items/home_page", { params: { "aggregate[count]": "id" } }));
      if (request !== openGeneration) return { ok: false, stale: true };
      const cardinality = Number(count?.count?.id);
      if (cardinality !== 1) throw new Error("Exactly one home_page record is required");
      const preliminary = unwrapRecord(await api.get("/items/home_page", { params: { fields: ["id"].join(",") } }));
      if (request !== openGeneration) return { ok: false, stale: true };
      if (preliminary.id == null) throw new Error("Singleton id is unavailable");
      await fetchPermissions(preliminary.id);
      if (request !== openGeneration) return { ok: false, stale: true };
      if (!["id","updated_at","source_page"].every((field) => permitted(permissions, "read", field))) throw new Error("Read access to singleton identity, version and source_page is required");
      if (!Object.hasOwn(permissions, "update")) throw new Error("Update permission is unavailable");
      const loaded = await state.load(loader, preliminary.id);
      if (request !== openGeneration) return { ok: false, stale: true };
      if (!loaded.ok) throw loaded.error ?? new Error("Singleton could not be read");
      itemPermissions.read = true;
      ready = true;
      return { ok: true };
    } catch (error) { if (request !== openGeneration) return { ok: false, stale: true }; blockedReason = error; return { ok: false, error }; }
    finally { if (request === openGeneration) { loading = false; notify(); } }
  }
  const canWrite = () => ready && !blockedReason && !parentStale && !childSaving && !state.saving && !state.conflict && !state.writeUncertain && itemPermissions?.update === true && EDITABLE.some((field) => state.canWrite(field));
  const change = (field, value) => canWrite() && state.change(field, value);
  const changeTab = (id, values) => canWrite() && TABS.some((candidate) => candidate.id === id) && state.changeTab(TABS.find((candidate) => candidate.id === id).fields, values);
  const selectTab = (id) => { if (!TABS.some((candidate) => candidate.id === id) || childSaving) return false; tab = id; return true; };
  async function save() {
    if (!canWrite()) return { ok: false, reason: "unavailable" };
    const errors = validateHomePage(state.values, options.metadata ?? metadata);
    if (errors.length) return { ok: false, reason: "validation", errors };
    const pendingSave = state.save(async (_collection, id, payload) => {
      const forbidden = Object.keys(payload.changes).some((field) => !EDITABLE.includes(field) || ["status","source_page","sections","id","created_at","updated_at"].includes(field));
      if (forbidden) throw new Error("Protected field in save payload");
      if (!itemPermissions?.update) throw new Error("Singleton item update permission is denied");
      return unwrap(await api.post(`/commerce/mutations/home_page/${encodeURIComponent(id)}`, payload));
    });
    notify();
    const result = await pendingSave;
    if (!result.ok) { notify(); return result; }
    try {
      const pendingRefresh = state.reconcile(loader, state.identity, { keepEdits: false });
      notify();
      const reconciled = await pendingRefresh;
      if (!reconciled.ok) throw reconciled.error;
      parentStale = false;
      notify(); return { ok: true, record: reconciled.record };
    } catch (error) { blockedReason = error; notify(); return { ok: false, committed: true, reason: "refetch", error }; }
  }
  async function reconcile({ keepEdits = false } = {}) {
    const pending = state.reconcile(loader, state.identity, { keepEdits });
    notify();
    const result = await pending;
    if (result.ok) { blockedReason = null; parentStale = false; }
    notify();
    return result;
  }
  async function compare() {
    if (!ready || state.identity == null) return { ok: false, reason: "unavailable" };
    try { return { ok: true, own: state.values, remote: await loader(state.identity) }; }
    catch (error) { return { ok: false, error }; }
  }
  function childState(next = {}) {
    childDirty = Boolean(next.dirty); childSaving = Boolean(next.saving);
    if (next.saved) {
      if (state.dirty) parentStale = true;
      else void state.reconcile(loader, state.identity, { keepEdits: false }).then((result) => { if (result.ok) blockedReason = null; notify(); });
    }
    notify();
  }
  const snapshot = () => ({ ready, loading, readonly: !canWrite(), canWrite: canWrite(), fileReadAccess, tab, values: state.values, baseline: state.baseline, dirty: state.dirty || childDirty, parentDirty: state.dirty, childDirty, childSaving, parentStale, blockedReason, versioning, saving: state.saving, conflict: state.conflict, writeUncertain: state.writeUncertain, readError: state.readError, saveError: state.saveError, canSave: canWrite() && state.canSave, childMetadata: copy(childMetadata), childPermissions: copy(childPermissions) });
  const notify = () => options.onChange?.(snapshot());
  return { open, save, reconcile, compare, change, changeTab, selectTab, childState, snapshot, state };
}

const fieldLabels = { h1: "SEO H1", hero_title: "Заголовок первого экрана", hero_text: "Текст первого экрана", hero_image: "Изображение первого экрана", hero_image_alt: "Альтернативный текст изображения", hero_primary_button_text: "Текст основной кнопки", hero_primary_button_url: "Ссылка основной кнопки", hero_secondary_button_text: "Текст второй кнопки", hero_secondary_button_url: "Ссылка второй кнопки", hero_search_label: "Подпись поиска", hero_search_placeholder: "Подсказка поиска", hero_search_button_text: "Кнопка поиска", hero_bulk_prompt: "Текст загрузки списка", hero_bulk_link_text: "Текст ссылки списка", hero_bulk_link_url: "Ссылка списка", hero_excel_link_text: "Текст ссылки Excel", hero_excel_link_url: "Ссылка Excel", hero_photo_link_text: "Текст ссылки фото", hero_photo_link_url: "Ссылка фото", seo_title: "Заголовок SEO", seo_description: "Описание SEO", canonical_url: "Канонический URL", is_indexable: "Разрешить индексацию", og_title: "Заголовок Open Graph", og_description: "Описание Open Graph", og_image: "Изображение Open Graph", seo: "SEO JSON", translations: "Переводы", title: "Заголовок секции", section_type: "Тип блока", is_visible: "Показывать секцию", text: "Текст секции", subtitle: "Подзаголовок", image: "Изображение секции", image_alt: "Альтернативный текст изображения", button_text: "Текст кнопки", button_url: "Ссылка кнопки", items: "Элементы", settings: "Настройки", translations: "Переводы" };
const labels = { ariaLabel: "Секции главной страницы", listTitle: "Секции главной страницы", loadingList: "Загружаем секции…", listError: "Не удалось загрузить секции. Изменение отключено.", emptyList: "Секций пока нет.", saveLabel: "Сохранить секцию", previous: "Назад", next: "Далее", page: "Страница", currentRecord: "Текущая версия", yourValues: "Ваши изменения", type: "Тип", status: "Статус", order: "Порядок", visible: "Видна", hidden: "Скрыта", visibilityUnavailable: "Видимость недоступна", unknownValue: "Недоступно", unknownSection: "Секция без названия", saved: "Секция сохранена.", retry: "Повторить", selectPrompt: "Выберите секцию, чтобы открыть её поля Directus.", loadingSection: "Загружаем секцию…", readError: "Не удалось прочитать секцию.", reconcileNeeded: "Сохранение нужно сверить с текущей версией перед новой попыткой.", compare: "Сравнить текущую версию", keepEdits: "Обновить и оставить мои изменения", useCurrent: "Загрузить текущие значения", supportNote: "Сохранение секции изменяет только её поля. Неизвестный тип остаётся без преобразований и может не отображаться витриной.", blockedParent: "Главная страница изменилась, пока были несохранённые правки секции.", discardAndContinue: "Отбросить правки и продолжить", editingUnavailable: "Редактирование недоступно без подтверждённого контракта и прав на поля.", displayUnavailable: "Сведения секции недоступны", statusValues: { published: "Опубликована", draft: "Черновик", archived: "В архиве" }, groups: { content: "Содержимое", main: "Настройки секции", group_content: "Содержимое", group_main: "Настройки секции", button: "Кнопки", group_button: "Кнопки", items: "Элементы", group_items: "Элементы", system: "Системные сведения", group_system: "Системные сведения", details: "Дополнительно", hero: "Первый экран", links: "Ссылки", seo: "SEO", advanced: "Дополнительно", settings: "Настройки", other: "Прочее" }, fields: fieldLabels };

export const HomePageSection = defineComponent({
  name: "HomePageSection",
  setup() {
    const api = useApi(); const router = useRouter();
    const revision = ref(0); const metadata = ref([]); const childMetadata = ref([]); const permissions = ref({}); const childPermissions = ref({}); const fileReadAccess = ref(false); const activeTab = ref("hero"); const error = ref(null); const validationErrors = ref([]); const comparison = ref(null); const child = ref({ dirty: false, saving: false });
    const controller = createHomePageController(api, { get metadata() { return metadata.value; }, onMetadata: (value) => { metadata.value = value; }, onPermissions: (value) => { permissions.value = value; }, onFileReadAccess: (value) => { fileReadAccess.value = value; }, onChildMetadata: (value) => { childMetadata.value = value; }, onChildPermissions: (value) => { childPermissions.value = value ?? {}; }, onChange: () => { revision.value++; } });
    const snapshot = () => { revision.value; return controller.snapshot(); };
    const state = { get canSave() { return snapshot().canSave; }, get dirty() { return snapshot().dirty; }, get loading() { return snapshot().loading; }, get saving() { return snapshot().saving; }, get conflict() { return snapshot().conflict; }, get writeUncertain() { return snapshot().writeUncertain; }, get readError() { return snapshot().readError; }, get saveError() { return snapshot().saveError; } };
    const refresh = async () => { await controller.open(); error.value = null; revision.value++; };
    const save = async () => {
      const result = await controller.save();
      validationErrors.value = result.errors ?? [];
      const latest = controller.snapshot();
      error.value = result.ok || latest.conflict || latest.writeUncertain ? null : result.errors?.length ? `Проверьте поле «${fieldLabels[result.errors[0].field] ?? result.errors[0].field}»: ${result.errors[0].message}` : saveFailureText(result.error);
      revision.value++;
    };
    const retry = async ({ keepEdits = true } = {}) => { const result = await controller.reconcile({ keepEdits }); error.value = result.ok ? null : saveFailureText(result.error); if (result.ok) comparison.value = null; revision.value++; };
    const compare = async () => { const result = await controller.compare(); comparison.value = result.ok ? result : null; error.value = result.ok ? null : result.error; revision.value++; };
    void refresh();
    const input = (fields, current, baseline, readonly, ownerTab) => {
      const subset = [...fields]; const renderedIdentity = baseline.id;
      const pairedFields = new Set(["hero_primary_button_text","hero_primary_button_url","hero_secondary_button_text","hero_secondary_button_url","hero_search_label","hero_search_placeholder"]);
      const nativeMetadata = metadata.value.map((field) => ({ ...field, name: fieldLabels[field.field] ?? field.name ?? field.field, meta: { ...field.meta, ...(pairedFields.has(field.field) ? { width: "half" } : {}) } }));
      return h(NativeFieldGroup, { metadata: nativeMetadata, fieldSubset: subset, primaryKey: renderedIdentity, initialValues: baseline, modelValue: current, permissions: permissions.value, readonly, disabled: snapshot().saving || snapshot().childSaving, validationErrors: validationErrors.value.filter((item) => subset.includes(item.field)).map((item) => ({ ...item, message: `${fieldLabels[item.field] ?? item.field}: ${item.message}` })), "onUpdate:modelValue": (next) => { if (activeTab.value !== ownerTab || String(controller.snapshot().baseline?.id) !== String(renderedIdentity)) return; for (const field of subset) controller.change(field, Object.hasOwn(next ?? {}, field) ? next[field] : baseline[field]); revision.value++; } });
    };
    const renderPanel = (entry, current, baseline, readonly) => {
      const nativeInput = (fields) => input(fields, current, baseline, readonly, entry.id);
      if (entry.id === "main") return h("div", { class: "home-page-fields" }, [h("section", { class: "home-page-form-section" }, [h("h2", "Основные сведения"), nativeInput(["h1"]), h(NativeFieldGroup, { metadata: metadata.value, fieldSubset: ["source_page"], primaryKey: baseline.id, initialValues: baseline, modelValue: current, permissions: permissions.value, readonly: true, disabled: true })])]);
      if (entry.id === "hero") {
        const heroMetadata = { ...(metadata.value.find((field) => field.field === "hero_image") ?? {}), name: fieldLabels.hero_image };
        const advancedFields = ["hero_search_label","hero_search_placeholder","hero_search_button_text","hero_bulk_prompt","hero_bulk_link_text","hero_bulk_link_url","hero_excel_link_text","hero_excel_link_url","hero_photo_link_text","hero_photo_link_url"];
        return h("div", { class: "home-page-hero-layout" }, [
          h("div", { class: "home-page-hero-copy" }, [h("section", { class: "home-page-form-section" }, [h("h2", "Текст первого экрана"), h("p", { class: "home-page-intro" }, "Заголовок и пояснение, которые увидит посетитель."), nativeInput(["hero_title","hero_text"])]), h("section", { class: "home-page-form-section home-page-buttons" }, [h("h2", "Кнопки первого экрана"), nativeInput(["hero_primary_button_text","hero_primary_button_url","hero_secondary_button_text","hero_secondary_button_url"])]), h("details", { class: "home-page-advanced", open: validationErrors.value.some((item) => advancedFields.includes(item.field)) }, [h("summary", [h("strong", "Поиск и запрос списком"), h("span", "Подписи, текст поиска и ссылки на способы обращения")]), nativeInput(advancedFields)])]),
          h("div", { class: "home-page-hero-media" }, [h("h2", "Изображение главного экрана"), h(MediaPicker, { field: heroMetadata, primaryKey: baseline.id, initialValue: { hero_image: baseline.hero_image }, modelValue: current.hero_image ?? null, permissions: permissions.value, readonly, disabled: snapshot().saving || snapshot().childSaving, allowSelect: fileReadAccess.value, allowUpload: false, "onUpdate:modelValue": (value) => { if (activeTab.value === "hero" && String(controller.snapshot().baseline?.id) === String(baseline.id)) controller.change("hero_image", value); revision.value++; } }), nativeInput(["hero_image_alt"])])
        ]);
      }
      if (entry.id === "seo") return h("div", { class: "home-page-seo-layout" }, [h("div", [h("h2", "SEO и индексирование"), nativeInput(entry.fields)]), h("aside", { class: "home-page-seo-snippet" }, [h("small", "Локальный пример сниппета"), h("p", "Подсказка по введённым текстам, не фактическая выдача поисковика."), h("small", current.canonical_url || "Адрес главной страницы"), h("strong", current.seo_title || current.h1 || "Заголовок страницы"), h("p", current.seo_description || current.hero_text || "Описание страницы")])]);
      if (entry.id === "other") return h("div", { class: "home-page-fields" }, [nativeInput(entry.fields), h("section", { class: "home-page-form-section" }, [h("h2", "Системные сведения"), h(ReadonlyDetails, { values: baseline, fields: [{ field: "id", label: "Идентификатор" }, { field: "created_at", label: "Создано" }, { field: "updated_at", label: "Изменено" }] })])]);
      return h("div", { class: "home-page-fields" }, nativeInput(entry.fields));
    };
    return () => {
      const current = snapshot(); const baseline = current.baseline ?? {}; const values = current.values ?? {}; const readonly = current.readonly;
      const statusLabel = values.status === "published" ? "Опубликована" : values.status === "draft" ? "Черновик" : values.status === "archived" ? "В архиве" : values.status ?? "Статус недоступен";
      const childEditor = h("div", { hidden: activeTab.value !== "sections", class: "home-page-section-editor" }, [h(PageSectionEditor, { parentCollection: "home_page", parentId: baseline.id, api, metadata: Object.fromEntries(childMetadata.value.map((field) => [field.field, { ...field, name: fieldLabels[field.field] ?? field.name ?? field.field }])), editableFields: ["title","section_type","is_visible","text","subtitle","image","image_alt","button_text","button_url","items","settings","translations"], displayFields: ["status","sort_order"], permissions: childPermissions.value, guardedContract: true, labels, readonly: current.saving || current.conflict || current.writeUncertain || current.parentStale || child.value.saving, onStateChange: (next) => { child.value = { ...child.value, ...next }; controller.childState(next); revision.value++; }, onSaved: () => { controller.childState({ ...child.value, saved: true }); revision.value++; } })]);
      const panels = current.ready ? TABS.map((entry) => h("section", { key: entry.id, hidden: activeTab.value !== entry.id, class: `home-page-tab home-page-tab--${entry.id}` }, entry.id === "sections" ? childEditor : renderPanel(entry, values, baseline, readonly))) : [];
      const tabs = current.ready ? h(SectionTabs, { tabs: TABS.map(({ id, label }) => ({ id, label })), modelValue: activeTab.value, disabled: current.loading || current.saving || current.childSaving, "onUpdate:modelValue": (id) => { if (controller.selectTab(id)) { activeTab.value = id; revision.value++; } } }, { default: () => panels }) : null;
      const renderComparison = () => {
        if (!comparison.value) return h("p", { role: "status" }, "Сравните текущую версию, чтобы увидеть различающиеся доступные поля.");
        const rows = EDITABLE.filter((field) => Object.hasOwn(comparison.value.own ?? {}, field) && Object.hasOwn(comparison.value.remote ?? {}, field) && JSON.stringify(comparison.value.own[field]) !== JSON.stringify(comparison.value.remote[field])).map((field) => h("article", { key: field }, [
          h("strong", fieldLabels[field] ?? field),
          h("div", [h("small", "Текущая версия"), h("span", JSON.stringify(comparison.value.remote[field] ?? "—"))]),
          h("div", [h("small", "Ваши изменения"), h("span", JSON.stringify(comparison.value.own[field] ?? "—"))]),
        ]));
        return h("div", { class: "home-page-conflict-diff" }, rows.length ? rows : h("p", "Различий в доступных полях нет."));
      };
      const hasPendingOutcome = current.conflict || current.writeUncertain;
      const conflictPanel = hasPendingOutcome ? h("section", { class: "home-page-conflict", role: "region", "aria-label": "Сверка текущей версии" }, [
        h("div", [h("h2", current.conflict ? "Запись изменилась в другом окне" : "Результат сохранения не подтверждён"), h("p", current.conflict ? "Сервер отклонил сохранение из-за изменения записи. Ваши правки сохранены; сравните значения перед решением." : "Запрос мог быть применён. Сверьте данные перед следующей попыткой.")]),
        h("div", { class: "home-page-conflict-actions" }, [h("button", { type: "button", disabled: current.saving, onClick: compare }, "Сравнить текущую версию"), h("button", { type: "button", disabled: current.saving, onClick: () => retry({ keepEdits: true }) }, "Оставить мои изменения"), h("button", { type: "button", disabled: current.saving, onClick: () => retry({ keepEdits: false }) }, "Загрузить текущие значения")]),
        renderComparison(),
      ]) : null;
      const unavailablePanel = !current.ready ? current.loading ? h("p", { role: "status", class: "home-page-unavailable" }, "Загружаем главную страницу…") : current.blockedReason ? h("section", { role: "alert", class: "home-page-unavailable" }, [h("h2", "Главная страница недоступна"), h("p", loadFailureText(current.blockedReason)), h("button", { type: "button", disabled: current.loading, onClick: refresh }, "Повторить загрузку")]) : null : null;
      const shellReadonly = readonly && current.ready && !hasPendingOutcome;
      const toolbarState = { ...state, saveError: hasPendingOutcome ? null : state.saveError, conflict: false, writeUncertain: false, readonly: shellReadonly };
      return h(AdminShell, { title: "Главная страница", state: toolbarState, dirty: current.dirty, saving: current.saving || current.childSaving, readonly: shellReadonly, onRetry: refresh }, {
        conflict: () => conflictPanel,
        heading: () => [h("div", { class: "home-page-heading" }, [h("h1", "Главная страница"), h("span", { class: `home-page-status home-page-status--${values.status ?? "unknown"}` }, statusLabel)])],
        toolbar: () => h(EditorToolbar, { title: "", state: toolbarState, readonly: readonly || current.childSaving || current.parentStale, canPublish: false, onSave: save, onReconcile: retry, onBack: () => router.back() }),
        main: () => [h("style", null, `.home-page-heading{display:flex;align-items:center;gap:12px}.ac-shell__header:has(.home-page-heading) .home-page-heading h1{font-size:24px;line-height:1.2}.home-page-status{display:inline-flex;align-items:center;padding:6px 12px;border-radius:999px;background:#eaf3ed;color:#276342;font-size:13px;font-weight:600}.home-page-tab{min-width:0}.home-page-fields{min-width:0}.home-page-form-section+ .home-page-form-section{border-top:1px solid var(--theme--border-color,#e1e8f0);margin-top:23px;padding-top:22px}.home-page-form-section h2{font-size:15px;margin:0 0 15px}.home-page-hero-layout{display:grid;grid-template-columns:minmax(0,1.07fr) minmax(320px,.89fr);gap:30px;align-items:start}.home-page-hero-copy,.home-page-hero-media{min-width:0}.home-page-tab .field-label-content{font-size:13px}.home-page-tab .v-input,.home-page-tab .v-input>.input{height:40px;min-height:40px}.home-page-tab .v-input>.input input{height:38px;min-height:38px}.home-page-tab .v-textarea,.home-page-tab .v-textarea textarea{height:80px!important;min-height:80px!important}.home-page-tab .field{margin-bottom:12px}.home-page-tab [data-field=hero_image] .image.full.crop{height:250px!important;min-height:250px;max-height:250px;aspect-ratio:auto;background:repeating-linear-gradient(135deg,#eef3f9 0 18px,#e5edf6 18px 36px)}.home-page-tab [data-field=hero_image] .image-preview{height:250px!important;min-height:250px!important;max-height:250px!important}.home-page-tab [data-field=hero_image] .image-preview>img{width:100%;height:100%;object-fit:cover}.home-page-tab .home-page-intro{margin:-8px 0 14px;color:var(--theme--foreground-subdued,#78828c);font-size:13px}.home-page-buttons{border-top:1px solid var(--theme--border-color,#e1e8f0);margin-top:22px;padding-top:22px}.home-page-advanced{margin-top:20px;padding:16px;border:1px solid var(--theme--border-color,#dce1e5);border-radius:8px;background:#f9fbfd}.home-page-advanced summary{display:flex;flex-direction:column;gap:5px;cursor:pointer;list-style:none}.home-page-advanced summary::-webkit-details-marker{display:none}.home-page-advanced summary strong{font-size:14px}.home-page-advanced summary span{font-size:12px;color:var(--theme--foreground-subdued,#78828c)}.home-page-advanced[open]>:not(summary){margin-top:18px}.home-page-hero-media{padding:20px 18px;border:1px solid var(--theme--border-color,#dce1e5);border-radius:9px;background:var(--theme--background,#fff)}.home-page-hero-media h2{font-size:15px;margin:0 0 15px}.home-page-section-editor{min-width:0}.home-page-section-editor .page-section-editor{display:grid;grid-template-columns:minmax(260px,.74fr) minmax(0,1fr);gap:28px;align-items:start}.home-page-section-editor .page-sections-list{grid-column:1;grid-row:1 / span 8;max-height:560px;overflow:auto}.home-page-section-editor .page-sections-list>button{width:100%;margin:0 0 8px}.home-page-section-editor .page-sections-list h3{font-size:17px;margin:0 0 14px}.home-page-section-editor .ac-tabs__list{flex-wrap:wrap}.home-page-section-editor .page-section-editor> .ac-toolbar{margin-bottom:12px}.home-page-section-editor .ac-toolbar,.home-page-section-editor .ac-tabs,.home-page-section-editor .page-section-compare,.home-page-section-editor .page-section-support-note{grid-column:2}.home-page-seo-layout{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(280px,.88fr);gap:36px;align-items:start}.home-page-seo-snippet{padding:20px 18px;border:1px solid var(--theme--border-color,#dce1e5);border-radius:9px;background:var(--theme--background,#fff)}.home-page-seo-snippet strong{display:block;color:#244fab;font-size:17px;line-height:1.3;margin:8px 0 3px}.home-page-seo-snippet small{color:#4a8a62}.home-page-seo-snippet p{color:var(--theme--foreground-subdued,#78828c);font-size:12px;line-height:1.55}.home-page-conflict{margin:16px 0;padding:16px;border:1px solid #d69a35;border-radius:8px;background:#fffaf0}.home-page-conflict h2{font-size:16px;margin:0 0 6px}.home-page-conflict p{margin:4px 0 12px}.home-page-conflict-actions{display:flex;flex-wrap:wrap;gap:8px}.home-page-conflict-actions button{min-height:40px;padding:8px 12px;border:1px solid var(--theme--border-color,#d9e1e8);border-radius:6px;background:var(--theme--background,#fff);color:var(--theme--foreground,#172b4d);font:inherit;cursor:pointer}.home-page-conflict-actions button:hover:not(:disabled){background:var(--theme--background-subdued,#f4f7fa)}.home-page-conflict-actions button:disabled{opacity:.6;cursor:not-allowed}.home-page-conflict-diff{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:14px}.home-page-conflict-diff article{min-width:0;padding:10px;border:1px solid var(--theme--border-color,#dce1e5);border-radius:6px}.home-page-conflict-diff article>div{display:flex;flex-direction:column;gap:3px;margin-top:8px}.home-page-conflict-diff small{color:var(--theme--foreground-subdued,#78828c)}.home-page-conflict-diff span{overflow-wrap:anywhere}.home-page-unavailable{max-width:720px;margin:24px auto;padding:20px;border:1px solid var(--theme--border-color,#dce1e5);border-radius:8px;background:var(--theme--background,#fff);color:var(--theme--foreground,#172b4d);line-height:1.5}.home-page-unavailable h2{margin:0 0 8px;font-size:18px}.home-page-unavailable p{margin:0 0 14px}.home-page-unavailable button{min-height:40px;padding:8px 12px;border:1px solid var(--theme--border-color,#d9e1e8);border-radius:6px;background:var(--theme--background,#fff);color:var(--theme--foreground,#172b4d);font:inherit;cursor:pointer}.home-page-unavailable button:disabled{opacity:.6;cursor:not-allowed}.home-page-unavailable-actions{margin-top:28px;color:var(--theme--foreground-subdued,#78828c);font-size:13px}@media(max-width:760px){.ac-shell__header:has(.home-page-heading){align-items:flex-start;flex-direction:column;gap:8px}.ac-shell__header:has(.home-page-heading) .ac-toolbar{width:100%;align-items:center;flex-direction:row}.ac-shell__header:has(.home-page-heading) .ac-toolbar>div:first-child{display:none}.ac-shell__header:has(.home-page-heading) .ac-toolbar__actions{width:100%;justify-content:flex-end}.home-page-section-editor .page-sections-list{max-height:240px}.home-page-hero-layout,.home-page-seo-layout,.home-page-section-editor .page-section-editor,.home-page-conflict-diff{grid-template-columns:minmax(0,1fr);gap:20px}.home-page-section-editor .page-sections-list,.home-page-section-editor .ac-toolbar,.home-page-section-editor .ac-tabs,.home-page-section-editor .page-section-compare,.home-page-section-editor .page-section-support-note{grid-column:1;grid-row:auto}.home-page-hero-media{padding:16px}}`), current.parentStale && current.ready ? h("div", { role: "alert" }, [h("p", "Секции обновили версию главной страницы. Сверьте изменения перед сохранением."), h("button", { type: "button", onClick: () => retry({ keepEdits: true }) }, "Обновить и сохранить мои изменения")]) : null, current.ready && current.values?.status === "published" && !hasPendingOutcome ? h("p", { role: "note" }, "Сохранение изменяет текущую опубликованную запись и не переводит её автоматически в черновик.") : null, !hasPendingOutcome && error.value ? h("p", { role: "alert" }, typeof error.value === "string" ? error.value : saveFailureText(error.value)) : null, unavailablePanel, tabs, current.ready ? h("p", { class: "home-page-unavailable-actions" }, "Предпросмотр и управление версиями недоступны в этой редакции.") : null],
      });
    };
  },
});
