# План работ и параллельный запуск
## Текущая рабочая база и условия старта

Волны ниже — план, не утверждение о реализованных экранах. Текущий destination: `D:/codex/Universal Commerce CMS`; перед каждой задачей исполнитель проверяет чистую отдельную task branch/worktree и фиксирует актуальный HEAD destination непосредственно перед стартом. Историческая исследовательская база не используется как рабочая база. Каждый секционный LAUNCH требует принятого A0, своего точного файлового scope и проверки live schema/permissions/plugins. G1/G2 остаются отдельными ограничениями.

## Архивный результат исследования
14 бизнес-разделов; 9 вспомогательных коллекций встроены в соответствующие карточки. Шесть групп навигации сохраняются. Редактор товаров — уже реализованный эталон. Объём не включает переписывание системных экранов Directus или публичного сайта.

## Волны
| Волна | Работа | Условие старта | Может идти параллельно |
|---|---|---|---|
| 0 | Согласование макетов, A0 общая оболочка/state/page sections | Этот пакет | G1/G2 анализ контрактов read-only |
| 1 | home_page, pages, categories, articles, site_settings, product_codes | A0 reviewed | Все друг с другом в своих files |
| 1R | navigation_items, faq_items, recent_supplies, leads, orders, seo_work_items readonly UI | A0 reviewed | Все друг с другом |
| 2 | Включение сохранения коллекций G1 | Отдельное разрешение G1 + API review | По независимым разделам |
| 2G | products_analogs управление связями | G2 identity contract reviewed | Не зависит от остальных UI |
| 3 | Единая интеграция registry/nav, регрессия товаров и сквозной smoke | Все выбранные UI commits reviewed | Только независимые checks |
| 4 | Отдельное решение о выпуске | Scoped review + проверки | Не подразумевается текущим запросом |

Не блокировать все макеты или readonly разработку отсутствием G1. Не запускать несколько исполнителей на src/index.js, dist/index.js или PageSectionEditor.

## A0 — общая основа (один исполнитель)
Предлагаемые allowed files: directus/extensions/deere-shop-product-editor/src/admin-shell.js, src/admin-state.mjs, src/page-sections.js и зеркальные dist файлы; test/admin-state.test.mjs, test/page-sections.test.mjs. Registry/navigation интеграция src/index.js + dist/index.js отдельным commit того же владельца после независимого review.
Разработать shell/tokens, permissions-aware toolbar, tab subsets, list pagination, readonly details, dirty/conflict/loading/error, common media picker, безопасный page section subeditor.
Существующий product routes/state сохранить; перемещение кода товаров не нужно для общей оболочки. Не добавлять dependencies или build tool. Граница frontend, protected config и schema закрыта.
Acceptance: existing16tests, state tests с изменением разных tabs/409/late responses/permissions, src/dist parity, native picker, отсутствие collection-wide form, desktop/mobile без overflow, product create/edit smoke по отдельному разрешению.
Контракт A0 exports фиксируется до передачи заданий: AdminShell, SectionTabs, EditorToolbar, NativeFieldGroup, CollectionList, MediaPicker, ReadonlyDetails, createEditorState, PageSectionEditor. Имена — предложенные, их окончательная версия записывается в CONTRACTS перед wave1.

## G1 — отсутствующие guarded contracts (отдельная защищённая область)
До разрешения — только анализ; не включать API diff в UI-task. Минимальная заявка: navigation_items, faq_items, recent_supplies, contact_channels для контента и отдельно leads/orders для только status/manager_comment. lead_forms и SEO lifecycle/redirects не включать автоматически.
Предлагаемые allowed files после точного разрешения: commerce-api/src/mutations.mjs и src/mutations.test.mjs; registration only if necessary commerce-api/src/index.js и его dist counterpart по существующей структуре. Фактический build layout проверить заранее.
Приёмка: отсутствие admin bypass, field-level разрешения, stale expected409, отказ запрещённым полям/операционным snapshots, сохранение existing tests; CAS API не заменяет семантические правила статусов. Для SEO — самостоятельное более узкое G1-SEO после проверки pipeline, а не широкое добавление всей очереди.

## G2 — аналоговые связи
Проверить create/update derivation canonical_key, симметрию/направленность, uniqueness и duplicate diagnostics. Пока контракт не доказан, список/readonly карточка допустимы, изменение product_from/product_to/relation_type и create недоступны. Обновление подтверждённых неидентификационных полей CAS можно заявить отдельно.
Никакой миграции, новой уникальности или каталожной правки в UI задаче.

## Владение файлами
Каждый раздел владеет только src/sections/<collection>.js, dist/sections/<collection>.js, test/sections/<collection>.test.mjs. Документацию раздела можно обновить в его согласованной папке. Общие exports и registry меняет интегратор A0. Shared support редакторы имеют одного владельца; sections подключают их через props, не копируют.
На старт: отдельная task branch/worktree от текущего reviewed destination HEAD после проверки, что нет чужих незакоммиченных изменений в разрешённом scope; постороннее состояние сохраняется отдельно. Переносить только reviewed commits. Не работать в main. Для каждого агента передать LAUNCH.md его раздела вместе с общими файлами из пакета.

## Очерёдность по пользе
Первый pilot после A0: категории — сходный с товарами редактор; затем главная и страницы проверяют общий section/version контракт, статьи проверяют plugin интеграцию. Оставшиеся UI можно писать одновременно после фиксации A0.
Заявки/заказы/SEO сначала readonly pilot для операторов, затем отдельно согласованные workflow-действия. Товары не переделывать повторно; финальная регрессия подтверждает сохранение эталона.

## Оценка, не обязательство
A0: 2–4 рабочих дня; простой раздел 0.5–1.5 дня; media/SEO content 1–3 дня; home/pages/versioning 2–4 дня каждый; G1/G2 1–3 дня после анализа; интеграция/smoke2–3 дня. Это предварительные диапазоны, не суммарный срок: фактические live schema, plugins и доступные исполнители уточняют оценку. Параллелизм ограничен общими контрактами и review.



