# Поля: Коды товаров

Статический снимок blueprint/Studio, 2026-10-02. Это не выгрузка фактической БД. Требования readonly ниже дополнительно ограничивают UI; они не изменяют native permissions.

| Поле | Подпись | Тип | Обязательное | Режим нового UI | Допустимые значения / связь | Native group/interface |
|---|---|---|---|---|---|---|
| id | id | uuid | Да | Только просмотр | — |  |
| product | product | uuid | Да | По правам и контракту | "products" |  |
| code | code | string | Да | По правам и контракту | — |  |
| normalized_code | normalized_code | string | Да | По правам и контракту | — |  |
| code_type | code_type | string | Да | По правам и контракту | oem, mpn, supplier, previous, superseded, external, barcode |  |
| source_name | source_name | string | Да | По правам и контракту | — |  |
| source_reference | source_reference | string | Нет | По правам и контракту | — |  |
| is_active | is_active | boolean | Нет | По правам и контракту | — |  |
| created_at | created_at | timestamp | Нет | Только просмотр | — |  |
| updated_at | updated_at | timestamp | Нет | Только просмотр | — |  |
