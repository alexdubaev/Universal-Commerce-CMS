const group = (label, sort, closed = false) => ({
  label,
  interface: "group-detail",
  sort,
  options: { start: closed ? "closed" : "open" },
});

const field = (label, groupName, sort, options = {}) => ({
  label,
  group: groupName,
  sort,
  width: options.width ?? "full",
  ...(options.interface ? { interface: options.interface } : (options.options?.choices ? { interface: "select-dropdown" } : {})),
  ...(options.display ? { display: options.display } : {}),
  ...(options.special ? { special: options.special } : {}),
  ...(options.options ? { options: options.options } : {}),
  ...(options.note ? { note: options.note } : {}),
  ...(options.required !== undefined ? { required: options.required } : {}),
  ...(options.hidden !== undefined ? { hidden: options.hidden } : {}),
  ...(options.readonly !== undefined ? { readonly: options.readonly } : {}),
});

const choices = (items) => ({
  choices: items.map(([value, text]) => ({ value, text })),
});

const list = (template, fields) => ({
  interface: "list",
  options: { template, fields },
});

const jsonChild = (fieldName, name, type = "string", required = false) => ({
  field: fieldName,
  name,
  type,
  meta: {
    interface: type === "integer" ? "input" : "input",
    width: "half",
    ...(required ? { required: true } : {}),
  },
});

const productsGroups = {
  group_main: group("Основное", 1),
  group_price: group("Цена и наличие", 2),
  group_media: group("Изображения и документы", 3),
  group_specs: group("Характеристики", 4),
  group_content: group("Описание", 5),
  group_visibility: group("Публикация в каталоге", 6),
  group_seo: group("Поисковая оптимизация", 7, true),
  group_source: group("Источники данных", 8, true),
  group_additional: group("Дополнительно", 9, true),
  group_system: group("Служебные поля", 10, true),
};

const productsFields = {
  title: field("Название товара", "group_main", 1, { required: true, note: "Укажите модель или понятное название детали." }),
  brand: field("Бренд", "group_main", 2, { required: true, width: "half" }),
  sku: field("Артикул (SKU)", "group_main", 3, { required: true, width: "half", note: "Артикул из подтверждённого источника. Не придумывайте значение." }),
  slug: field("Адрес товара", "group_main", 4, { required: true, note: "Уникальная часть URL латиницей, например jd-6155m. Используется в ссылке на товар." }),
  category: field("Категория", "group_main", 5, { width: "half", options: { template: "{{title}}", enableCreate: false } }),
  status: field("Статус публикации", "group_main", 6, { width: "half", options: choices([["draft", "Черновик"], ["published", "Опубликован"], ["archived", "Архив"]]) }),

  price_status: field("Как показывать цену", "group_price", 1, { width: "half", options: choices([["fixed", "Фиксированная цена"], ["on_request", "Цена по запросу"], ["hidden", "Цена скрыта"]]) }),
  price: field("Цена", "group_price", 2, { width: "half", note: "Заполняйте только подтверждённую цену." }),
  currency: field("Валюта", "group_price", 3, { width: "half", interface: "input", note: "Например, RUB. Укажите валюту, принятую для этой цены." }),
  availability_status: field("Наличие", "group_price", 4, { width: "half", options: choices([["in_stock", "В наличии"], ["on_request", "Под заказ"], ["out_of_stock", "Нет в наличии"]]) }),
  delivery_status: field("Условия поставки", "group_price", 5),

  main_image: field("Основное изображение", "group_media", 1, { interface: "file-image", special: ["file"] }),
  image_alt: field("Описание изображения", "group_media", 2, { note: "Кратко опишите, что изображено на фотографии." }),
  image_items: field("Фотографии товара", "group_media", 3, {
    interface: "list-o2m",
    hidden: false,
    options: { layout: "list", template: "{{image.title}} — {{alt_text}}", enableCreate: true, enableSelect: false },
    note: "Добавляйте фотографии и редактируйте alt-текст в списке. Каждый пункт откроется в отдельной форме.",
  }),
  gallery: field("Предпросмотр галереи", "group_media", 4, { hidden: true, readonly: true }),
  documents: field("Документы", "group_media", 5, list("{{title}}", [
    jsonChild("title", "Название", "string", true),
    { field: "file", name: "Файл", type: "uuid", meta: { interface: "file", special: ["file"], width: "half", required: true } },
  ])),

  specifications: field("Характеристики", "group_specs", 1, list("{{name}}: {{value}} {{unit}}", [
    jsonChild("name", "Характеристика", "string", true),
    jsonChild("value", "Значение", "string", true),
    jsonChild("unit", "Единица измерения"),
  ])),
  specification_items: field("Характеристики (связанные записи)", "group_specs", 2, { hidden: true, readonly: true }),
  document_items: field("Документы (связанные записи)", "group_media", 6, { hidden: true, readonly: true }),

  short_description: field("Краткое описание", "group_content", 1),
  full_description: field("Полное описание", "group_content", 2),
  part_type: field("Тип детали", "group_content", 3, { width: "half", options: choices([["original", "Оригинал"], ["oem", "OEM"], ["analog", "Аналог"]]) }),
  cta_text: field("Текст кнопки заявки", "group_content", 4, { width: "half" }),

  is_featured: field("Рекомендуемый товар", "group_visibility", 1, { width: "half" }),
  show_on_homepage: field("Показывать на главной", "group_visibility", 2, { width: "half" }),
  sort_order: field("Порядок в каталоге", "group_visibility", 3, { width: "half" }),
  popularity_score: field("Популярность", "group_visibility", 4, { width: "half", hidden: true }),

  seo_title: field("SEO-заголовок", "group_seo", 1, { note: "Заголовок страницы товара в поисковой выдаче." }),
  seo_description: field("SEO-описание", "group_seo", 2, { note: "Кратко опишите товар и следующий шаг для покупателя." }),
  seo_text: field("Текст о товаре для поиска", "group_seo", 3),
  og_image: field("Изображение для соцсетей", "group_seo", 4, { interface: "file-image", special: ["file"] }),
  seo_quality_status: field("Статус проверки SEO", "group_seo", 5, { width: "half", options: choices([["pending", "Ожидает проверки"], ["reviewed", "Проверен"], ["published", "Проверен и опубликован"], ["needs_fix", "Требуются исправления"]]) }),
  is_indexable: field("Разрешить индексацию", "group_seo", 6, { width: "half" }),
  seo: field("SEO-параметры плагина", "group_seo", 7, { hidden: true, readonly: true }),

  source_name: field("Название источника", "group_source", 1, { width: "half" }),
  source_url: field("Ссылка на источник", "group_source", 2),
  verified_at: field("Дата проверки", "group_source", 3, { width: "half" }),
  reviewed_by: field("Кто проверил", "group_source", 4, { width: "half" }),

  mpn: field("Номер производителя (MPN)", "group_additional", 1, { width: "half" }),
  gtin: field("Штрихкод (GTIN)", "group_additional", 2, { width: "half" }),
  related_products: field("Связанные товары", "group_additional", 3, { hidden: true, note: "Пока для связей используется отдельная форма аналогов." }),
  lead_form: field("Форма заявки", "group_additional", 4, { hidden: true }),
  analogs_from: field("Исходящие связи (служебное)", "group_additional", 5, { hidden: true, readonly: true }),
  analogs_to: field("Входящие связи (служебное)", "group_additional", 6, { hidden: true, readonly: true }),

  id: field("Идентификатор", "group_system", 1, { hidden: true, readonly: true }),
  translations: field("Переводы", "group_system", 2, { hidden: true, readonly: true }),
  created_at: field("Создано", "group_system", 3, { width: "half", readonly: true }),
  updated_at: field("Обновлено", "group_system", 4, { width: "half", readonly: true }),
  media_sources: field("Источник данных медиа", "group_system", 5, { hidden: true, readonly: true }),
  brand_key: field("Ключ бренда", "group_system", 6, { hidden: true, readonly: true }),
  identity_key: field("Ключ идентификации", "group_system", 7, { hidden: true, readonly: true }),
  sku_normalized: field("Нормализованный артикул", "group_system", 8, { hidden: true, readonly: true }),
  mpn_normalized: field("Нормализованный MPN", "group_system", 9, { hidden: true, readonly: true }),
};

const imageGroups = {
  group_image: group("Фотография", 1),
  group_image_details: group("Описание фотографии", 2),
  group_image_system: group("Служебные поля", 3, true),
};

const imageFields = {
  image: field("Файл изображения", "group_image", 1, { interface: "file-image", special: ["file"], required: true }),
  status: field("Публикация фотографии", "group_image", 2, { width: "half", options: choices([["draft", "Черновик"], ["published", "Опубликована"], ["archived", "Архив"]]), note: "Управляет тем, показывается ли фотография посетителям каталога." }),
  alt_text: field("Описание изображения", "group_image_details", 1, { note: "Например: вид техники сбоку или крупный план детали." }),
  sort_order: field("Порядок показа", "group_image_details", 2, { width: "half" }),
  product: field("Товар", "group_image_system", 1, { hidden: true, readonly: true }),
  id: field("Идентификатор", "group_image_system", 2, { hidden: true, readonly: true, required: false }),
  translations: field("Переводы", "group_image_system", 3, { hidden: true, readonly: true }),
  created_at: field("Создано", "group_image_system", 4, { width: "half", readonly: true }),
  updated_at: field("Обновлено", "group_image_system", 5, { width: "half", readonly: true }),
};

const type = (fieldName, fieldType, relatedCollection = null) => ({ field: fieldName, type: fieldType, relatedCollection });

export const productEditorBlueprint = {
  collections: ["products", "product_images"],
  fields: {
    products: { groups: productsGroups, fields: productsFields },
    product_images: { groups: imageGroups, fields: imageFields },
  },
  schema: {
    products: Object.fromEntries([
      type("id", "uuid"), type("status", "string"), type("title", "string"), type("brand", "string"),
      type("sku", "string"), type("slug", "string"), type("category", "uuid", "categories"),
      type("price_status", "string"), type("price", "decimal"), type("currency", "string"),
      type("availability_status", "string"), type("delivery_status", "string"), type("main_image", "uuid", "directus_files"),
      type("image_items", "alias"), type("gallery", "json"), type("documents", "json"), type("specifications", "json"),
      type("image_alt", "string"),
      type("document_items", "alias"), type("specification_items", "alias"), type("short_description", "text"),
      type("full_description", "text"), type("part_type", "string"), type("cta_text", "string"), type("is_featured", "boolean"),
      type("show_on_homepage", "boolean"), type("sort_order", "integer"), type("popularity_score", "integer"),
      type("seo_title", "string"), type("seo_description", "text"), type("seo_text", "text"), type("og_image", "uuid", "directus_files"),
      type("seo_quality_status", "string"), type("is_indexable", "boolean"), type("seo", "json"), type("source_name", "string"),
      type("source_url", "string"), type("verified_at", "timestamp"), type("reviewed_by", "string"),
      type("mpn", "string"), type("gtin", "string"), type("related_products", "json"), type("lead_form", "uuid", "lead_forms"),
      type("analogs_from", "alias"), type("analogs_to", "alias"), type("translations", "json"), type("created_at", "timestamp"),
      type("updated_at", "timestamp"), type("media_sources", "json"), type("brand_key", "string"), type("identity_key", "string"),
      type("sku_normalized", "string"), type("mpn_normalized", "string"),
    ].map(({ field: name, ...spec }) => [name, spec])),
    product_images: Object.fromEntries([
      type("id", "uuid"), type("product", "uuid", "products"), type("image", "uuid", "directus_files"),
      type("status", "string"), type("alt_text", "string"), type("sort_order", "integer"), type("translations", "json"),
      type("created_at", "timestamp"), type("updated_at", "timestamp"),
    ].map(({ field: name, ...spec }) => [name, spec])),
  },
  relations: [{ collection: "product_images", field: "product", related_collection: "products", one_field: "image_items" }],
};
