import test from "node:test";
import assert from "node:assert/strict";

import { productEditorBlueprint } from "./product-editor-blueprint.mjs";

test("product editor prioritizes Russian product identity and commercial editing", () => {
  const layout = productEditorBlueprint.fields.products;
  const fields = layout.fields;
  assert.deepEqual(Object.keys(layout.groups).slice(0, 2), ["group_main", "group_price"]);
  assert.deepEqual(
    [fields.title.label, fields.brand.label, fields.sku.label, fields.slug.label],
    ["Название товара", "Бренд", "Артикул (SKU)", "Адрес товара"],
  );
  for (const name of ["title", "brand", "sku", "slug"]) {
    assert.equal(fields[name].required, true, `${name} should be marked required in the editor`);
    assert.equal(fields[name].group, "group_main");
  }
  assert.equal(fields.price_status.group, "group_price");
  assert.equal(fields.availability_status.group, "group_price");
  assert.equal(fields.status.options.choices.find((choice) => choice.value === "published").text, "Опубликован");
  assert.equal(fields.price_status.options.choices.find((choice) => choice.value === "on_request").text, "Цена по запросу");
  assert.equal(fields.availability_status.options.choices.find((choice) => choice.value === "in_stock").text, "В наличии");
  assert.equal(fields.part_type.options.choices.find((choice) => choice.value === "analog").text, "Аналог");
  assert.equal(fields.currency.interface, "input");
  assert.equal(fields.category.options.template, "{{title}}");
  assert.equal(fields.category.options.enableCreate, false);
  assert.equal(fields.seo_quality_status.interface, "select-dropdown");
  assert.deepEqual(fields.seo_quality_status.options.choices.map(({ value }) => value), ["pending", "reviewed", "published", "needs_fix"]);
  for (const name of ["status", "price_status", "availability_status", "part_type"]) assert.equal(fields[name].interface, "select-dropdown");
  assert.equal(layout.groups.group_main.interface, "group-detail");
  assert.equal(layout.groups.group_main.options.start, "open");
  assert.equal(layout.groups.group_seo.options.start, "closed");
});

test("product editor uses native images and repeaters without exposing unsupported JSON", () => {
  const products = productEditorBlueprint.fields.products.fields;
  const images = productEditorBlueprint.fields.product_images.fields;
  assert.equal(products.main_image.interface, "file-image");
  assert.equal(products.image_items.interface, "list-o2m");
  assert.equal(products.image_items.hidden, false);
  assert.equal(products.image_items.options.template, "{{image.title}} — {{alt_text}}");
  assert.equal(products.image_items.options.template.includes("{{image}}"), false);
  assert.equal(products.gallery.hidden, true);
  assert.equal(products.gallery.readonly, true);
  assert.equal(images.image.interface, "file-image");
  assert.equal(images.status.interface, "select-dropdown");
  assert.equal(images.status.options.choices.find(({ value }) => value === "published").text, "Опубликована");
  assert.match(images.status.note, /показывается ли фотография/);
  assert.equal(images.id.required, false);
  assert.equal(images.id.hidden, true);
  assert.equal(images.image_items, undefined);
  assert.equal(products.specifications.interface, "list");
  assert.equal(products.documents.interface, "list");
  for (const name of ["seo", "translations", "media_sources", "brand_key", "identity_key", "analogs_from", "analogs_to"]) {
    assert.equal(products[name].hidden, true, `${name} should not appear as a JSON or service field`);
  }
  assert.equal(products.related_products.hidden, true);
  assert.equal(products.slug.note.includes("латиниц"), true);
});
