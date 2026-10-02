# Контракты и границы будущей реализации
## Scope
Запрошенное поведение: компактные единообразные редакторы всех существующих разделов внутри Directus по образцу товаров.
Разрешённая текущая запись: только этот пакет артефактов.
Будущие UI-задания: только заранее перечисленные файлы существующего расширения deere-shop-product-editor. Production, storefront, schema, dependencies, roles, permissions, auth/secrets, Docker/deploy/Caddy/VPS, leads processing, SEO-worker и реальные каталоговые данные защищены ADR-002. Не включать их в UI diff.

## Native Directus
Vue App Module, native private-view, UI components, useApi и metadata/permissions существующего пользователя. Ни токенов администратора, ни отдельного React/Next приложения. Native REST читает только fields конкретного экрана с limit/page/sort/filter. Настоящие permissions являются источником разрешённых действий, не видимость кнопки.

Официальные материалы: [App Modules](https://directus.com/docs/guides/extensions/app-extensions/modules), [Composables](https://directus.com/docs/guides/extensions/app-extensions/composables), [Items API](https://directus.com/docs/api/items). Внутренний v-form и native plugins обязательно проверить на установленной версии, не считать документированным стабильным API.

## Existing guarded updates
POST /commerce/mutations/:collection/:id
body: {expected, changes}. expected берётся из оригинального baseline; changes содержит только изменённые разрешённые поля. Общая state machine наследует точный shape buildExpectedSnapshot существующего редактора, без собственной несовместимой модели.
Разрешены сейчас products, pages, home_page, page_sections, site_settings, products_analogs, product_codes, product_images, product_specifications, product_documents, categories, articles.
Endpoint использует caller accountability, Directus permissions, транзакцию, row lock и comparison; 409 означает конфликт. Alias/system поля нельзя записывать. Native PATCH сам по себе не даёт этот контракт.

Этот allowlist подтверждает поддержку коллекции endpoint-ом, но не выдаёт право конкретной роли и не задаёт field-level allowlist для секции. Каждое сохранение требует фактических Directus update/read permissions текущего пользователя. Скрытие поля только в UI не является запретом записи: до включения ограниченного набора editable fields его должен проверять сервер. В текущем snapshot `product_codes` и `products_analogs` не добавлены в обычные role permission blueprints; не расширять права как часть UI-задачи.

НЕ разрешены endpoint сейчас: navigation_items, faq_items, recent_supplies, leads, orders, seo_work_items, contact_channels, lead_forms, seo_redirects. Их новые карточки остаются readonly до отдельного задания G1 и его приёмки. Существующие native формы не удалять и не менять их permission policy.

Create — только действующий native ItemsService контракт для отдельно разрешённых синтетических данных, после проверки hooks/required. Создание реальных данных текущей задачей не разрешено. Нет обещания атомарной операции parent+children через несколько REST вызовов: дочерние записи получают отдельный baseline и отдельную транзакцию; частичный результат отображается, не маскируется общим Save.

## Versions / previews
Только pages/home_page:
POST /commerce/versions/:id/save {expected, changes}
POST /commerce/versions/:id/promote {expected, mainHash, capturedSections?}.
expected — исходная delta версии; mainHash — исходный hash основной записи. Полный снимок опубликованных секций (`sections_capture`, поля `CAPTURED_SECTION_FIELDS`) хранится в delta версии; `capturedSections` в запросе опционален и, если отправлен, сверяется с этим снимком. Точную модель получать из существующих versions.mjs/tests. Не заменить promote обычным PATCH status.
Условная snapshot-ветка version API использует `sections_source` и `sections_snapshot`, но HEAD blueprint их не объявляет для `pages`/`home_page`; `sections_capture` — служебное поле delta версии, не поле коллекции. Live DB не проверена. Не показывать и не отправлять `sections_source`/`sections_snapshot`, пока live schema и permissions не подтвердят их наличие.
CAS публикации версии защищает запись родителя. `page_sections` сохраняются отдельно; hook обновляет `updated_at` родителя при изменении дочерней секции, но это не обещает атомарный снимок всех дочерних строк при публикации или согласованность всего storefront ответа. Сравнение полного состава секций есть только в условном первом переходе к snapshot-режиму и не подтверждает изоляцию всех последующих child writes. Проверить реальную deployed-схему и frontend-read contract до любого использования этого режима.
Preview уже существует в commerce API: не придумывать маршрут/подпись и не помещать секрет в client. Открытие preview не равно публикации.

## Media / JSON / identity
Native file library/upload/link. Убрать связь с файлом — не удалить файл. UUID связи и JSON формы сохраняются по существующему контракту.
Товары: documents — JSON UUID[], не массив {title,file}. media_sources=children оставляет managed media readonly; запрещён незаявленный cutover. Failed gallery read блокирует gallery writes, не остальные поля.
Статьи: native Flexible Editor/content_blocks + articles_editor_nodes; сохранить fallback legacy HTML. Состав и связь узлов не переписывать новым JSON форматом.
home/pages: page_sections section_type steps нормализуется storefront в process. Список типов schema не гарантирует рендер каждого типа на каждой публичной странице; UI обозначает действующую поддержку. Произвольные items/settings JSON не превращать в новые выдуманные frontend блоки.
product_codes.normalized_code вычисляет commerce-integrity hook; readonly.
products_analogs.canonical_key уникален в БД; автоматический create hook НЕ найден. Создание/смена ребра требует G2; нельзя выдумывать derivation или менять endpoints/identity/schema внутри UI.
Коллекция присутствует в общем CAS allowlist, но это не ограничивает изменения `product_from`, `product_to` и `relation_type` на уровне endpoint. До G2 и отдельно разрешённого server-side field guard новые UI не должны сохранять даже поддерживаемые поля основания (`source_name`, `note`, `verified_at`): field-level ограничение только средствами клиента обходится.

## Operational records
Leads/orders: новые редакторы меняют только status/manager_comment ПОСЛЕ G1; данные запроса, согласия, UTM, суммы/позиции readonly. Native forms сейчас шире, но новый UI не расширяет их бизнес-смысл. order_items — исторический snapshot, не пересчитать из текущего товара.
SEO queue: worker claim/draft/release не является API кнопки Применить. Переходы, patches, dedupe/hash и worker lease защищены. Новый UI — обзор, evidence и сравнение, без approve/apply/rollback до отдельного подтверждённого lifecycle-контракта.
site_settings.commerce_profile, analytics/security-related settings; lead_forms.fields/turnstile_required и обработка leadforms readonly в UI-задачах. Реквизиты/контакты редактировать только явно заявленным content заданием.

## Verification contract
При запуске проверить live schema vs snapshot и HEAD, read permissions, installed plugins, endpoint availability. Не менять систему при расхождении — записать gap.
Relevant state tests + native field/media integration tests + browser smoke1536×1024 и390×844 на изолированном окружении. Existing16product tests обязательны для A0/shared integration. Все временные записи синтетические; восстановить значения после smoke. Не запускать широкий FAST UC1–35 и не изменять production.
Перед commit: allowed-file diff, whitespace/checks, inspect staged/unstaged, independent reviewer; один scoped reviewed commit. Владельцы общих файлов интегрируют зарегистрированные секции отдельно. src/dist синхронны. Перезапуск test container только по актуальному разрешению конкретного будущего запуска.

