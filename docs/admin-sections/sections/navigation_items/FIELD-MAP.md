# Поля: Меню

Статический снимок blueprint/Studio, 2026-10-02. Это не выгрузка фактической БД. Требования readonly ниже дополнительно ограничивают UI; они не изменяют native permissions.

| Поле | Подпись | Тип | Обязательное | Режим нового UI | Допустимые значения / связь | Native group/interface |
|---|---|---|---|---|---|---|
| id | id | uuid | Да | Только просмотр до отдельного контракта | — |  |
| status | status | string | Да | Только просмотр до отдельного контракта | draft, published, archived |  |
| label | label | string | Да | Только просмотр до отдельного контракта | — |  |
| url | url | string | Да | Только просмотр до отдельного контракта | — |  |
| parent | parent | uuid | Нет | Только просмотр до отдельного контракта | "navigation_items" |  |
| location | location | string | Да | Только просмотр до отдельного контракта | header, footer, legal |  |
| open_in_new_tab | open_in_new_tab | boolean | Нет | Только просмотр до отдельного контракта | — |  |
| is_visible | is_visible | boolean | Нет | Только просмотр до отдельного контракта | — |  |
| sort_order | sort_order | integer | Нет | Только просмотр до отдельного контракта | — |  |
| translations | translations | json | Нет | Только просмотр до отдельного контракта | — |  |
| created_at | created_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
| updated_at | updated_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
