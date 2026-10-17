# Контракты и границы будущей реализации
## Scope
Запрошенное поведение: компактные единообразные редакторы всех существующих разделов внутри Directus по образцу товаров.
Разрешённая текущая запись: только этот пакет артефактов.
Будущие UI-задания: только заранее перечисленные файлы существующего расширения deere-shop-product-editor. Production, storefront, schema, dependencies, roles, permissions, auth/secrets, Docker/deploy/Caddy/VPS, leads processing, SEO-worker и реальные каталоговые данные защищены ADR-002. Не включать их в UI diff.

## Native Directus
Vue App Module, native private-view, UI components, useApi и metadata/permissions существующего пользователя. Ни токенов администратора, ни отдельного React/Next приложения. Native REST читает только fields конкретного экрана с limit/page/sort/filter. Настоящие permissions являются источником разрешённых действий, не видимость кнопки.

Официальные материалы: [App Modules](https://directus.com/docs/guides/extensions/app-extensions/modules), [Composables](https://directus.com/docs/guides/extensions/app-extensions/composables), [Items API](https://directus.com/docs/api/items). Внутренний v-form и native plugins обязательно проверить на установленной версии, не считать документированным стабильным API.

## A0 — реализованные exports и state contract

A0 находится в существующем `deere-shop-product-editor` module. `src/index.js` и `dist/index.js` сохраняют список и `/:id` товара и добавляют `sections/:collection/:id?`. `sectionRegistry` намеренно пустой и заморожен; незарегистрированный раздел показывает readonly-состояние. Подключение маршрута не активирует специализированный редактор.

| Export | Входы и события |
|---|---|
| `AdminShell` | Props: `title`, `state` либо `dirty`/`saving`, `readonly`, `guardNavigation`; slots `main`/`default`, `context`, `toolbar`, `conflict`, `retry`; emits `save`, `back`, `retry`, `reconcile`. Уход блокируется во время сохранения, dirty-состояние требует явного подтверждения. |
| `SectionTabs` | `tabs: {id,label}[]`, `modelValue`, `disabled`, `idPrefix`; emit `update:modelValue`; клавиши ←/→, Home/End. |
| `EditorToolbar` | `title`, state (`canSave`, `loading`, `saving`, `conflict`, `writeUncertain`, `readError`), `readonly`, `canPublish`; emits `save`, `publish`, `back`, `reconcile({keepEdits})`. Публикация выключена по умолчанию. |
| `NativeFieldGroup` | Явные `metadata` и упорядоченный `fieldSubset`, `primaryKey`, полные `initialValues`, контролируемый `modelValue`, `permissions`, `readonly`/`disabled`, `validationErrors`; emit `update:modelValue` только для разрешённых полей. Нативные relation/file interface и options остаются из Directus metadata. |
| `CollectionList` | Контролируемые `rows`, `columns`, `page`, `pageSize` (1–100), `total`, `loading`, `error`, `search`, `sort`, `filters`; emits `select`, `update:page/search/sort/filters`, `retry`. `buildCollectionQuery` требует явные fields и positive page, ограничивает `limit` и вычисляет `offset`. |
| `MediaPicker` | `field`, `primaryKey`, `initialValue`, `modelValue`, `permissions`, `readonly`/`disabled`, `allowSelect`, `allowUpload`, `missingAsset`; emit `update:modelValue` с asset id или `null`. Используется нативный Directus file interface. Флаги действий не дают серверных прав. |
| `ReadonlyDetails` | `values` и явный список `{field,label}`; только отображает значения. |
| `createEditorState(config)` | `config`: `collection`, `editableFields`, `permissions` (`read`/`update`: `true` или массив разрешённых полей), `fieldMetadata`, `guardedContract`. `load(loader,id)` вызывает `loader(id, fields)`. `save(saver)` вызывает `saver(collection,id,{expected,changes})`. Loader и saver возвращают уже распакованную запись `{id,updated_at,...}`; свойства `id` и `updated_at` обязательны, значение `updated_at: null` допустимо. Изменения идут через guarded mutation, не через native PATCH. |
| `PageSectionEditor` / `createPageSectionController` | `parentCollection` (`pages` или `home_page`), `parentId`, `metadata`, `editableFields`, `permissions`, `guardedContract` (default false), `readonly` (default true), `api`; emits `dirty-change`, `saved`, `error`, `navigation-blocked`, `state-change`. Читает `page_sections` для одного родителя, по 25 строк; каждая запись имеет свою baseline, CAS-save, конфликт и reconcile. |

Editor state сохраняет правки вкладок и строит `changes` только из dirty-разрешённых полей. `expected` включает исходные `id`, `updated_at` (в том числе `null`) и значения изменяемых полей; PageSectionEditor также включает исходные `page` и `home_page` для проверки owner boundary. Ответ save обязан содержать `id`, свойство `updated_at` (значение может быть `null`) и все изменённые поля. 409 и любой неподтверждённый/невалидный ответ сохраняют локальные значения и блокируют повтор до явного `reconcile`; `keepEdits: true` накладывает локальные dirty-поля поверх заново прочитанной записи. Устаревшие ответы другой identity игнорируются.

Props permissions ограничивают UI и payload, но не заменяют Directus accountability и серверные permissions. До подключения экрана исполнитель обязан сверить live schema, read/update permissions и guarded endpoint. `PageSectionEditor` требует read-доступ к `id`, `updated_at`, `page`, `home_page`, проверяет владельца каждой дочерней строки, блокирует смену родителя при dirty/save и сохраняет дочернюю строку отдельно. Версия родителя не обещает snapshot-изоляцию live children.

`createEditorState` — imperative state machine на замыканиях с обычными getters, не Vue reactive store и не emitter. Вызывающий экран должен обновлять свой reactive revision/snapshot после синхронных мутаций и после начала и завершения асинхронных `load`, `save` и `reconcile`, чтобы показать loading/saving и итоговое состояние. `PageSectionEditor` уже делает это внутри через revision и `onChange`.

`DirtyGuard` и `ConflictNotice` — встроенное поведение `AdminShell`, `EditorToolbar` и `PageSectionEditor`, а не отдельные exports. При создании экрана передавайте permissions только после проверки Directus metadata/permissions; неизвестные права означают `false` и отключённый save.

Пример подключения state к существующему `useApi()` адаптеру. Обе функции возвращают распакованную запись, как требует `createEditorState`; разрешённые поля в конфигурации ниже — пример для экрана с одним разрешённым полем, их нужно получить для текущей роли и схемы:

```js
const recordFrom = (response) => response?.data?.data;
const state = createEditorState({
  collection: "example_collection",
  editableFields: ["title"],
  permissions: { read: ["id", "updated_at", "title"], update: ["title"] },
  fieldMetadata,
  guardedContract: true, // выставлять true только после проверки endpoint для этой коллекции
});
const loader = async (id, fields) => recordFrom(await api.get(`/items/example_collection/${encodeURIComponent(id)}`, { params: { fields } }));
const saver = async (collection, id, payload) => recordFrom(await api.post(`/commerce/mutations/${collection}/${encodeURIComponent(id)}`, payload));
await state.load(loader, recordId);
```

Минимальный Vue bridge для самостоятельного использования state: snapshot вычисляется через revision, а async wrapper инвалидирует его до ожидания и после завершения. Аналогично оборачивайте `save`/`reconcile`; после `change`/`changeTab` увеличивайте revision синхронно.

```js
const revision = ref(0);
const snapshot = computed(() => {
  revision.value;
  return { baseline: state.baseline, values: state.values, dirty: state.dirty,
    saving: state.saving, canSave: state.canSave, conflict: state.conflict };
});
async function loadRecord(id) {
  const pending = state.load(loader, id);
  revision.value++;
  const result = await pending;
  revision.value++;
  return result;
}
```

Передача partial/delta из активной вкладки через явный список полей сохраняет значения остальных вкладок; отсутствующее поле активной вкладки сбрасывается к baseline:

```js
const tabFields = ["title"];
const onTabUpdate = (delta) => state.changeTab(tabFields, delta);
const onSave = () => state.save(saver);
```

При использовании `MediaPicker` `initialValue` — исходная карта поля Directus, а `modelValue` — текущее локальное значение. Нативный reset может представить возврат к исходнику как omission в delta; компонент восстанавливает исходное значение из `initialValue`:

```js
h(MediaPicker, {
  field: imageField,
  primaryKey: recordId,
  initialValue: { image: baseline.image },
  modelValue: values.image,
  permissions: { read: ["image"], update: ["image"] },
  readonly: false,
  allowSelect: true,
  allowUpload: false,
  "onUpdate:modelValue": (id) => state.change("image", id),
});
```

`PageSectionEditor` сообщает агрегированное состояние по всем закэшированным дочерним строкам. Передавайте оба флага в `AdminShell`, чтобы guard учитывал несохранённые child edits и активный child save:

```js
const childState = ref({ dirty: false, saving: false });
h(PageSectionEditor, {
  parentCollection: "pages",
  parentId,
  api,
  editableFields,
  permissions,
  guardedContract,
  readonly: false,
  onStateChange: (next) => { childState.value = next; },
});
h(AdminShell, { title: "Page", dirty: childState.value.dirty, saving: childState.value.saving });
```

## Existing guarded updates
POST /commerce/mutations/:collection/:id
body: {expected, changes}. expected берётся из оригинального baseline; changes содержит только изменённые разрешённые поля. Общая state machine наследует точный shape buildExpectedSnapshot существующего редактора, без собственной несовместимой модели.
Разрешены сейчас products, pages, home_page, page_sections, site_settings, products_analogs, product_codes, product_images, product_specifications, product_documents, categories, articles, navigation_items.
Endpoint использует caller accountability, Directus permissions, транзакцию, row lock и comparison; 409 означает конфликт. Alias/system поля нельзя записывать. Native PATCH сам по себе не даёт этот контракт.

Этот allowlist подтверждает поддержку коллекции endpoint-ом, но не выдаёт право конкретной роли и не задаёт field-level allowlist для секции. Каждое сохранение требует фактических Directus update/read permissions текущего пользователя. Скрытие поля только в UI не является запретом записи: до включения ограниченного набора editable fields его должен проверять сервер. В текущем snapshot `product_codes` и `products_analogs` не добавлены в обычные role permission blueprints; не расширять права как часть UI-задачи.

НЕ разрешены endpoint сейчас: faq_items, recent_supplies, leads, orders, seo_work_items, contact_channels, lead_forms, seo_redirects. Их новые карточки остаются readonly до отдельного задания G1 и его приёмки. Существующие native формы не удалять и не менять их permission policy. Текущий endpoint также допускает `navigation_items`, но A0 оставляет реестр редакторов пустым; наличие коллекции в endpoint не включает новый UI.

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
Для A0 запускаются адресные state/page-section тесты и текущие пять сохранённых product editor-state тестов в рамках owner test consolidation. Обязательный локальный gate `node scripts/verify-local.mjs` проверяет весь обычный кандидат отдельно. Интеграционная проверка в Directus и браузерные desktop1536×1024/mobile390×844 smoke — отдельные проверки изолированного runtime; unit tests их не заменяют. Все runtime-записи синтетические; восстановить значения после smoke. Не запускать широкий FAST UC1–35 и не изменять production.
Перед commit: allowed-file diff, whitespace/checks, inspect staged/unstaged, independent reviewer; один scoped reviewed commit. Владельцы общих файлов интегрируют зарегистрированные секции отдельно. src/dist синхронны. Перезапуск test container только по актуальному разрешению конкретного будущего запуска.

