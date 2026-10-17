# Маршруты и данные

## Состояние

Реализованы в A1 поверх A0. В registry активирован только `categories`. Вход — кнопка «Категории» в существующем списке товаров.

## Предложенная навигация

- Список: `/admin/product-editor/sections/categories`.
- Деталь: `/admin/product-editor/sections/categories/:id`.
- Создание: `/admin/product-editor/sections/categories/+`.
- Для singleton единственный экран — базовый маршрут; таблицы списка, `/+` и `/:id` нет. Ошибочная cardinality блокирует экран.
- `products` остаётся на существующих `/admin/product-editor`, `/admin/product-editor/+` и `/admin/product-editor/:id`; новую секцию не создавать.

Используется префикс `/admin/product-editor/sections/`, не конфликтующий с товарными маршрутами. Список, карточка и создание categories проверены в реальном Directus. Другие секции не активированы. Пустой optional `id` из Vue Router трактуется как список.

## Directus data

- Коллекция: `categories`.
- Список получает только колонки таблицы, фильтры и ограниченную страницу `GET /items/categories?limit=25&page=1`; фактический синтаксис фильтров сверить с действующей Directus API. Один item загружается по ID с точными allowed fields из [fields.json](fields.json).
- Assets открывать в штатной Directus file library; удаление ассета не входит в detach поля.

## Контракт A1

Обновление — только `POST /commerce/mutations/categories/:id` с `{expected, changes}`. Создание — native `POST /items/categories`, всегда `status: draft`, без технических полей. Неясный ответ блокирует повтор; явная проверка результата читает не более двух записей с точным slug и не объявляет совпадение успешным созданием.

`parent` только для чтения: собственный runtime probe подтвердил отсутствие серверного запрета циклов. Удаления в редакторе нет. Список и поиск родителей ограничены страницами по 25; фильтры/поиск/сортировка/пагинация выполняются сервером. Полный отчёт: [A1-INTEGRATION.md](A1-INTEGRATION.md).

## Routes для внешней проверки

Существующие публичные страницы перечислены только как будущий read-only smoke после отдельно разрешённой тестовой публикации. Этот список не активирует запись или deploy.
