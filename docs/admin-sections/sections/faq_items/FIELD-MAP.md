# Поля: Вопросы и ответы

Статический снимок blueprint/Studio, 2026-10-02. Это не выгрузка фактической БД. Требования readonly ниже дополнительно ограничивают UI; они не изменяют native permissions.

| Поле | Подпись | Тип | Обязательное | Режим нового UI | Допустимые значения / связь | Native group/interface |
|---|---|---|---|---|---|---|
| id | id | uuid | Да | Только просмотр до отдельного контракта | — |  |
| status | status | string | Да | Только просмотр до отдельного контракта | draft, published, archived |  |
| question | question | string | Да | Только просмотр до отдельного контракта | — |  |
| answer | answer | text | Да | Только просмотр до отдельного контракта | — |  |
| page | page | uuid | Нет | Только просмотр до отдельного контракта | "pages" |  |
| category | category | uuid | Нет | Только просмотр до отдельного контракта | "categories" |  |
| product | product | uuid | Нет | Только просмотр до отдельного контракта | "products" |  |
| sort_order | sort_order | integer | Нет | Только просмотр до отдельного контракта | — |  |
| is_visible | is_visible | boolean | Нет | Только просмотр до отдельного контракта | — |  |
| translations | translations | json | Нет | Только просмотр до отдельного контракта | — |  |
| created_at | created_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
| updated_at | updated_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
