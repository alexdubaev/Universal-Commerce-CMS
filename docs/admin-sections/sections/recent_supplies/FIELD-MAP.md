# Поля: Недавние поставки

Статический снимок blueprint/Studio, 2026-10-02. Это не выгрузка фактической БД. Требования readonly ниже дополнительно ограничивают UI; они не изменяют native permissions.

| Поле | Подпись | Тип | Обязательное | Режим нового UI | Допустимые значения / связь | Native group/interface |
|---|---|---|---|---|---|---|
| id | id | uuid | Да | Только просмотр до отдельного контракта | — |  |
| status | status | string | Да | Только просмотр до отдельного контракта | draft, published, archived |  |
| image | image | uuid | Нет | Только просмотр до отдельного контракта | "directus_files" |  |
| image_alt | image_alt | string | Нет | Только просмотр до отдельного контракта | — |  |
| equipment_type | equipment_type | string | Нет | Только просмотр до отдельного контракта | — |  |
| positions | positions | json | Нет | Только просмотр до отдельного контракта | — |  |
| region | region | string | Нет | Только просмотр до отдельного контракта | — |  |
| delivery_term | delivery_term | string | Нет | Только просмотр до отдельного контракта | — |  |
| supply_format | supply_format | string | Нет | Только просмотр до отдельного контракта | — |  |
| supplied_at | supplied_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
| sort_order | sort_order | integer | Нет | Только просмотр до отдельного контракта | — |  |
| translations | translations | json | Нет | Только просмотр до отдельного контракта | — |  |
| created_at | created_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
| updated_at | updated_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
