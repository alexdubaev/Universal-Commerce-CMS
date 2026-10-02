# Поля: Аналоги товаров

Статический снимок blueprint/Studio, 2026-10-02. Это не выгрузка фактической БД. Требования readonly ниже дополнительно ограничивают UI; они не изменяют native permissions.

| Поле | Подпись | Тип | Обязательное | Режим нового UI | Допустимые значения / связь | Native group/interface |
|---|---|---|---|---|---|---|
| id | id | uuid | Да | Только просмотр до отдельного контракта | — |  |
| product_from | product_from | uuid | Да | Только просмотр до отдельного контракта | "products" |  |
| product_to | product_to | uuid | Да | Только просмотр до отдельного контракта | "products" |  |
| relation_type | relation_type | string | Да | Только просмотр до отдельного контракта | analog, oem_cross, compatible, superseded_by |  |
| canonical_key | canonical_key | string | Да | Только просмотр до отдельного контракта | — |  |
| source_name | source_name | string | Да | Только просмотр до отдельного контракта | — |  |
| note | note | text | Нет | Только просмотр до отдельного контракта | — |  |
| verified_at | verified_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
| created_at | created_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
| updated_at | updated_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
