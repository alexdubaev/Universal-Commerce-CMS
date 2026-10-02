# Поля: Позиции заказов

Статический снимок blueprint/Studio, 2026-10-02. Это не выгрузка фактической БД. Требования readonly ниже дополнительно ограничивают UI; они не изменяют native permissions.

Владелец UI-компонента: orders. Это распределение задач, а не schema-связь или родительская коллекция. См. ../../CONTRACTS.md и ../../NATIVE-SURFACES.md.

Ограничение всей коллекции: **Только просмотр исторического снимка**. Оно имеет приоритет над общей пометкой «По правам и контракту» в таблице ниже.

| Поле | Подпись | Тип | Обязательное | Режим нового UI | Допустимые значения / связь | Native group/interface |
|---|---|---|---|---|---|---|
| id | id | uuid | Да | Только просмотр | — |  |
| order | order | uuid | Да | По правам и контракту | "orders" |  |
| product | product | uuid | Нет | По правам и контракту | "products" |  |
| sku_snapshot | sku_snapshot | string | Нет | По правам и контракту | — |  |
| title_snapshot | title_snapshot | text | Нет | По правам и контракту | — |  |
| brand_snapshot | brand_snapshot | string | Нет | По правам и контракту | — |  |
| unit_price | unit_price | decimal | Нет | По правам и контракту | — |  |
| quantity | quantity | integer | Да | По правам и контракту | — |  |
| currency | currency | string | Да | По правам и контракту | — |  |
| created_at | created_at | timestamp | Нет | Только просмотр | — |  |
| updated_at | updated_at | timestamp | Нет | Только просмотр | — |  |
