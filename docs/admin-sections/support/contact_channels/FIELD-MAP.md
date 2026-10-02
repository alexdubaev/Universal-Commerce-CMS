# Поля: Каналы связи

Статический снимок blueprint/Studio, 2026-10-02. Это не выгрузка фактической БД. Требования readonly ниже дополнительно ограничивают UI; они не изменяют native permissions.

Владелец UI-компонента: A0 / home_page + pages. Это распределение задач, а не schema-связь или родительская коллекция. См. ../../CONTRACTS.md и ../../NATIVE-SURFACES.md.

| Поле | Подпись | Тип | Обязательное | Режим нового UI | Допустимые значения / связь | Native group/interface |
|---|---|---|---|---|---|---|
| id | id | uuid | Да | Только просмотр до отдельного контракта | — |  |
| status | status | string | Да | Только просмотр до отдельного контракта | draft, published, archived |  |
| page_section | page_section | uuid | Нет | Только просмотр до отдельного контракта | "page_sections" |  |
| channel_type | channel_type | string | Да | Только просмотр до отдельного контракта | phone, email, messenger, address, hours |  |
| label | label | string | Да | Только просмотр до отдельного контракта | — |  |
| value | value | string | Да | Только просмотр до отдельного контракта | — |  |
| url | url | string | Нет | Только просмотр до отдельного контракта | — |  |
| icon | icon | string | Нет | Только просмотр до отдельного контракта | — |  |
| sort_order | sort_order | integer | Нет | Только просмотр до отдельного контракта | — |  |
| is_visible | is_visible | boolean | Нет | Только просмотр до отдельного контракта | — |  |
| translations | translations | json | Нет | Только просмотр до отдельного контракта | — |  |
| created_at | created_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
| updated_at | updated_at | timestamp | Нет | Только просмотр до отдельного контракта | — |  |
