export const cloneValues = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

export function createRequestSequence() {
  let current = 0;
  return {
    next: () => ++current,
    isCurrent: (sequence) => sequence === current,
  };
}

export function canNavigateEditor({ saving, dirty, approved = false, internal = false }) {
  return internal || (!saving && (!dirty || approved));
}

export function canEditForm(saving) {
  return !saving;
}

export function getDocumentFolderId(documentsField) {
  const file = documentsField?.meta?.options?.fields?.find((field) => field.field === "file");
  return file?.meta?.options?.folder ?? null;
}

export function isDirectusFileId(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isSupportedDocumentList(value) {
  return value == null || (Array.isArray(value) && value.every((fileId) => fileId === null || isDirectusFileId(fileId)));
}

export function updateDocumentSelection(documents, index, fileId) {
  if (!Array.isArray(documents) || documents.some((value) => value !== null && typeof value !== "string")) throw new Error("Список документов содержит неподдерживаемый формат.");
  if (!Number.isInteger(index) || index < 0 || index >= documents.length) throw new Error("Некорректная строка документа.");
  const next = cloneValues(documents);
  next[index] = fileId || null;
  return next;
}

export function addDocumentSlot(documents) {
  if (!Array.isArray(documents) || documents.some((value) => value !== null && typeof value !== "string")) throw new Error("Список документов содержит неподдерживаемый формат.");
  return [...cloneValues(documents), null];
}

export function mergeNativeEdits(initialValues, nativeEdits, documentIds) {
  return { ...cloneValues(initialValues ?? {}), ...cloneValues(nativeEdits ?? {}), ...(documentIds === undefined ? {} : { documents: cloneValues(documentIds) }) };
}

export function validateProduct(values) {
  const labels = { title: "Название товара", brand: "Бренд", sku: "Артикул", slug: "Адрес товара" };
  const missing = Object.keys(labels).filter((key) => !String(values?.[key] ?? "").trim());
  if (missing.length) return `Заполните обязательные поля: ${missing.map((key) => labels[key]).join(", ")}.`;
  if (Array.isArray(values.specifications) && values.specifications.some((row) => !String(row?.name ?? "").trim() || !String(row?.value ?? "").trim())) return "В каждой характеристике заполните название и значение.";
  if (values.documents != null && !Array.isArray(values.documents)) return "Сохранение отключено: список документов содержит неподдерживаемый формат. Обратитесь к администратору для исправления данных.";
  if (Array.isArray(values.documents)) {
    if (values.documents.some((fileId) => fileId !== null && typeof fileId !== "string")) return "Сохранение отключено: список документов содержит неподдерживаемый формат. Обратитесь к администратору для исправления данных.";
    if (values.documents.some((fileId) => fileId === null)) return "Выберите файл для каждой добавленной строки документа или удалите пустую строку.";
    if (values.documents.some((fileId) => !isDirectusFileId(fileId))) return "В списке документов есть некорректный идентификатор файла. Обновите товар или обратитесь к администратору.";
  }
  return null;
}

export function buildProductChanges(baseline, current) {
  if (!baseline || typeof baseline !== "object") throw new Error("Нет исходного снимка товара; обновление остановлено.");
  const changes = {};
  for (const [key, value] of Object.entries(current ?? {})) {
    if (key === "id" || key === "updated_at" || key === "created_at") continue;
    if (JSON.stringify(value ?? null) !== JSON.stringify(baseline[key] ?? null)) changes[key] = value;
  }
  return changes;
}

export function buildExpectedSnapshot(baseline, changes) {
  if (!baseline?.id || !Object.hasOwn(baseline, "updated_at")) throw new Error("Не удалось получить версию товара. Перезагрузите страницу.");
  const expected = { id: baseline.id, updated_at: baseline.updated_at };
  for (const field of Object.keys(changes)) {
    if (!Object.hasOwn(baseline, field)) throw new Error(`Не удалось проверить поле ${field}. Перезагрузите товар.`);
    expected[field] = baseline[field];
  }
  return expected;
}

export function buildCreateValues(values, fieldDefaults = {}) {
  return { ...fieldDefaults, ...values, status: values?.status ?? fieldDefaults.status ?? "draft" };
}

export function buildNativeFormProps({ id, initialValues, modelValue, metadata, managedMedia, fieldSubset }) {
  const editable = ["title", "brand", "sku", "slug", "category", "status", "price_status", "price", "currency", "availability_status", "delivery_status", "main_image", "image_alt", "image_items", "specifications", "short_description", "full_description", "part_type", "cta_text", "is_featured", "show_on_homepage", "sort_order", "seo_title", "seo_description", "seo_text", "og_image", "is_indexable", "seo_quality_status", "source_name", "source_url", "verified_at", "reviewed_by", "mpn", "gtin"];
  const groups = ["group_main", "group_price", "group_media", "group_specs", "group_content", "group_visibility", "group_seo", "group_source", "group_additional", "group_system"];
  const fieldOrder = fieldSubset ? fieldSubset.filter((key) => editable.includes(key)) : editable;
  const allowed = fieldOrder.filter((key) => metadata[key] && !(managedMedia?.specifications && key === "specifications") && !(managedMedia?.documents && key === "documents"));
  const visibleGroups = groups.filter((group) => metadata[group] && allowed.some((key) => metadata[key]?.meta?.group === group));
  const nativeModelValue = cloneValues(modelValue ?? {});
  if (fieldSubset) for (const key of Object.keys(nativeModelValue)) if (!fieldSubset.includes(key)) delete nativeModelValue[key];
  delete nativeModelValue.documents;
  return {
    primaryKey: id && id !== "+" ? id : "+",
    initialValues,
    modelValue: nativeModelValue,
    fields: [...visibleGroups, ...allowed].map((key) => metadata[key]),
  };
}

export function compactNativeFields(fields, { wideFields = [], multilineRows = {} } = {}) {
  return (fields ?? []).filter((field) => !String(field.field).startsWith("group_")).map((field, index) => {
    const meta = { ...(field.meta ?? {}) };
    delete meta.group;
    delete meta.note;
    meta.width = wideFields.includes(field.field) ? "full" : "half";
    meta.sort = index + 1;
    if (multilineRows[field.field] && meta.options && typeof meta.options === "object") {
      meta.options = { ...meta.options, rows: multilineRows[field.field] };
    }
    return { ...field, meta, note: null };
  });
}

export function nextTabIndex(currentIndex, key, count) { if (!Number.isInteger(count) || count <= 0 || !Number.isInteger(currentIndex)) return currentIndex; const delta = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0; return delta ? (currentIndex + delta + count) % count : currentIndex; }
export function mergeNativeTabEdits(previous, next, fieldSubset) {
  const merged = cloneValues(previous ?? {});
  for (const key of fieldSubset) if (key !== "documents") delete merged[key];
  for (const [key, value] of Object.entries(next ?? {})) {
    if (!fieldSubset.includes(key) || key === "documents") continue;
    if (value === undefined) delete merged[key];
    else merged[key] = cloneValues(value);
  }
  return merged;
}

export function relationIds(value) { if (!Array.isArray(value)) return []; return value.map((row) => typeof row === "string" ? row : row?.id).filter((id) => typeof id === "string"); }
export function normalizeGalleryRows(rows) { if (!Array.isArray(rows)) throw new Error("Не удалось прочитать фотографии товара."); return rows.map((row, index) => ({ ...cloneValues(row), image: typeof row.image === "object" ? cloneValues(row.image) : row.image, sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : index })); }
export function stageGalleryImage(rows, fileId, altText = "", replaceIndex = null, status = "draft") { if (!Array.isArray(rows) || !isDirectusFileId(fileId)) throw new Error("Выберите корректный файл изображения."); const next = cloneValues(rows); const duplicateIndex = next.findIndex((row, index) => (row.image?.id ?? row.image) === fileId && index !== replaceIndex); if (duplicateIndex !== -1) throw new Error("Это изображение уже есть в галерее."); if (replaceIndex !== null) { if (!Number.isInteger(replaceIndex) || !next[replaceIndex]) throw new Error("Выберите фотографию для замены."); next[replaceIndex] = { ...next[replaceIndex], image: fileId, alt_text: altText }; } else next.push({ _editor_key: `new-${Date.now()}-${Math.random().toString(16).slice(2)}`, image: fileId, alt_text: altText, sort_order: next.length, ...(status ? { status } : {}) }); return next.map((row, index) => ({ ...row, sort_order: index })); }
export function reorderGallery(rows, fromIndex, toIndex) { if (!Array.isArray(rows) || !Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || !rows[fromIndex] || toIndex < 0 || toIndex >= rows.length) throw new Error("Некорректный порядок фотографий."); const next = cloneValues(rows); const [moved] = next.splice(fromIndex, 1); next.splice(toIndex, 0, moved); return next.map((row, index) => ({ ...row, sort_order: index })); }
export function removeGalleryImage(rows, index) { if (!Array.isArray(rows) || !Number.isInteger(index) || !rows[index]) throw new Error("Выберите фотографию для удаления."); return cloneValues(rows).filter((_, rowIndex) => rowIndex !== index).map((row, order) => ({ ...row, sort_order: order })); }
export function buildGalleryPayload(rows, { mainIndex = 0, statusField = true, fallbackMainImage = null, fallbackImageAlt = null } = {}) { if (!Array.isArray(rows)) throw new Error("Не удалось прочитать фотографии товара."); const seen = new Set(); const payload = rows.map((row, index) => { const image = row.image?.id ?? row.image; if (!isDirectusFileId(image) || (seen.has(image) && !row.id)) throw new Error("Галерея содержит отсутствующее или повторяющееся новое изображение."); seen.add(image); const item = { image, alt_text: row.alt_text ?? null, sort_order: index }; if (statusField && Object.hasOwn(row, "status")) item.status = row.status; if (row.id) item.id = row.id; return item; }); const primary = payload[mainIndex] ?? null; return { image_items: payload, main_image: primary?.image ?? fallbackMainImage, image_alt: primary?.alt_text ?? fallbackImageAlt }; }
