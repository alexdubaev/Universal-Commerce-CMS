# Поля: Статьи

Статический снимок blueprint/Studio, 2026-10-02. Это не выгрузка фактической БД. Требования readonly ниже дополнительно ограничивают UI; они не изменяют native permissions.

| Поле | Подпись | Тип | Обязательное | Режим нового UI | Допустимые значения / связь | Native group/interface |
|---|---|---|---|---|---|---|
| id | id | uuid | Да | Только просмотр | — |  |
| status | status | string | Да | По правам и контракту | draft, published, archived |  |
| title | title | string | Да | По правам и контракту | — |  |
| slug | slug | string | Да | По правам и контракту | — |  |
| excerpt | excerpt | text | Да | По правам и контракту | — |  |
| content | content | text | Да | По правам и контракту | — | input-rich-text-html |
| content_blocks | content_blocks | json | Нет | По правам и контракту | — | flexible-editor |
| editor_nodes | editor_nodes | alias | Нет | Только просмотр | "articles_editor_nodes" |  |
| cover_image | cover_image | uuid | Нет | По правам и контракту | "directus_files" |  |
| image_alt | image_alt | string | Нет | По правам и контракту | — |  |
| published_at | published_at | timestamp | Да | По правам и контракту | — |  |
| category_label | category_label | string | Нет | По правам и контракту | — |  |
| reading_time_minutes | reading_time_minutes | integer | Нет | По правам и контракту | — |  |
| author | author | string | Нет | По правам и контракту | — |  |
| reviewer | reviewer | string | Нет | По правам и контракту | — |  |
| sources | sources | json | Нет | По правам и контракту | — |  |
| related_categories | related_categories | json | Нет | По правам и контракту | — |  |
| related_products | related_products | json | Нет | По правам и контракту | — |  |
| is_featured | is_featured | boolean | Нет | По правам и контракту | — |  |
| sort_order | sort_order | integer | Нет | По правам и контракту | — |  |
| seo_title | seo_title | string | Нет | По правам и контракту | — |  |
| seo_description | seo_description | text | Нет | По правам и контракту | — |  |
| og_image | og_image | uuid | Нет | По правам и контракту | "directus_files" |  |
| seo | seo | json | Нет | По правам и контракту | — | seo-interface |
| translations | translations | json | Нет | По правам и контракту | — |  |
| created_at | created_at | timestamp | Нет | Только просмотр | — |  |
| updated_at | updated_at | timestamp | Нет | Только просмотр | — |  |
