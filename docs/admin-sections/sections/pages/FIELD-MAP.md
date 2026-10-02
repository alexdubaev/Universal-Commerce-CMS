# Поля: Страницы

Статический снимок blueprint/Studio, 2026-10-02. Это не выгрузка фактической БД. Требования readonly ниже дополнительно ограничивают UI; они не изменяют native permissions.

| Поле | Подпись | Тип | Обязательное | Режим нового UI | Допустимые значения / связь | Native group/interface |
|---|---|---|---|---|---|---|
| id | id | uuid | Да | Только просмотр | — |  |
| status | status | string | Да | По правам и контракту | draft, published, archived |  |
| title | title | string | Да | По правам и контракту | — |  |
| slug | slug | string | Да | По правам и контракту | — |  |
| page_type | page_type | string | Да | По правам и контракту | home, catalog, about, delivery, contacts, privacy_policy, thank_you, articles, standard |  |
| h1 | h1 | string | Да | По правам и контракту | — |  |
| eyebrow | eyebrow | string | Нет | По правам и контракту | — |  |
| intro | intro | text | Нет | По правам и контракту | — |  |
| seo_title | seo_title | string | Нет | По правам и контракту | — |  |
| seo_description | seo_description | text | Нет | По правам и контракту | — |  |
| seo_text | seo_text | text | Нет | По правам и контракту | — |  |
| og_image | og_image | uuid | Нет | По правам и контракту | "directus_files" |  |
| canonical_url | canonical_url | text | Нет | По правам и контракту | — |  |
| is_indexable | is_indexable | boolean | Нет | По правам и контракту | — |  |
| seo | seo | json | Нет | По правам и контракту | — | seo-interface |
| translations | translations | json | Нет | По правам и контракту | — |  |
| created_at | created_at | timestamp | Нет | Только просмотр | — |  |
| updated_at | updated_at | timestamp | Нет | Только просмотр | — |  |
