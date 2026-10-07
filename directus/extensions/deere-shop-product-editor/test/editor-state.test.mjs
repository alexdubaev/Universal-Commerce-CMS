import test from "node:test";
import assert from "node:assert/strict";
import { addDocumentSlot, buildExpectedSnapshot, buildGalleryPayload, buildNativeFormProps, buildProductChanges, getDocumentFolderId, isDirectusFileId, isSupportedDocumentList, mergeNativeEdits, mergeNativeTabEdits, normalizeGalleryRows, relationIds, reorderGallery, stageGalleryImage, updateDocumentSelection, validateProduct } from "../src/editor-state.mjs";

test("change builder keeps only edits and expected values come from original snapshot", () => {
  const baseline = { id: "p1", updated_at: "v1", title: "Old", price: 4, status: "draft" };
  const current = { ...baseline, title: "New" };
  const changes = buildProductChanges(baseline, current);
  assert.deepEqual(changes, { title: "New" });
  assert.deepEqual(buildExpectedSnapshot(baseline, changes), { id: "p1", updated_at: "v1", title: "Old" });
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
