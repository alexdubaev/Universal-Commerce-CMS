# Поля: Главная страница

Статический снимок blueprint/Studio, 2026-10-02. Это не выгрузка фактической БД. Требования readonly ниже дополнительно ограничивают UI; они не изменяют native permissions.

| Поле | Подпись | Тип | Обязательное | Режим нового UI | Допустимые значения / связь | Native group/interface |
|---|---|---|---|---|---|---|
| id | id | uuid | Да | Только просмотр | — |  |
| status | status | string | Да | По правам и контракту | draft, published, archived |  |
| source_page | source_page | uuid | Да | По правам и контракту | "pages" |  |
| h1 | h1 | string | Да | По правам и контракту | — |  |
| hero_title | hero_title | string | Да | По правам и контракту | — |  |
| hero_text | hero_text | text | Да | По правам и контракту | — |  |
| hero_image | hero_image | uuid | Да | По правам и контракту | "directus_files" | file-image |
| hero_image_alt | hero_image_alt | string | Да | По правам и контракту | — |  |
| hero_primary_button_text | hero_primary_button_text | string | Нет | По правам и контракту | — |  |
| hero_primary_button_url | hero_primary_button_url | string | Нет | По правам и контракту | — |  |
| hero_secondary_button_text | hero_secondary_button_text | string | Нет | По правам и контракту | — |  |
| hero_secondary_button_url | hero_secondary_button_url | string | Нет | По правам и контракту | — |  |
| hero_search_label | hero_search_label | string | Да | По правам и контракту | — |  |
| hero_search_placeholder | hero_search_placeholder | string | Да | По правам и контракту | — |  |
| hero_search_button_text | hero_search_button_text | string | Да | По правам и контракту | — |  |
| hero_bulk_prompt | hero_bulk_prompt | string | Да | По правам и контракту | — |  |
| hero_bulk_link_text | hero_bulk_link_text | string | Да | По правам и контракту | — |  |
| hero_bulk_link_url | hero_bulk_link_url | string | Да | По правам и контракту | — |  |
| hero_excel_link_text | hero_excel_link_text | string | Да | По правам и контракту | — |  |
| hero_excel_link_url | hero_excel_link_url | string | Да | По правам и контракту | — |  |
| hero_photo_link_text | hero_photo_link_text | string | Да | По правам и контракту | — |  |
| hero_photo_link_url | hero_photo_link_url | string | Да | По правам и контракту | — |  |
| seo_title | seo_title | string | Нет | По правам и контракту | — |  |
| seo_description | seo_description | text | Нет | По правам и контракту | — |  |
| canonical_url | canonical_url | text | Нет | По правам и контракту | — |  |
| og_title | og_title | string | Нет | По правам и контракту | — |  |
| og_description | og_description | text | Нет | По правам и контракту | — |  |
| og_image | og_image | uuid | Нет | По правам и контракту | "directus_files" |  |
| is_indexable | is_indexable | boolean | Нет | По правам и контракту | — |  |
| seo | seo | json | Нет | По правам и контракту | — | seo-interface |
| sections | sections | alias | Нет | Только просмотр | — | list-o2m |
| translations | translations | json | Нет | По правам и контракту | — |  |
| created_at | created_at | timestamp | Нет | Только просмотр | — |  |
| updated_at | updated_at | timestamp | Нет | Только просмотр | — |  |
