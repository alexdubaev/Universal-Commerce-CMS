# Поля: Настройки форм

Статический снимок blueprint/Studio, 2026-10-02. Это не выгрузка фактической БД. Требования readonly ниже дополнительно ограничивают UI; они не изменяют native permissions.

Владелец UI-компонента: site_settings. Это распределение задач, а не schema-связь или родительская коллекция. См. ../../CONTRACTS.md и ../../NATIVE-SURFACES.md.

| Поле | Подпись | Тип | Обязательное | Режим нового UI | Допустимые значения / связь | Native group/interface |
|---|---|---|---|---|---|---|
| id | id | uuid | Да | Только просмотр до отдельного контракта | — |  |
| status | status | string | Да | Только просмотр до отдельного контракта | draft, published, archived |  |
| code | code | string | Да | Только просмотр до отдельного контракта | — |  |
| title | title | string | Да | Только просмотр до отдельного контракта | — |  |
| description | description | text | Нет | Только просмотр до отдельного контракта | — |  |
| button_text | button_text | string | Нет | Только просмотр до отдельного контракта | — |  |
| success_message | success_message | text | Нет | Только просмотр до отдельного контракта | — |  |
| success_url | success_url | string | Нет | Только просмотр до отдельного контракта | — |  |
| fields | fields | json | Нет | Только просмотр до отдельного контракта | — |  |
| turnstile_required | turnstile_required | boolean | Нет | Только просмотр до отдельного контракта | — |  |
| is_active | is_active | boolean | Нет | Только просмотр до отдельного контракта | — |  |
| translations | translations | json | Нет | Только просмотр до отдельного контракта | — |  |
| created_at | created_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
| updated_at | updated_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
