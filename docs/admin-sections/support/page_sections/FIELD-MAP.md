# Поля: Секции страниц

Статический снимок blueprint/Studio, 2026-10-02. Это не выгрузка фактической БД. Требования readonly ниже дополнительно ограничивают UI; они не изменяют native permissions.

Владелец UI-компонента: A0 / home_page + pages. Это распределение задач, а не schema-связь или родительская коллекция. См. ../../CONTRACTS.md и ../../NATIVE-SURFACES.md.

| Поле | Подпись | Тип | Обязательное | Режим нового UI | Допустимые значения / связь | Native group/interface |
|---|---|---|---|---|---|---|
| id | id | uuid | Да | Только просмотр | — |  |
| status | status | string | Да | По правам и контракту | draft, published, archived |  |
| home_page | home_page | uuid | Нет | По правам и контракту | "home_page" |  |
| page | page | uuid | Нет | По правам и контракту | "pages" |  |
| section_type | section_type | string | Да | По правам и контракту | hero, categories, company_trust, featured_products, advantages, steps, cta, catalog_preview, seo_text, lead_form, parts_request, recent_supplies, faq, contacts, articles, custom |  |
| title | title | string | Нет | По правам и контракту | — |  |
| subtitle | subtitle | string | Нет | По правам и контракту | — |  |
| text | text | text | Нет | По правам и контракту | — |  |
| image | image | uuid | Нет | По правам и контракту | "directus_files" | file-image |
| image_alt | image_alt | string | Нет | По правам и контракту | — |  |
| button_text | button_text | string | Нет | По правам и контракту | — |  |
| button_url | button_url | string | Нет | По правам и контракту | — |  |
| items | items | json | Нет | По правам и контракту | — |  |
| settings | settings | json | Нет | По правам и контракту | — |  |
| is_visible | is_visible | boolean | Нет | По правам и контракту | — |  |
| sort_order | sort_order | integer | Нет | По правам и контракту | — |  |
| translations | translations | json | Нет | По правам и контракту | — |  |
| created_at | created_at | timestamp | Нет | Только просмотр | — |  |
| updated_at | updated_at | timestamp | Нет | Только просмотр | — |  |
