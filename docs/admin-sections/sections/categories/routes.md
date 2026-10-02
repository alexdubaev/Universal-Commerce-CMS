# Маршруты и данные

## Состояние

Предлагаемые маршруты; появятся только после отдельной интеграции registry. Сейчас они не существуют.

## Предложенная навигация

- Список: `/admin/product-editor/sections/categories`.
- Деталь: `/admin/product-editor/sections/categories/:id`.
- Создание: `/admin/product-editor/sections/categories/+`.
- Для singleton единственный экран — базовый маршрут; таблицы списка, `/+` и `/:id` нет. Ошибочная cardinality блокирует экран.
- `products` остаётся на существующих `/admin/product-editor`, `/admin/product-editor/+` и `/admin/product-editor/:id`; новую секцию не создавать.

Для всех новых секций используется префикс `/admin/product-editor/sections/`. Он избегает конфликта существующего динамического маршрута `/admin/product-editor/:id`. До интеграции custom module все эти адреса — спецификация и не должны считаться работающими браузерными путями.

## Directus data

- Коллекция: `categories`.
- Список получает только колонки таблицы, фильтры и ограниченную страницу `GET /items/categories?limit=25&page=1`; фактический синтаксис фильтров сверить с действующей Directus API. Один item загружается по ID с точными allowed fields из [fields.json](fields.json).
- Assets открывать в штатной Directus file library; удаление ассета не входит в detach поля.

## Routes для внешней проверки

Существующие публичные страницы перечислены только как будущий read-only smoke после отдельно разрешённой тестовой публикации. Этот список не активирует запись или deploy.
