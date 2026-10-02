# Поля: Заказы

Статический снимок blueprint/Studio, 2026-10-02. Это не выгрузка фактической БД. Требования readonly ниже дополнительно ограничивают UI; они не изменяют native permissions.

| Поле | Подпись | Тип | Обязательное | Режим нового UI | Допустимые значения / связь | Native group/interface |
|---|---|---|---|---|---|---|
| id | id | uuid | Да | Только просмотр до отдельного контракта | — |  |
| user_created | user_created | uuid | Нет | Только просмотр до отдельного контракта | "directus_users" |  |
| status | status | string | Да | Только просмотр до отдельного контракта | new, in_progress, confirmed, shipped, delivered, cancelled |  |
| request_key | request_key | uuid | Нет | Только просмотр до отдельного контракта | — |  |
| request_fingerprint | request_fingerprint | string | Нет | Только просмотр до отдельного контракта | — |  |
| customer_name | customer_name | string | Да | Только просмотр до отдельного контракта | — |  |
| phone | phone | string | Да | Только просмотр до отдельного контракта | — |  |
| email | email | string | Нет | Только просмотр до отдельного контракта | — |  |
| comment | comment | text | Нет | Только просмотр до отдельного контракта | — |  |
| total | total | decimal | Нет | Только просмотр до отдельного контракта | — |  |
| currency | currency | string | Да | Только просмотр до отдельного контракта | — |  |
| page_url | page_url | text | Да | Только просмотр до отдельного контракта | — |  |
| utm_source | utm_source | string | Нет | Только просмотр до отдельного контракта | — |  |
| utm_medium | utm_medium | string | Нет | Только просмотр до отдельного контракта | — |  |
| utm_campaign | utm_campaign | string | Нет | Только просмотр до отдельного контракта | — |  |
| utm_content | utm_content | string | Нет | Только просмотр до отдельного контракта | — |  |
| utm_term | utm_term | string | Нет | Только просмотр до отдельного контракта | — |  |
| marketing_consent | marketing_consent | boolean | Нет | Только просмотр до отдельного контракта | — |  |
| marketing_consent_at | marketing_consent_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
| marketing_consent_version | marketing_consent_version | string | Нет | Только просмотр до отдельного контракта | — |  |
| manager_comment | manager_comment | text | Нет | Только просмотр до отдельного контракта | — |  |
| created_at | created_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
| updated_at | updated_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
