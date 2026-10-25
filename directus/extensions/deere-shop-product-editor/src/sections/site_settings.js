import { useApi } from "@directus/extensions-sdk";
import { defineComponent, h, onMounted, onUnmounted, ref, resolveComponent } from "vue";
import { createEditorState } from "../admin-state.mjs";
import { AdminShell, SectionTabs, EditorToolbar, NativeFieldGroup, MediaPicker, ReadonlyDetails } from "../admin-shell.js";

export const siteSettingsFields = Object.freeze([
  "company_name", "legal_name", "inn", "kpp", "ogrn", "legal_address", "vat_info", "requisites_url", "documents_url",
  "phone", "email", "address", "city", "working_hours", "delivery_region",
  "logo", "favicon", "company_image", "primary_color", "accent_color", "primary_cta_text", "primary_cta_url", "footer_text", "footer_disclaimer",
  "seo_title", "seo_description", "og_title", "og_description", "default_og_image",
]);
const DISPLAY_ONLY_FIELDS = Object.freeze(["messengers", "social_links"]);
const KNOWN_FIELDS = new Set([...siteSettingsFields, ...DISPLAY_ONLY_FIELDS]);
const FILE_FIELDS = new Set(["logo", "favicon", "company_image", "default_og_image"]);
const FIELD_GROUPS = Object.freeze([
  { id: "overview", label: "Обзор", fields: ["company_name", "phone", "email", "city", "primary_color", "seo_title"] },
  { id: "company", label: "Компания", fields: ["company_name", "legal_name", "inn", "kpp", "ogrn", "legal_address", "vat_info", "requisites_url", "documents_url"] },
  { id: "contacts", label: "Контакты", fields: ["phone", "email", "address", "city", "working_hours", "delivery_region", "messengers", "social_links"] },
  { id: "appearance", label: "Оформление", fields: ["logo", "favicon", "company_image", "primary_color", "accent_color", "primary_cta_text", "primary_cta_url", "footer_text", "footer_disclaimer"] },
  { id: "search", label: "Поиск и соцсети", fields: ["seo_title", "seo_description", "og_title", "og_description", "default_og_image"] },
]);
const LABELS = Object.freeze({ company_name: "Название компании", legal_name: "Юридическое название", inn: "ИНН", kpp: "КПП", ogrn: "ОГРН", legal_address: "Юридический адрес", vat_info: "НДС", requisites_url: "Ссылка на реквизиты", documents_url: "Ссылка на документы", phone: "Телефон", email: "Электронная почта", address: "Адрес", city: "Город", working_hours: "Часы работы", delivery_region: "Регион доставки", messengers: "Мессенджеры", social_links: "Социальные сети", logo: "Логотип", favicon: "Иконка сайта", company_image: "Изображение компании", primary_color: "Основной цвет", accent_color: "Акцентный цвет", primary_cta_text: "Текст главной кнопки", primary_cta_url: "Ссылка главной кнопки", footer_text: "Текст подвала", footer_disclaimer: "Оговорка в подвале", seo_title: "SEO-заголовок", seo_description: "SEO-описание", og_title: "Заголовок для соцсетей", og_description: "Описание для соцсетей", default_og_image: "Изображение для соцсетей" });
const READONLY_FIELDS = new Set(DISPLAY_ONLY_FIELDS);
const unwrap = (response) => response?.data?.data;
const permitted = (permissions, action, field) => permissions?.[action] === true || (Array.isArray(permissions?.[action]) && (permissions[action].includes("*") || permissions[action].includes(field)));
const parsedAccess = (permission) => ["full", "partial"].includes(permission?.access) && Array.isArray(permission.fields) ? permission.fields : permission?.access === "none" ? [] : null;
const plainRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null));
const loadFailureText = (error) => {
  const status = error?.response?.status ?? error?.status;
  if (status === 401 || status === 403) return "Не удалось подтвердить права чтения настроек. Редактирование отключено.";
  if (/singleton|cardinality|metadata|identity|version|структур|единственност|типов полей/i.test(String(error?.message ?? ""))) return "Не удалось подтвердить структуру и единственность настроек сайта. Редактирование отключено.";
  return "Не удалось загрузить настройки сайта. Проверьте доступ и повторите чтение.";
};
const saveFailureText = (error) => {
  const status = error?.response?.status ?? error?.status;
  if (status === 401 || status === 403) return "Directus отклонил изменение. Ваши правки сохранены на экране; проверьте доступ.";
  const code = error?.code ?? error?.response?.data?.errors?.[0]?.extensions?.code;
  if (code === "INVALID_PAYLOAD") return "Не удалось подключить выбранный файл или сохранить значение. Выберите доступный файл; ваши правки сохранены на экране.";
  return "Не удалось подтвердить сохранение. Правки сохранены на экране; сначала проверьте результат.";
};
export function isConfirmedSingleton({ count, fullRead } = {}) { const value = count?.id; const cardinality = typeof value === "number" && Number.isSafeInteger(value) ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN; return fullRead === true && plainRecord(count) && cardinality === 1; }
export function isRecordIdentity(record, identity) { return plainRecord(record) && record.id != null && String(record.id) === String(identity) && Object.hasOwn(record, "updated_at"); }

export function createSiteSettingsState(options = {}) {
  const permissions = options.permissions ?? {};
  const contract = options.guardedContract === true;
  const fieldMetadata = { ...(options.fieldMetadata ?? {}) };
  for (const field of READONLY_FIELDS) fieldMetadata[field] = { ...(fieldMetadata[field] ?? {}), meta: { ...(fieldMetadata[field]?.meta ?? {}), readonly: true } };
  const state = createEditorState({ collection: "site_settings", editableFields: siteSettingsFields, permissions, fieldMetadata, guardedContract: contract });
  const adapter = {
    load: state.load, change: contract ? state.change : () => false, changeTab: contract ? state.changeTab : () => false, reconcile: state.reconcile,
    save: contract ? state.save : async () => ({ ok: false, reason: "contract" }),
    payload: () => contract ? state.payload() : null,
    get collection() { return state.collection; }, get identity() { return state.identity; }, get baseline() { return state.baseline; }, get values() { return state.values; },
    get dirty() { return state.dirty; }, get dirtyFields() { return state.dirtyFields; }, get canSave() { return contract && state.canSave; },
    get loading() { return state.loading; }, get saving() { return state.saving; }, get conflict() { return state.conflict; }, get writeUncertain() { return state.writeUncertain; },
    get readError() { return state.readError; }, get saveError() { return state.saveError; }, get saved() { return state.saved; }, canWrite: state.canWrite,
  };
  async function load(loader, identity, proof) {
    if (!isConfirmedSingleton(proof)) return { ok: false, reason: "singleton" };
    return state.load(async (id, fields) => {
      const record = await loader(id, fields);
      if (!isRecordIdentity(record, id)) throw new Error("Invalid site_settings identity/version");
      return record;
    }, identity);
  }
  return Object.assign(adapter, { load });
}

const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const validUrl = (value) => value == null || value === "" || (typeof value === "string" && (value.startsWith("/") && !value.startsWith("//") || (() => { try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; } })()));
export function toNativeImageMetadata(field) {
  if (!field || !FILE_FIELDS.has(field.field) || field.type !== "uuid" || !(field.meta?.special ?? field.special)?.includes?.("m2o")) return field;
  return { ...field, meta: { ...(field.meta ?? {}), interface: "file-image" } };
}
export function validateSiteSettings(values, metadata = []) {
  const byName = new Map(metadata.map((item) => [item.field, item])); const errors = [];
  for (const field of siteSettingsFields) { const meta = byName.get(field); if (Object.hasOwn(values ?? {}, field) && meta?.meta?.required && (values[field] == null || String(values[field]).trim() === "")) errors.push({ field, message: "Обязательное поле" }); }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(values.email))) errors.push({ field: "email", message: "Введите корректный адрес электронной почты" });
  for (const field of ["requisites_url", "documents_url", "primary_cta_url"]) if (!validUrl(values[field])) errors.push({ field, message: "Допустимы только относительные ссылки или HTTP(S)" });
  return errors;
}

export function createSiteSettingsController(api, options = {}) {
  const contract = options.guardedContract === true; let active = true; let openGeneration = 0; const notify = () => active && options.onSnapshot?.(snapshot());
  let metadata = []; let permissions = { read: [], update: [] }; let filesRead = []; let itemUpdate = false; let fullRead = false; let loading = false; let error = null; let group = "overview"; let quickField = null; let conflictComparison = null; let lastResult = null; let validationRequested = false; let fileDetails = {}; let fileDetailGeneration = 0;
  let state = createSiteSettingsState({ permissions, guardedContract: contract });
  const fieldsFor = (access) => Array.isArray(access) ? access.filter((field) => field === "*" || KNOWN_FIELDS.has(field) || field === "id" || field === "updated_at") : [];
  const hasFieldMetadata = (field) => metadata.some((item) => item.field === field);
  const isVisibleField = (field) => metadata.find((item) => item.field === field)?.meta?.hidden !== true;
  const readableFields = () => ["id", "updated_at", ...[...KNOWN_FIELDS].filter((field) => hasFieldMetadata(field) && isVisibleField(field) && permitted(permissions, "read", field))];
  const loader = async (id, fields = readableFields()) => {
    const requested = fields.filter((field) => field === "id" || field === "updated_at" || (KNOWN_FIELDS.has(field) && permitted(permissions, "read", field)));
    const record = unwrap(await api.get("/items/site_settings", { params: { fields: [...new Set(requested)].join(",") } }));
    if (!isRecordIdentity(record, id)) throw new Error("Invalid site_settings identity/version");
    return Object.fromEntries([...new Set(requested)].filter((field) => Object.hasOwn(record, field)).map((field) => [field, record[field]]));
  };
  function snapshot() { const errors = validationRequested ? validateSiteSettings(state.values, metadata) : []; const knownConflict = Boolean(state.conflict || conflictComparison); return { loading, saving: state.saving, error, saveError: knownConflict ? null : state.saveError ? saveFailureText(state.saveError) : null, collection: state.collection, identity: state.identity, hasRecord: Boolean(state.identity != null && state.baseline), baseline: state.baseline, values: state.values, dirty: state.dirty, dirtyFields: state.dirtyFields, canSave: contract && itemUpdate && !conflictComparison && state.canSave && errors.length === 0, readonly: !contract || !itemUpdate || !state.baseline || Boolean(error), conflict: knownConflict, writeUncertain: state.writeUncertain, saved: state.saved, readError: Boolean(state.readError || error), validationErrors: errors, metadata: metadata.map((field) => ({ ...field, name: LABELS[field.field] ?? field.name ?? field.field, meta: { ...(field.meta ?? {}) } })), permissions, filesRead, itemUpdate, fullRead, group, quickField, comparison: conflictComparison, lastResult, fileDetails: { ...fileDetails } }; }
  const safeFieldMetadata = () => Object.fromEntries(metadata.map((field) => [field.field, field]));
  const updateState = () => { state = createSiteSettingsState({ permissions: { read: permissions.read, update: itemUpdate ? permissions.update : [] }, fieldMetadata: safeFieldMetadata(), guardedContract: contract }); };
  async function readFileDetails(record, request) {
    const generation = ++fileDetailGeneration;
    const identity = state.identity == null ? null : String(state.identity);
    if (!permitted({ read: filesRead }, "read", "id")) { fileDetails = {}; notify(); return; }
    const linked = [...FILE_FIELDS].filter((field) => record[field] != null && record[field] !== "");
    fileDetails = Object.fromEntries(linked.map((field) => [field, { status: "checking" }]));
    notify();
    const results = await Promise.all(linked.map(async (field) => {
      const raw = record[field]; const id = raw && typeof raw === "object" ? raw.id : raw;
      if (id == null) return [field, { status: "missing" }];
      try {
        const fields = ["id", "filename_download", "type"].filter((name) => permitted({ read: filesRead }, "read", name));
        const file = unwrap(await api.get(`/files/${encodeURIComponent(id)}`, { params: { fields: fields.join(",") } }));
        if (!active || request !== openGeneration || generation !== fileDetailGeneration || String(state.identity) !== identity) return [field, null];
        if (!plainRecord(file) || String(file.id) !== String(id)) return [field, { status: "missing" }];
        return [field, { status: "readable", name: file.filename_download ?? file.type ?? "Файл доступен" }];
      } catch {
        if (!active || request !== openGeneration || generation !== fileDetailGeneration || String(state.identity) !== identity) return [field, null];
        return [field, { status: "unavailable" }];
      }
    }));
    if (active && request === openGeneration && generation === fileDetailGeneration && String(state.identity) === identity) {
      fileDetails = Object.fromEntries(results.filter(([, value]) => value));
      notify();
    }
  }
  const refreshCurrentFileDetails = () => state.identity == null ? Promise.resolve() : readFileDetails(state.values, openGeneration);
  async function open() {
    if (state.saving) return { ok: false, reason: "busy" };
    if (state.dirty || state.writeUncertain || state.conflict) return { ok: false, reason: "dirty" };
    const request = ++openGeneration;
    loading = true; error = null; conflictComparison = null; notify();
    try {
      const [collectionResponse, fieldsResponse, permissionsResponse] = await Promise.all([api.get("/collections/site_settings"), api.get("/fields/site_settings"), api.get("/permissions/me")]);
      if (request !== openGeneration) return { ok: false, stale: true };
      const collection = unwrap(collectionResponse); const receivedMetadata = unwrap(fieldsResponse); const effective = unwrap(permissionsResponse)?.site_settings;
      const read = parsedAccess(effective?.read); const update = parsedAccess(effective?.update);
      if (!collection || collection.collection !== "site_settings" || collection.meta?.singleton !== true) throw new Error("site_settings не подтверждён как singleton.");
      if (!Array.isArray(receivedMetadata) || !read || !update) throw new Error("Не удалось подтвердить метаданные или эффективные права.");
      metadata = receivedMetadata.filter((field) => KNOWN_FIELDS.has(field.field) || ["id", "updated_at"].includes(field.field));
      const metadataNames = new Set(metadata.map((field) => field.field));
      if (siteSettingsFields.some((field) => !metadataNames.has(field))) throw new Error("Метаданные настроек сайта получены не полностью.");
      if (siteSettingsFields.some((field) => FILE_FIELDS.has(field)
        ? metadata.find((item) => item.field === field)?.type !== "uuid" || !(metadata.find((item) => item.field === field)?.meta?.special ?? metadata.find((item) => item.field === field)?.special)?.includes?.("m2o")
        : !["string", "text"].includes(metadata.find((item) => item.field === field)?.type))) throw new Error("Типы полей настроек сайта не подтверждены.");
      fullRead = effective.read.access === "full";
      permissions = { read: fieldsFor(read), update: fieldsFor(update) };
      filesRead = parsedAccess(unwrap(permissionsResponse)?.directus_files?.read) ?? [];
      if (!permitted(permissions, "read", "id") || !permitted(permissions, "read", "updated_at")) throw new Error("Для сверки singleton нужны права чтения id и updated_at.");
      const count = unwrap(await api.get("/items/site_settings", { params: { "aggregate[count]": "id" } }));
      if (request !== openGeneration) return { ok: false, stale: true };
      if (!isConfirmedSingleton({ count: count?.count, fullRead })) throw new Error("Глобальную единственность site_settings подтвердить не удалось.");
      const candidate = unwrap(await api.get("/items/site_settings", { params: { fields: readableFields().join(",") } }));
      if (request !== openGeneration) return { ok: false, stale: true };
      if (!plainRecord(candidate) || candidate.id == null || !Object.hasOwn(candidate, "updated_at")) throw new Error("Directus не вернул объект singleton с идентификатором и версией.");
      const record = Object.fromEntries(readableFields().filter((field) => Object.hasOwn(candidate, field)).map((field) => [field, candidate[field]]));
      const item = unwrap(await api.get(`/permissions/me/site_settings/${encodeURIComponent(record.id)}`));
      if (request !== openGeneration) return { ok: false, stale: true };
      if (typeof item?.update?.access !== "boolean") throw new Error("Не удалось подтвердить право изменения этой записи.");
      itemUpdate = item.update.access; updateState();
      const loaded = await state.load(async (_id, fields) => record, record.id, { count: count?.count, fullRead });
      if (request !== openGeneration) return { ok: false, stale: true };
      if (!loaded.ok) throw loaded.error ?? new Error("Не удалось загрузить singleton.");
      await readFileDetails(record, request);
      if (request !== openGeneration) return { ok: false, stale: true };
      error = null; lastResult = "loaded";
    } catch (caught) { if (request === openGeneration) error = loadFailureText(caught); }
    finally { if (request === openGeneration) { loading = false; notify(); } }
    return { ok: !error, error };
  }
  function change(field, value) {
    const meta = metadata.find((item) => item.field === field);
    if (!contract || !siteSettingsFields.includes(field) || !meta || READONLY_FIELDS.has(field) || (FILE_FIELDS.has(field) && !permitted({ read: filesRead }, "read", "id")) || meta.meta?.readonly === true || meta.meta?.hidden === true || meta.schema?.is_generated === true || meta.type === "alias" || ["presentation", "presentation-divider", "presentation-notice", "group-detail", "group-accordion", "note"].includes(meta.meta?.interface) || !permitted(permissions, "read", field) || !permitted(permissions, "update", field) || !itemUpdate) return false;
    validationRequested = false; const result = state.change(field, value); if (result) { if (FILE_FIELDS.has(field)) void refreshCurrentFileDetails(); notify(); } return result;
  }
  function changeGroup(id) { if (!FIELD_GROUPS.some((item) => item.id === id)) return false; group = id; quickField = null; notify(); return true; }
  function toggleQuick(field) { const valid = field === null || ["company", "contacts", "footer"].includes(field) || (siteSettingsFields.includes(field) && !READONLY_FIELDS.has(field)); if (!valid) return false; quickField = quickField === field ? null : field; notify(); return true; }
  function validate() { return validateSiteSettings(state.values, metadata); }
  async function save() {
    validationRequested = true;
    const errors = validate(); notify();
    if (errors.length) return { ok: false, reason: "validation", errors };
    if (!contract || !itemUpdate || !state.canSave || conflictComparison || state.saving) return { ok: false, reason: "unavailable" };
    notify();
    const result = await state.save(async (collection, id, payload) => {
      notify();
      const ack = unwrap(await api.post(`/commerce/mutations/${collection}/${encodeURIComponent(id)}`, payload));
      if (!isRecordIdentity(ack, id) || Object.keys(payload.changes).some((field) => !Object.hasOwn(ack, field))) throw new Error("Malformed save acknowledgement");
      const reread = await loader(id, readableFields());
      if (Object.keys(payload.changes).some((field) => !Object.hasOwn(reread, field) || !sameValue(reread[field], payload.changes[field]))) throw new Error("Save readback does not match changes");
      return reread;
    });
    notify();
    if (result.ok) { lastResult = "saved"; conflictComparison = null; await refreshCurrentFileDetails(); }
    else if (result.conflict) {
      const mine = Object.fromEntries(state.dirtyFields.map((field) => [field, state.values[field]]));
      try {
        const latest = await loader(state.identity, readableFields());
        conflictComparison = Object.fromEntries(Object.entries(mine).map(([field, value]) => [field, { mine: value, saved: latest[field] }]));
      } catch { conflictComparison = Object.fromEntries(Object.entries(mine).map(([field, value]) => [field, { mine: value, saved: undefined }])); }
    }
    notify(); return result;
  }
  async function reconcile({ keepEdits = false } = {}) { notify(); const result = await state.reconcile(loader, state.identity, { keepEdits }); if (result.ok) { conflictComparison = keepEdits ? Object.fromEntries(state.dirtyFields.map((field) => [field, { mine: state.values[field], saved: state.baseline?.[field] }])) : null; await refreshCurrentFileDetails(); } notify(); return result; }
  async function resolveConflict(choice) {
    if (!conflictComparison || !["mine", "saved"].includes(choice)) return { ok: false, reason: "choice" };
    const result = await reconcile({ keepEdits: choice === "mine" });
    if (result.ok) { conflictComparison = null; notify(); }
    return result;
  }
  async function checkResult() {
    const staged = Object.fromEntries(state.dirtyFields.map((field) => [field, state.values[field]])); notify();
    lastResult = null;
    let latest;
    try { latest = await loader(state.identity, readableFields()); } catch (caught) { notify(); return { ok: false, error: caught }; }
    const committed = Object.entries(staged).length > 0 && Object.entries(staged).every(([field, value]) => sameValue(latest[field], value));
    if (committed) {
      const result = await state.reconcile(async () => latest, state.identity, { keepEdits: false });
      if (result.ok) { conflictComparison = null; lastResult = "verified-saved"; await refreshCurrentFileDetails(); }
      notify(); return { ...result, committed: result.ok };
    }
    const result = { ok: true, record: latest };
    conflictComparison = Object.fromEntries(Object.entries(staged).map(([field, mine]) => [field, { mine, saved: latest[field] }]));
    notify(); return { ...result, committed: lastResult === "verified-saved" };
  }
  async function cancel() { if (state.saving || !state.dirty) return { ok: false, reason: "unavailable" }; notify(); const result = await state.reconcile(loader, state.identity, { keepEdits: false }); if (result.ok) { conflictComparison = null; quickField = null; validationRequested = false; lastResult = "cancelled"; await refreshCurrentFileDetails(); } notify(); return result; }
  return { open, snapshot, change, changeGroup, toggleQuick, validate, save, reconcile, resolveConflict, checkResult, cancel, dispose() { active = false; openGeneration++; fileDetailGeneration++; }, get metadata() { return metadata.map((field) => ({ ...field, name: LABELS[field.field] ?? field.field, meta: { ...(field.meta ?? {}), width: ["inn", "kpp", "ogrn"].includes(field.field) ? "half" : field.meta?.width ?? "full" } })); } };
}

const EDITABLE_BY_NATIVE = new Set(siteSettingsFields.filter((field) => !READONLY_FIELDS.has(field)));
const styles = `
.a5{--a5-gap:20px;display:grid;gap:var(--a5-gap);padding:8px 0 150px;color:var(--theme--foreground);font-size:14px}
.a5__row>button,.a5__quick>button,.a5__conflict button,.a5__return,.a5__savebar button,.a5__uncertain{min-height:40px;padding:8px 12px;border:1px solid var(--theme--border-color);border-radius:var(--theme--border-radius);background:var(--theme--background);color:var(--theme--foreground);font:inherit;font-size:14px;cursor:pointer}
.a5__row>button:hover:not(:disabled),.a5__quick>button:hover:not(:disabled),.a5__conflict button:hover:not(:disabled),.a5__return:hover:not(:disabled),.a5-root .a5__savebar button:hover:not(:disabled),.a5__uncertain:hover:not(:disabled){border-color:var(--theme--primary);color:var(--theme--primary)}
.a5__row>button:focus-visible,.a5__quick>button:focus-visible,.a5__conflict button:focus-visible,.a5__return:focus-visible,.a5-root .a5__savebar button:focus-visible,.a5__uncertain:focus-visible{outline:2px solid var(--theme--primary);outline-offset:2px}
.a5__row>button:disabled,.a5__quick>button:disabled,.a5__conflict button:disabled,.a5__return:disabled,.a5-root .a5__savebar button:disabled,.a5__uncertain:disabled{opacity:.58;cursor:not-allowed}
.a5__row{display:grid;grid-template-columns:minmax(180px,.65fr) minmax(180px,1fr) auto;gap:12px;align-items:center;padding:18px 22px;border-bottom:1px solid var(--theme--border-color)}
.a5__row strong,.a5__readonly-row strong{font-weight:600}
.a5__summary{display:grid;gap:5px}.a5__summary small,.a5__note,.a5__readonly-row small{color:var(--theme--foreground)}
.a5__quick{grid-column:1/-1;padding:12px 0}.a5__form{max-width:900px}
.a5__form .field-label{font-size:13px}
.a5__file-field{display:grid;gap:8px;margin:0 0 18px}.a5__file-field>strong{font-size:13px;font-weight:600}.a5__file-field .a5__note{font-size:13px;line-height:1.45}
.a5-root .ac-tabs__list{display:flex;gap:20px;overflow:auto;border-bottom:1px solid var(--theme--border-color);padding-bottom:0}.a5-root .ac-tabs__list [role=tab]{min-height:48px;padding:12px 2px;border:0;border-bottom:2px solid transparent;border-radius:0;background:transparent;color:var(--theme--foreground,#29374a);font:inherit;font-size:14px;white-space:nowrap}.a5-root .ac-tabs__list [aria-selected=true]{border-bottom-color:var(--theme--primary);color:var(--theme--foreground,#29374a);font-weight:700}
.a5__table,.a5__section{border:1px solid var(--theme--border-color);border-radius:var(--theme--border-radius);background:var(--theme--background)}
.a5__section{padding:20px;margin:16px 0}.a5__section h3{margin-top:0}.a5__note{margin:0}.a5 h2{font-size:20px;line-height:1.3}.a5 h3{font-size:16px;line-height:1.35}
.a5__readonly-row{display:grid;grid-template-columns:minmax(180px,.65fr) minmax(180px,1fr) auto;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--theme--border-color)}
.a5-root .a5__savebar{position:sticky;bottom:0;z-index:3;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px;background:var(--theme--background);border-top:1px solid var(--theme--border-color);box-shadow:0 -4px 16px rgba(0,0,0,.06)}
.a5-root .a5__toolbar{flex:1 1 100%;min-width:0}.a5-root .a5__toolbar .ac-toolbar>div:first-child strong:empty{display:none}.a5-root .a5__toolbar .ac-toolbar{margin:0;padding:0;border:0;background:transparent;box-shadow:none;flex-wrap:wrap;align-items:center;gap:12px}.a5-root .a5__toolbar .ac-toolbar>div:first-child{flex:1 1 180px;min-width:0}.a5-root .a5__toolbar .ac-toolbar__actions{display:flex;flex:0 1 auto;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.a5__conflict{padding:16px;border:1px solid var(--theme--warning);border-radius:var(--theme--border-radius);display:grid;gap:12px}.a5__conflict-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.a5__conflict-row>div{display:grid;gap:4px}
@media(max-width:700px){.a5-root .a5{--a5-gap:14px;padding-bottom:calc(170px + env(safe-area-inset-bottom))}.a5-root .a5__savebar{align-items:stretch;flex-direction:column;gap:8px}.a5-root .a5__toolbar{flex:0 1 auto}.a5-root .a5__toolbar .ac-toolbar>div:first-child{flex:0 1 auto}.a5-root .a5__toolbar .ac-toolbar{align-items:stretch;flex-direction:column}.a5-root .a5__toolbar .ac-toolbar__actions{width:100%;justify-content:flex-end}.a5-root .a5__toolbar .ac-toolbar__actions>button{min-height:44px;flex:1 1 160px}.a5-root .ac-tabs__list{position:sticky;top:0;z-index:2;background:var(--theme--background)}.a5-root .ac-tabs__list [role=tab],.a5-root .a5__savebar button{min-height:44px;white-space:nowrap}.a5__row{grid-template-columns:1fr auto;gap:6px 10px;padding:14px}.a5__summary{grid-column:1}.a5__quick{grid-column:1/-1}.a5__form input,.a5__form textarea,.a5__form select{font-size:16px;min-height:44px}.a5__section{padding:14px}.a5__conflict-row,.a5__readonly-row{grid-template-columns:1fr}.a5-root .a5__savebar{padding-bottom:calc(12px + env(safe-area-inset-bottom))}}
@media(max-height:560px){.a5-root .a5__savebar{position:static}}
`;

export const SiteSettingsSection = defineComponent({
  name: "SiteSettingsSection",
  props: { guardedContract: { type: Boolean, default: false } },
  setup(props) {
    const api = useApi();
    const snapshots = ref({ loading: true, readonly: true }); const revision = ref(0); const quick = ref(null);
    const controller = createSiteSettingsController(api, { guardedContract: props.guardedContract === true, onSnapshot: (next) => { snapshots.value = next; revision.value++; } });
    const groups = FIELD_GROUPS;
    const values = () => snapshots.value.values ?? {};
    const permissions = () => snapshots.value.permissions ?? { read: [], update: [] };
    const metadata = () => controller.metadata;
    const read = (field) => KNOWN_FIELDS.has(field) && metadata().some((item) => item.field === field) && permitted(permissions(), "read", field) && Object.hasOwn(values(), field) && metadata().find((item) => item.field === field)?.meta?.hidden !== true;
    const canEdit = (field) => props.guardedContract === true && snapshots.value.itemUpdate && EDITABLE_BY_NATIVE.has(field) && read(field) && (!FILE_FIELDS.has(field) || permitted({ read: snapshots.value.filesRead }, "read", "id")) && permitted(permissions(), "update", field) && metadata().find((item) => item.field === field)?.meta?.readonly !== true;
    const fields = (names) => names.filter(read);
    const nativePermissions = () => {
      const visible = metadata().filter((item) => item.meta?.hidden !== true);
      const readable = visible.filter((item) => permitted(permissions(), "read", item.field)).map((item) => item.field);
      const writable = visible.filter((item) => permitted(permissions(), "read", item.field) && permitted(permissions(), "update", item.field) && item.meta?.readonly !== true && item.schema?.is_generated !== true && item.type !== "alias").map((item) => item.field);
      return { read: readable, update: snapshots.value.itemUpdate ? writable : [] };
    };
    const update = (next, names, identity, renderedGroup, renderedQuick) => {
      if (String(snapshots.value.identity) !== String(identity) || snapshots.value.group !== renderedGroup || (renderedQuick && quick.value !== renderedQuick)) return;
      for (const field of names) if (Object.hasOwn(snapshots.value.baseline ?? {}, field)) controller.change(field, Object.hasOwn(next ?? {}, field) ? next[field] : snapshots.value.baseline[field]);
    };
    const quickFields = { company: ["company_name", "legal_name"], contacts: ["phone", "email"], footer: ["footer_text", "footer_disclaimer"] };
    const renderForm = (names, id) => {
      const formFields = fields(names).filter((field) => !READONLY_FIELDS.has(field));
      if (!formFields.length) return null;
      const identity = snapshots.value.identity; const renderedGroup = snapshots.value.group; const renderedQuick = renderedGroup === "overview" && quickFields[id] ? id : null;
      const scalarFields = formFields.filter((field) => !FILE_FIELDS.has(field));
      const fileFields = formFields.filter((field) => FILE_FIELDS.has(field));
      const controls = [];
      if (scalarFields.length) controls.push(h(NativeFieldGroup, { metadata: metadata(), fieldSubset: scalarFields, primaryKey: identity ?? "+", initialValues: snapshots.value.baseline ?? {}, modelValue: Object.fromEntries(scalarFields.map((field) => [field, values()[field]])), permissions: nativePermissions(), readonly: snapshots.value.readonly, disabled: snapshots.value.loading || snapshots.value.saving || snapshots.value.writeUncertain || Boolean(snapshots.value.readError), validationErrors: snapshots.value.validationErrors?.filter((error) => scalarFields.includes(error.field)) ?? [], "onUpdate:modelValue": (next) => update(next, scalarFields, identity, renderedGroup, renderedQuick) }));
      for (const field of fileFields) {
        const fieldMetadata = metadata().find((item) => item.field === field);
        const detail = snapshots.value.fileDetails?.[field];
        const filesReadable = permitted({ read: snapshots.value.filesRead }, "read", "id");
        const pickerSafe = filesReadable && (values()[field] == null || detail?.status === "readable" || detail?.status === "checking");
        const fileStatus = !filesReadable ? "Имя файла недоступно без права чтения файлов." : detail?.status === "readable" ? detail.name : detail?.status === "missing" ? "Связанный файл не найден; текущая связь сохранена." : detail?.status === "unavailable" ? "Не удалось прочитать связанный файл; текущая связь сохранена." : values()[field] == null ? "Файл не выбран." : "Не удалось проверить файл; текущая связь сохранена.";
        const picker = pickerSafe ? h(MediaPicker, { field: toNativeImageMetadata(fieldMetadata), primaryKey: identity, initialValue: { [field]: snapshots.value.baseline?.[field] ?? null }, modelValue: values()[field], permissions: nativePermissions(), readonly: !canEdit(field), disabled: snapshots.value.loading || snapshots.value.saving || snapshots.value.writeUncertain || Boolean(snapshots.value.readError), allowSelect: canEdit(field), allowUpload: false, missingAsset: false, "onUpdate:modelValue": (value) => update({ [field]: value }, [field], identity, renderedGroup, renderedQuick) }) : h("p", { class: "a5__note", role: "status" }, fileStatus);
        controls.push(h("div", { key: field, class: "a5__file-field" }, [h("strong", LABELS[field]), picker, pickerSafe ? h("p", { class: "a5__note" }, fileStatus) : null]));
      }
      return h("div", { class: "a5__form", key: id }, controls);
    };
    const display = (field) => {
      if (!read(field)) return "Нет доступа";
      const value = values()[field];
      if (value == null || value === "") return "Не задано";
      if (typeof value === "object") return value.title ?? value.filename_download ?? "Настроено";
      if (["logo", "favicon", "company_image", "default_og_image"].includes(field)) return "Файл выбран";
      return String(value);
    };
    const quickOpeners = new Map();
    let requestCancel = () => Promise.resolve(false);
    const closeQuick = (id) => { quick.value = null; controller.toggleQuick(id); requestAnimationFrame(() => quickOpeners.get(id)?.focus?.()); };
    const openQuick = (id, event) => { quick.value = quick.value === id ? null : id; controller.toggleQuick(id); if (quick.value === id && event?.currentTarget) quickOpeners.set(id, event.currentTarget); else requestAnimationFrame(() => quickOpeners.get(id)?.focus?.()); };
    const quickEditor = (id) => quick.value === id ? h("div", { class: "a5__quick" }, [renderForm(quickFields[id], id), h("button", { type: "button", onClick: () => closeQuick(id) }, "Свернуть — изменения сохранены в черновике")]) : null;
    const row = (label, summary, detail, action) => h("div", { class: "a5__row" }, [h("strong", label), h("div", { class: "a5__summary" }, [h("span", summary), detail ? h("small", detail) : null]), action]);
    const navigate = (id) => { controller.changeGroup(id); quick.value = null; };
    const overview = () => {
      const quickButton = (id) => h("button", { type: "button", disabled: !props.guardedContract || snapshots.value.readonly, onClick: (event) => openQuick(id, event) }, quick.value === id ? "Свернуть" : "Изменить");
      const goButton = (id) => h("button", { type: "button", onClick: () => navigate(id) }, "Настроить　›");
      return h("div", { class: "a5" }, [ h("h2", "Общие настройки"), h("p", { class: "a5__note" }, "Основные сведения о магазине и быстрый переход к нужным настройкам."), h("section", { class: "a5__table", "aria-label": "Основные настройки" }, [
        row("Компания", display("company_name"), display("legal_name"), quickButton("company")), quickEditor("company", "Компания"),
        row("Связь с покупателями", display("phone"), display("email"), quickButton("contacts")), quickEditor("contacts"),
        row("Реквизиты", ["inn", "kpp", "ogrn"].some((field) => read(field) && values()[field] != null && values()[field] !== "") ? `${display("inn")}, ${display("kpp")} и ${display("ogrn")}` : "Реквизиты не заданы", read("vat_info") && values().vat_info ? `НДС: ${display("vat_info")}` : "Данные компании", goButton("company")),
        row("Подвал сайта", display("footer_text"), display("footer_disclaimer"), quickButton("footer")), quickEditor("footer", "Подвал сайта"),
      ]), h("h3", "Оформление и представление сайта"), h("section", { class: "a5__table" }, [row("Оформление", display("logo"), "Логотип, изображения, цвета и основная кнопка", goButton("appearance")), row("Поиск и соцсети", "Заголовки, описания и обложка ссылки", "Применение на сайте пока не подключено", goButton("search"))]), h("details", [h("summary", "Служебная информация"), h(ReadonlyDetails, { values: values(), fields: [{ field: "updated_at", label: "Изменено" }] })]), h("p", { class: "a5__note" }, "Логотипы, изображения, цвета, текст главной кнопки и поисковые поля сохраняются в настройках, но не меняют витрину. Текст и оговорка в подвале используются сайтом.")]);
    };
    const readonlyRow = (field) => {
      const value = values()[field];
      const summary = field === "messengers" || field === "social_links" ? (value == null || value === "" ? "Не задано" : "Настроено") : value == null || value === "" ? "Не выбрано" : typeof value === "object" ? (value.title ?? value.filename_download ?? "Файл выбран") : "Файл выбран";
      return h("div", { class: "a5__readonly-row", key: field }, [h("strong", LABELS[field]), h("span", summary), h("small", "Формат не подтверждён; доступен только просмотр.")]);
    };
    const section = () => {
      const selected = groups.find((item) => item.id === snapshots.value.group) ?? groups[0];
      if (selected.id === "overview") return overview();
      const headings = selected.id === "company" ? [{ title: "Название и организация", fields: ["company_name", "legal_name"] }, { title: "Реквизиты", fields: ["inn", "kpp", "ogrn", "legal_address", "vat_info"] }, { title: "Дополнительные ссылки", fields: ["requisites_url", "documents_url"] }] : selected.id === "contacts" ? [{ title: "Связь с покупателями", fields: ["phone", "email"] }, { title: "Адрес и доставка", fields: ["address", "city", "working_hours", "delivery_region"] }, { title: "Мессенджеры и соцсети", fields: ["messengers", "social_links"] }] : selected.id === "appearance" ? [{ title: "Логотип и изображения", fields: ["logo", "favicon", "company_image"] }, { title: "Цвета и основная кнопка", fields: ["primary_color", "accent_color", "primary_cta_text", "primary_cta_url"] }, { title: "Подвал сайта", fields: ["footer_text", "footer_disclaimer"] }] : [{ title: "Поиск и соцсети", fields: ["seo_title", "seo_description", "og_title", "og_description", "default_og_image"] }];
      return h("div", { class: "a5" }, [ h("h2", selected.label), selected.id === "company" ? h("p", { class: "a5__note" }, "Название магазина и юридические сведения — без смешения с контактами покупателей.") : null, selected.id === "appearance" ? h("p", { class: "a5__note" }, "Логотип, цвета и главная кнопка пока не меняют оформление витрины. Текст подвала используется на сайте.") : null, selected.id === "search" ? h("p", { class: "a5__note" }, "Поля поиска и соцсетей пока не подключены к метаданным витрины.") : null, ...headings.map((part) => selected.id === "company" && part.title === "Дополнительные ссылки"
        ? h("details", { class: "a5__section" }, [h("summary", part.title), h("p", { class: "a5__note" }, "Эти ссылки сейчас не используются витриной."), renderForm(part.fields, part.title)])
        : h("section", { class: "a5__section" }, [h("h3", part.title), renderForm(part.fields, part.title), ...part.fields.filter((field) => READONLY_FIELDS.has(field) && read(field)).map(readonlyRow)])), h("button", { class: "a5__return", type: "button", onClick: () => navigate("overview") }, "Вернуться к обзору"), h("details", [h("summary", "Служебная информация"), h(ReadonlyDetails, { values: values(), fields: [{ field: "updated_at", label: "Изменено" }] })])]);
    };
    const conflict = () => snapshots.value.conflict ? h("section", { class: "a5__conflict", "aria-label": "Сверка изменений" }, [h("h3", "Данные изменились в другом окне"), ...Object.entries(snapshots.value.comparison ?? {}).map(([field, pair]) => h("div", { class: "a5__conflict-row" }, [h("strong", LABELS[field]), h("div", [h("b", "Мой вариант"), h("span", valueToText(field, pair.mine))]), h("div", [h("b", "Сохранённый вариант"), h("span", valueToText(field, pair.saved))])])), h("button", { type: "button", onClick: () => controller.resolveConflict("mine") }, "Оставить мои изменения"), h("button", { type: "button", onClick: () => controller.resolveConflict("saved") }, "Принять сохранённое")]) : null;
    function valueToText(field, value) { if (value == null || value === "") return "Не задано"; if (FILE_FIELDS.has(field)) return typeof value === "object" ? value.filename_download ?? value.title ?? "Файл выбран" : "Файл выбран"; return typeof value === "object" ? "Настроено" : String(value); }
    const load = () => controller.open();
    onMounted(load); onUnmounted(() => { controller.dispose(); revision.value++; });
    const save = async () => {
      const result = await controller.save();
      if (result.reason === "validation" && result.errors?.length) {
        const target = result.errors[0].field; const targetGroup = groups.find((item) => item.id !== "overview" && item.fields.includes(target)) ?? groups.find((item) => item.fields.includes(target));
        if (targetGroup) controller.changeGroup(targetGroup.id);
        requestAnimationFrame(() => { const field = document.querySelector(`[field="${target}"]`); const control = field?.matches?.("input,textarea,select,button,[tabindex]") ? field : field?.querySelector?.("input,textarea,select,[tabindex]"); control?.focus?.(); });
      }
      return result;
    };
    const cancel = async () => {
      if (!snapshots.value.dirty || snapshots.value.saving) return;
      const result = await controller.cancel();
      if (result.ok) { quick.value = null; requestAnimationFrame(() => document.querySelector('.a5-root .ac-tabs__list [aria-selected="true"]')?.focus?.()); }
    };
    const retry = () => snapshots.value.writeUncertain ? controller.checkResult() : load();
    return () => {
      revision.value;
      const snap = snapshots.value;
      const content = snap.loading
        ? h("p", { role: "status" }, "Загрузка настроек сайта…")
        : snap.readError
          ? h("div", [h("p", { role: "alert" }, snap.error), h("button", { type: "button", onClick: retry }, "Повторить чтение")])
          : h("div", [
            h("style", styles),
            h(SectionTabs, { tabs: groups, modelValue: snap.group, disabled: snap.loading || snap.saving, idPrefix: "a5-site-settings", "onUpdate:modelValue": navigate }, { default: () => section() }), conflict(),
            snap.validationErrors?.map((item) => h("p", { role: "alert" }, `${LABELS[item.field]}: ${item.message}`)),
            snap.error ? h("p", { role: "alert" }, snap.error) : null,
            snap.saveError ? h("p", { role: "alert" }, snap.saveError) : null,
            h("div", { class: "a5__savebar" }, [
              h("div", { class: "a5__toolbar" }, [h(EditorToolbar, { title: "", state: { ...snap, conflict: false, ...(snap.conflict ? { writeUncertain: false, saveError: null } : {}) }, readonly: snap.readonly, saveLabel: "Сохранить во всех разделах", cancelLabel: snap.dirty ? "Отменить изменения" : "", onCancel: () => requestCancel(), onSave: save, onReconcile: (request) => request?.action === "verify" ? controller.checkResult() : null, onBack: () => navigate("overview") })]),
            ]),
          ]);
      return h(AdminShell, { title: "Настройки сайта", state: snap, dirty: snap.dirty, saving: snap.saving, readonly: snap.readonly, cancelTitle: "Отменить все несохранённые изменения?", onCancel: cancel, onSave: save, onRetry: retry }, { default: () => h("div", { class: "a5-root" }, [h("style", styles), content]), toolbar: ({ requestCancel: request }) => { requestCancel = request; return []; } });
    };
  },
});

