# Поля: Характеристики товаров

Статический снимок blueprint/Studio, 2026-10-02. Это не выгрузка фактической БД. Требования readonly ниже дополнительно ограничивают UI; они не изменяют native permissions.

Владелец UI-компонента: products. Это распределение задач, а не schema-связь или родительская коллекция. См. ../../CONTRACTS.md и ../../NATIVE-SURFACES.md.

Ограничение всей коллекции: **Существующий режим; при media_sources=children только просмотр**. Оно имеет приоритет над общей пометкой «По правам и контракту» в таблице ниже.

| Поле | Подпись | Тип | Обязательное | Режим нового UI | Допустимые значения / связь | Native group/interface |
|---|---|---|---|---|---|---|
| id | id | uuid | Да | Только просмотр | — |  |
| status | status | string | Да | По правам и контракту | draft, published, archived |  |
| product | product | uuid | Да | По правам и контракту | "products" |  |
| group_name | group_name | string | Нет | По правам и контракту | — |  |
| name | name | string | Да | По правам и контракту | — |  |
| value | value | string | Да | По правам и контракту | — |  |
| unit | unit | string | Нет | По правам и контракту | — |  |
| sort_order | sort_order | integer | Нет | По правам и контракту | — |  |
| translations | translations | json | Нет | По правам и контракту | — |  |
| created_at | created_at | timestamp | Нет | Только просмотр | — |  |
| updated_at | updated_at | timestamp | Нет | Только просмотр | — |  |
