import test from "node:test";
import assert from "node:assert/strict";
import { addDocumentSlot, buildCreateValues, buildExpectedSnapshot, buildGalleryPayload, buildNativeFormProps, buildProductChanges, canEditForm, canNavigateEditor, cloneValues, compactNativeFields, createRequestSequence, getDocumentFolderId, isDirectusFileId, isSupportedDocumentList, mergeNativeEdits, mergeNativeTabEdits, nextTabIndex, normalizeGalleryRows, relationIds, removeGalleryImage, reorderGallery, stageGalleryImage, updateDocumentSelection, validateProduct } from "../src/editor-state.mjs";

test("editor takes a detached initial snapshot", () => {
  const loaded = { title: "A", nested: [{ value: "old" }] };
  const snapshot = cloneValues(loaded);
  loaded.nested[0].value = "new";
  assert.equal(snapshot.nested[0].value, "old");
  assert.equal(cloneValues(null), null);
  assert.equal(cloneValues(0), 0);
  assert.equal(cloneValues("value"), "value");
});

test("only the latest overlapping route load may update editor state", () => {
  const requests = createRequestSequence();
  const first = requests.next();
  const second = requests.next();
  assert.equal(requests.isCurrent(first), false);
  assert.equal(requests.isCurrent(second), true);
});

test("save locks form edits and guards dirty route changes while allowing the owned create redirect", () => {
  assert.equal(canEditForm(true), false);
  assert.equal(canEditForm(false), true);
  assert.equal(canNavigateEditor({ saving: true, dirty: true }), false);
  assert.equal(canNavigateEditor({ saving: true, dirty: false }), false);
  assert.equal(canNavigateEditor({ saving: false, dirty: true }), false);
  assert.equal(canNavigateEditor({ saving: false, dirty: true, approved: true }), true);
  assert.equal(canNavigateEditor({ saving: true, dirty: true, internal: true }), true);
  assert.equal(canNavigateEditor({ saving: false, dirty: false }), true);
});

test("change builder keeps only edits and expected values come from original snapshot", () => {
  const baseline = { id: "p1", updated_at: "v1", title: "Old", price: 4, status: "draft" };
  const current = { ...baseline, title: "New" };
  const changes = buildProductChanges(baseline, current);
  assert.deepEqual(changes, { title: "New" });
  assert.deepEqual(buildExpectedSnapshot(baseline, changes), { id: "p1", updated_at: "v1", title: "Old" });
});

test("missing baseline, version, and required fields fail closed", () => {
  assert.throws(() => buildProductChanges(null, { title: "x" }), /снимка/);
  assert.throws(() => buildExpectedSnapshot({ id: "p1" }, { title: "x" }), /версию/);
  assert.match(validateProduct({ title: " ", brand: "x", sku: "y" }), /Название товара, Адрес товара/);
  assert.equal(validateProduct({ title: "x", brand: "x", sku: "y", slug: "x" }), null);
  assert.throws(() => buildExpectedSnapshot({ id: "p1", updated_at: null }, { absent: 1 }), /поле absent/);
  assert.deepEqual(buildExpectedSnapshot({ id: "p1", updated_at: null, title: null }, { title: "x" }), { id: "p1", updated_at: null, title: null });
  assert.match(validateProduct({ title: "x", brand: "x", sku: "y", slug: "x", specifications: [{ name: "Вес", value: "" }] }), /характеристике/);
  assert.match(validateProduct({ title: "x", brand: "x", sku: "y", slug: "x", documents: [{ title: "Паспорт" }] }), /неподдерживаемый формат/);
});

test("create applies Directus defaults with draft safety default", () => {
  assert.deepEqual(buildCreateValues({ title: "x" }, { currency: "RUB", status: "draft" }), { currency: "RUB", title: "x", status: "draft" });
});

test("native v-form receives an explicit field subset without collection override", () => {
  const metadata = {
    title: { field: "title", collection: "products", meta: { group: "group_main" } },
    group_main: { field: "group_main", collection: "products", meta: { interface: "group-detail" } },
    specifications: { field: "specifications", collection: "products", meta: { group: "group_specs" } },
    documents: { field: "documents", collection: "products", meta: { group: "group_media" } },
    group_system: { field: "group_system", collection: "products", meta: { interface: "group-detail" } },
  };
  const props = buildNativeFormProps({ id: "p-1", initialValues: { title: "Test" }, modelValue: { title: "Edited", documents: ["123e4567-e89b-42d3-a456-426614174000"] }, metadata, managedMedia: { specifications: true, documents: true } });
  assert.equal(Object.hasOwn(props, "collection"), false);
  assert.equal(props.primaryKey, "p-1");
  assert.deepEqual(props.modelValue, { title: "Edited" });
  assert.deepEqual(props.fields.map(({ field }) => field), ["group_main", "title"]);
  assert.equal(props.fields.some(({ field }) => field === "group_system"), false);
  const standardProps = buildNativeFormProps({ id: "+", initialValues: {}, modelValue: {}, metadata, managedMedia: { specifications: false, documents: false } });
  assert.equal(standardProps.fields.some(({ field }) => field === "documents"), false);
});

test("native forms retain declared tab order and compact fields remove layout-only groups", () => {
  const metadata = {
    title: { field: "title", collection: "products", meta: { group: "group_main" } },
    slug: { field: "slug", collection: "products", meta: { group: "group_main" } },
    brand: { field: "brand", collection: "products", meta: { group: "group_main" } },
    group_main: { field: "group_main", collection: "products", meta: { interface: "group-detail" } },
  };
  const props = buildNativeFormProps({ id: "p1", initialValues: {}, modelValue: {}, metadata, fieldSubset: ["slug", "title", "brand"] });
  assert.deepEqual(props.fields.map(({ field }) => field), ["group_main", "slug", "title", "brand"]);
  assert.deepEqual(compactNativeFields(props.fields, { wideFields: ["slug", "title"] }).map(({ field, meta }) => [field, meta.width, meta.sort]), [["slug", "full", 1], ["title", "full", 2], ["brand", "half", 3]]);
});

test("main product fields follow the approved identity, category, price, delivery and content sequence", () => {
  const mainFields = ["title", "brand", "sku", "category", "part_type", "slug", "price_status", "availability_status", "price", "currency", "delivery_status", "short_description", "status", "is_featured", "show_on_homepage"];
  const metadata = Object.fromEntries(mainFields.map((field) => [field, { field, collection: "products", meta: { sort: mainFields.length - mainFields.indexOf(field) } }]));
  const props = buildNativeFormProps({ id: "p1", initialValues: {}, modelValue: {}, metadata, fieldSubset: mainFields });
  assert.deepEqual(compactNativeFields(props.fields, { wideFields: ["title", "slug", "delivery_status", "short_description"] }).map(({ field }) => field), mainFields);
});

test("native image picker ungroups presentation metadata while preserving Directus interface and field contract", () => {
  const imageField = {
    field: "image", collection: "product_images", name: "Файл изображения", type: "uuid", required: true,
    special: ["file"], interface: "file-image",
    meta: { group: "group_image", note: "Read-only note", interface: "file-image", options: { folder: "allowed-folder" } },
  };
  const [pickerField] = compactNativeFields([imageField], { wideFields: ["image"] });
  assert.equal(Object.hasOwn(pickerField.meta, "group"), false);
  assert.equal(pickerField.meta.note, undefined);
  assert.equal(pickerField.meta.width, "full");
  assert.equal(pickerField.collection, "product_images");
  assert.equal(pickerField.interface, "file-image");
  assert.deepEqual(pickerField.special, ["file"]);
  assert.equal(pickerField.required, true);
  assert.equal(pickerField.meta.sort, 1);
  assert.deepEqual(pickerField.meta.options, { folder: "allowed-folder" });
  assert.deepEqual(compactNativeFields([]), []);
});

test("document picker preserves the storefront UUID-array contract", () => {
  const field = { meta: { options: { fields: [{ field: "title" }, { field: "file", meta: { options: { folder: "public-folder-id" } } }] } } };
  assert.equal(getDocumentFolderId(field), "public-folder-id");
  const fileId = "123e4567-e89b-42d3-a456-426614174000";
  const initial = [fileId];
  const next = updateDocumentSelection(initial, 0, "123e4567-e89b-42d3-a456-426614174001");
  assert.deepEqual(next, ["123e4567-e89b-42d3-a456-426614174001"]);
  assert.deepEqual(initial, [fileId]);
  assert.deepEqual(addDocumentSlot(initial), [fileId, null]);
  assert.equal(isDirectusFileId(fileId), true);
  assert.equal(isSupportedDocumentList(initial), true);
  assert.equal(isSupportedDocumentList([{ title: "Synthetic", file: fileId }]), false);
  assert.deepEqual(mergeNativeEdits({ title: "Before", documents: initial }, { title: "After" }, next), { title: "After", documents: next });
  assert.deepEqual(mergeNativeEdits({ title: "Before", documents: initial }, { title: "After", documents: [{ file: "bad" }] }, initial), { title: "After", documents: initial });
  assert.match(validateProduct({ title: "x", brand: "x", sku: "x", slug: "x", documents: [{ title: "Synthetic", file: fileId }] }), /неподдерживаемый формат/);
  assert.match(validateProduct({ title: "x", brand: "x", sku: "x", slug: "x", documents: [null] }), /Выберите файл/);
  assert.match(validateProduct({ title: "x", brand: "x", sku: "x", slug: "x", documents: { title: "Synthetic", file: fileId } }), /неподдерживаемый формат/);
  assert.equal(getDocumentFolderId({ meta: { options: { fields: [] } } }), null);
});

test("tab field subsets and edits retain values from other tabs", () => {
  const metadata = {
    title: { field: "title", collection: "products", meta: { group: "group_main" } },
    seo_title: { field: "seo_title", collection: "products", meta: { group: "group_seo" } },
    group_main: { field: "group_main", collection: "products", meta: { interface: "group-detail" } },
    group_seo: { field: "group_seo", collection: "products", meta: { interface: "group-detail" } },
  };
  const initialValues = { title: "Before", seo_title: "SEO before" };
  const nativeProps = buildNativeFormProps({ id: "p1", initialValues, modelValue: { title: "After", seo_title: "SEO after" }, metadata, fieldSubset: ["title"] });
  assert.deepEqual(nativeProps.modelValue, { title: "After" });
  assert.deepEqual(nativeProps.fields.map(({ field }) => field), ["group_main", "title"]);
  assert.equal(Object.hasOwn(nativeProps, "collection"), false);
  const edits = mergeNativeTabEdits({ title: "After", seo_title: "SEO after" }, { title: "Final" }, ["title"]);
  assert.deepEqual(edits, { title: "Final", seo_title: "SEO after" });
  const restored = mergeNativeTabEdits({ title: "Stale", brand: "Changed", seo_title: "SEO after" }, { title: "Before" }, ["title", "brand"]);
  assert.deepEqual(restored, { title: "Before", seo_title: "SEO after" });
});

test("gallery edits preserve relation IDs, child status, and main-image fields for the parent CAS", () => {
  const parentId = "123e4567-e89b-42d3-a456-426614174000";
  const imageA = "123e4567-e89b-42d3-a456-426614174001";
  const imageB = "123e4567-e89b-42d3-a456-426614174002";
  const baseline = { id: parentId, updated_at: "v1", image_items: ["123e4567-e89b-42d3-a456-426614174010", "123e4567-e89b-42d3-a456-426614174011"], main_image: imageA, image_alt: "A" };
  const rows = normalizeGalleryRows([
    { id: baseline.image_items[0], image: { id: imageA }, alt_text: "A", sort_order: 0, status: "published", translations: { ru: "A" } },
    { id: baseline.image_items[1], image: { id: imageB }, alt_text: "B", sort_order: 1, status: "archived", unknown_field: "keep" },
  ]);
  const reordered = reorderGallery(rows, 1, 0);
  const payload = buildGalleryPayload(reordered, { mainIndex: 0, fallbackMainImage: imageA, fallbackImageAlt: "A" });
  const changes = buildProductChanges(baseline, payload);
  assert.equal(changes.main_image, imageB);
  assert.equal(changes.image_alt, "B");
  assert.deepEqual(changes.image_items.map(({ id }) => id), [baseline.image_items[1], baseline.image_items[0]]);
  assert.deepEqual(buildExpectedSnapshot(baseline, changes).image_items, baseline.image_items);
  assert.equal(rows[0].translations.ru, "A");
  assert.equal(rows[1].unknown_field, "keep");
  assert.equal(payload.image_items[1].status, "published");
  assert.equal(payload.image_items[0].status, "archived");
  assert.deepEqual(relationIds([{ id: "one" }, "two", null]), ["one", "two"]);
});

test("gallery picker prevents new duplicate assets and preserves pre-existing duplicate rows", () => {
  const image = "123e4567-e89b-42d3-a456-426614174001";
  const original = [
    { id: "legacy-1", image, alt_text: "First", sort_order: 0, status: "published" },
    { id: "legacy-2", image, alt_text: "Second", sort_order: 1, status: "draft" },
  ];
  assert.equal(buildGalleryPayload(original).image_items.length, 2);
  assert.throws(() => stageGalleryImage(original, image), /уже есть/);
  assert.throws(() => buildGalleryPayload([{ image }, { image }]), /повторяющ/);
  const withoutPrimary = removeGalleryImage(original, 0);
  assert.equal(withoutPrimary[0].id, "legacy-2");
  assert.deepEqual(buildGalleryPayload(withoutPrimary, { mainIndex: 0 }).image_items.map(({ status }) => status), ["draft"]);
});

test("gallery payload leaves main image intact when it is not associated with a child row", () => {
  const existingMain = "123e4567-e89b-42d3-a456-426614174001";
  const staged = "123e4567-e89b-42d3-a456-426614174002";
  const rows = stageGalleryImage([], staged, "New image", null, "draft");
  const payload = buildGalleryPayload(rows, { mainIndex: -1, fallbackMainImage: existingMain, fallbackImageAlt: "Legacy alt" });
  assert.equal(payload.main_image, existingMain);
  assert.equal(payload.image_alt, "Legacy alt");
  assert.equal(payload.image_items[0].status, "draft");
  assert.equal(buildGalleryPayload(rows, { statusField: false }).image_items[0].status, undefined);
  const removedMain = buildGalleryPayload([], { mainIndex: -1, fallbackMainImage: null, fallbackImageAlt: null });
  assert.equal(removedMain.main_image, null);
  assert.equal(removedMain.image_alt, null);
});

test("keyboard tab navigation advances from the focused tab and wraps in both directions", () => {
  const count = 6;
  let focusedIndex = 0;
  focusedIndex = nextTabIndex(focusedIndex, "ArrowRight", count);
  assert.equal(focusedIndex, 1);
  focusedIndex = nextTabIndex(focusedIndex, "ArrowRight", count);
  assert.equal(focusedIndex, 2);
  assert.equal(nextTabIndex(0, "ArrowLeft", count), 5);
  assert.equal(nextTabIndex(2, "Home", count), 2);
});
