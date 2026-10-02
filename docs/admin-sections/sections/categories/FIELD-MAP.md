# Поля: Категории

Статический снимок blueprint/Studio, 2026-10-02. Это не выгрузка фактической БД. Требования readonly ниже дополнительно ограничивают UI; они не изменяют native permissions.

| Поле | Подпись | Тип | Обязательное | Режим нового UI | Допустимые значения / связь | Native group/interface |
|---|---|---|---|---|---|---|
| id | id | uuid | Да | Только просмотр | — |  |
| status | status | string | Да | По правам и контракту | draft, published, archived |  |
| title | title | string | Да | По правам и контракту | — |  |
| slug | slug | string | Да | По правам и контракту | — |  |
| parent | parent | uuid | Нет | По правам и контракту | "categories" |  |
| description | description | text | Нет | По правам и контракту | — |  |
| image | image | uuid | Нет | По правам и контракту | "directus_files" |  |
| image_alt | image_alt | string | Нет | По правам и контракту | — |  |
| icon | icon | uuid | Нет | По правам и контракту | "directus_files" |  |
| icon_alt | icon_alt | string | Нет | По правам и контракту | — |  |
| h1 | h1 | string | Нет | По правам и контракту | — |  |
| seo_title | seo_title | string | Нет | По правам и контракту | — |  |
| seo_description | seo_description | text | Нет | По правам и контракту | — |  |
| seo_text | seo_text | text | Нет | По правам и контракту | — |  |
| intro | intro | text | Нет | По правам и контракту | — |  |
| selection_guide | selection_guide | json | Нет | По правам и контракту | — |  |
| internal_links | internal_links | json | Нет | По правам и контракту | — |  |
| og_image | og_image | uuid | Нет | По правам и контракту | "directus_files" |  |
| faq | faq | json | Нет | По правам и контракту | — |  |
| is_indexable | is_indexable | boolean | Нет | По правам и контракту | — |  |
| seo | seo | json | Нет | По правам и контракту | — | seo-interface |
| redirect_target | redirect_target | string | Нет | По правам и контракту | — |  |
| sort_order | sort_order | integer | Нет | По правам и контракту | — |  |
| show_on_homepage | show_on_homepage | boolean | Нет | По правам и контракту | — |  |
| translations | translations | json | Нет | По правам и контракту | — |  |
| created_at | created_at | timestamp | Нет | Только просмотр | — |  |
| updated_at | updated_at | timestamp | Нет | Только просмотр | — |  |
