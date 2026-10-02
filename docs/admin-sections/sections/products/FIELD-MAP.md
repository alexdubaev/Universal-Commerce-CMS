# Поля: Товары

Статический снимок blueprint/Studio, 2026-10-02. Это не выгрузка фактической БД. Требования readonly ниже дополнительно ограничивают UI; они не изменяют native permissions.

| Поле | Подпись | Тип | Обязательное | Режим нового UI | Допустимые значения / связь | Native group/interface |
|---|---|---|---|---|---|---|
| id | id | uuid | Да | Только просмотр | — |  |
| status | status | string | Да | По правам и контракту | draft, published, archived |  |
| title | title | string | Да | По правам и контракту | — |  |
| slug | slug | string | Да | По правам и контракту | — |  |
| sku | sku | string | Да | По правам и контракту | — |  |
| category | category | uuid | Нет | По правам и контракту | "categories" |  |
| short_description | short_description | text | Нет | По правам и контракту | — |  |
| full_description | full_description | text | Нет | По правам и контракту | — |  |
| seo_text | seo_text | text | Нет | По правам и контракту | — |  |
| main_image | main_image | uuid | Нет | По правам и контракту | "directus_files" |  |
| gallery | gallery | json | Нет | По правам и контракту | — |  |
| media_sources | media_sources | json | Нет | Только просмотр | — |  |
| price | price | decimal | Нет | По правам и контракту | — |  |
| currency | currency | string | Да | По правам и контракту | — |  |
| price_status | price_status | string | Да | По правам и контракту | fixed, on_request, hidden |  |
| availability_status | availability_status | string | Да | По правам и контракту | in_stock, on_request, out_of_stock |  |
| brand | brand | string | Нет | По правам и контракту | — |  |
| brand_key | brand_key | string | Нет | Только просмотр | — |  |
| identity_key | identity_key | string | Нет | Только просмотр | — |  |
| mpn | mpn | string | Нет | По правам и контракту | — |  |
| gtin | gtin | string | Нет | По правам и контракту | — |  |
| sku_normalized | sku_normalized | string | Нет | По правам и контракту | — |  |
| mpn_normalized | mpn_normalized | string | Нет | По правам и контракту | — |  |
| part_type | part_type | string | Нет | По правам и контракту | original, oem, analog |  |
| delivery_status | delivery_status | string | Нет | По правам и контракту | — |  |
| specifications | specifications | json | Нет | По правам и контракту | — |  |
| documents | documents | json | Нет | По правам и контракту | — |  |
| image_items | image_items | alias | Нет | Только просмотр | "product_images" |  |
| specification_items | specification_items | alias | Нет | Только просмотр | "product_specifications" |  |
| document_items | document_items | alias | Нет | Только просмотр | "product_documents" |  |
| analogs_from | analogs_from | alias | Нет | Только просмотр | "products_analogs" |  |
| analogs_to | analogs_to | alias | Нет | Только просмотр | "products_analogs" |  |
| source_name | source_name | string | Нет | По правам и контракту | — |  |
| source_url | source_url | string | Нет | По правам и контракту | — |  |
| verified_at | verified_at | timestamp | Нет | По правам и контракту | — |  |
| reviewed_by | reviewed_by | string | Нет | По правам и контракту | — |  |
| seo_title | seo_title | string | Нет | По правам и контракту | — |  |
| seo_description | seo_description | text | Нет | По правам и контракту | — |  |
| og_image | og_image | uuid | Нет | По правам и контракту | "directus_files" |  |
| image_alt | image_alt | string | Нет | По правам и контракту | — |  |
| seo_quality_status | seo_quality_status | string | Нет | По правам и контракту | pending, reviewed, published, needs_fix |  |
| is_indexable | is_indexable | boolean | Нет | По правам и контракту | — |  |
| seo | seo | json | Нет | По правам и контракту | — | seo-interface |
| sort_order | sort_order | integer | Нет | По правам и контракту | — |  |
| popularity_score | popularity_score | integer | Нет | По правам и контракту | — |  |
| is_featured | is_featured | boolean | Нет | По правам и контракту | — |  |
| show_on_homepage | show_on_homepage | boolean | Нет | По правам и контракту | — |  |
| cta_text | cta_text | string | Нет | По правам и контракту | — |  |
| related_products | related_products | json | Нет | По правам и контракту | — |  |
| lead_form | lead_form | uuid | Нет | По правам и контракту | "lead_forms" |  |
| translations | translations | json | Нет | По правам и контракту | — |  |
| created_at | created_at | timestamp | Нет | Только просмотр | — |  |
| updated_at | updated_at | timestamp | Нет | Только просмотр | — |  |
