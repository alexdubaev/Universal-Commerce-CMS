# Поля: Настройки сайта

Статический снимок blueprint/Studio, 2026-10-02. Это не выгрузка фактической БД. Требования readonly ниже дополнительно ограничивают UI; они не изменяют native permissions.

| Поле | Подпись | Тип | Обязательное | Режим нового UI | Допустимые значения / связь | Native group/interface |
|---|---|---|---|---|---|---|
| id | id | uuid | Да | Только просмотр | — |  |
| company_name | company_name | string | Да | По правам и контракту | — |  |
| phone | phone | string | Да | По правам и контракту | — |  |
| email | email | string | Да | По правам и контракту | — |  |
| messengers | messengers | json | Нет | По правам и контракту | — |  |
| social_links | social_links | json | Нет | По правам и контракту | — |  |
| commerce_profile | commerce_profile | json | Нет | Только просмотр | — |  |
| address | address | text | Нет | По правам и контракту | — |  |
| city | city | string | Нет | По правам и контракту | — |  |
| working_hours | working_hours | string | Нет | По правам и контракту | — |  |
| delivery_region | delivery_region | string | Нет | По правам и контракту | — |  |
| logo | logo | uuid | Нет | По правам и контракту | "directus_files" | file-image |
| favicon | favicon | uuid | Нет | По правам и контракту | "directus_files" | file-image |
| default_og_image | default_og_image | uuid | Нет | По правам и контракту | "directus_files" |  |
| seo_title | seo_title | string | Нет | По правам и контракту | — |  |
| seo_description | seo_description | text | Нет | По правам и контракту | — |  |
| og_title | og_title | string | Нет | По правам и контракту | — |  |
| og_description | og_description | text | Нет | По правам и контракту | — |  |
| primary_color | primary_color | string | Нет | По правам и контракту | — |  |
| accent_color | accent_color | string | Нет | По правам и контракту | — |  |
| primary_cta_text | primary_cta_text | string | Нет | По правам и контракту | — |  |
| primary_cta_url | primary_cta_url | string | Нет | По правам и контракту | — |  |
| footer_text | footer_text | text | Нет | По правам и контракту | — |  |
| footer_disclaimer | footer_disclaimer | text | Нет | По правам и контракту | — |  |
| inn | inn | string | Нет | По правам и контракту | — |  |
| kpp | kpp | string | Нет | По правам и контракту | — |  |
| ogrn | ogrn | string | Нет | По правам и контракту | — |  |
| legal_address | legal_address | text | Нет | По правам и контракту | — |  |
| legal_name | legal_name | string | Нет | По правам и контракту | — |  |
| vat_info | vat_info | string | Нет | По правам и контракту | — |  |
| requisites_url | requisites_url | string | Нет | По правам и контракту | — |  |
| documents_url | documents_url | string | Нет | По правам и контракту | — |  |
| company_image | company_image | uuid | Нет | По правам и контракту | "directus_files" |  |
| yandex_metrica_id | yandex_metrica_id | string | Нет | Только просмотр | — |  |
| gtm_id | gtm_id | string | Нет | Только просмотр | — |  |
| translations | translations | json | Нет | По правам и контракту | — |  |
| created_at | created_at | timestamp | Нет | Только просмотр | — |  |
| updated_at | updated_at | timestamp | Нет | Только просмотр | — |  |
