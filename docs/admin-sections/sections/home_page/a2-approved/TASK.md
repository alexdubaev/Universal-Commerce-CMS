# A2 — «Главная страница»: один специализированный редактор Universal Commerce CMS

**Версия ТЗ:** 2026-10-17, предварительная, ожидает одобрения владельцем.  
**Репозиторий:** https://github.com/alexdubaev/Universal-Commerce-CMS  
**Предварительно проверенный `main`:** `9b810ff63e363c17c288f409cff6a25d9cc3de7d`. Перед реализацией обязательно проверить новый `origin/main`.  
**Статус:** материалы для оценки. Этот архив **не является реализованным редактором и не разрешает публикацию**.

## 1. Цель и единица работы

Одна задача A2 — создать **специализированный, удобный редактор существующей singleton-записи `home_page`** в нативном модуле Directus. Использовать уже существующую схему PostgreSQL, Native Directus, A0, PageSectionEditor, guarded API и storefront. Не разрабатывать CMS, витрину, страницу «Страницы», новый page builder или версии с нуля.

**Результат для человека:** за минуту разобраться, где менять заголовок главной, hero-фото, кнопки и поисковые подписи; отдельно редактировать секции, SEO и понимать разницу между «Сохранить», «Предпросмотр» и «Опубликовать». Не превращать 34 поля в огромную техническую форму. Никакой ложной доступности кнопок или непроверенных обещаний.

**Это НЕ задача исправления категорий.** В момент подготовки материалов PR #6 с заданиями A1-UI-FIX был открыт. Прежде чем A2 меняет общие компоненты/registry или проходит визуальную приёмку, проверить фактическое состояние A1-UI-FIX и актуальный стандарт UI. Незавершённый чужой task branch не трогать.

## 2. Документы-источники и порядок прочтения

1. Корневые `AGENTS.md`, `README.md`, `docs/architecture/ADR-002-scope-locked-changes-and-content-only-releases.md`.
2. `docs/admin-sections/PLAN.md`, `CONTRACTS.md`, `DESIGN-SYSTEM.md`, `TASK-INDEX.md`, `foundation/A0-INTEGRATION.md`.
3. `docs/admin-sections/sections/home_page/{TZ.md,FIELD-MAP.md,fields.json,LAUNCH.md,routes.md}`.
4. `directus/extensions/deere-shop-product-editor/src/{admin-shell.js,admin-state.mjs,page-sections.js,index.js}` и текущий редактор «Категории» — только как источник действующих паттернов/проверок, не для переписывания.
5. `directus/extensions/commerce-api/src/{versions.mjs,mutations.mjs,index.js}`, реальная Directus 12.1.1 schema/permissions.
6. Реальное чтение главной на витрине: `storefront/lib/content.ts`, `storefront/app/page.tsx`, `storefront/components/CmsPageRenderer.tsx` — **только читать**.
7. Файлы пакета: `home-page-reference.html`, `VISUAL-ACCEPTANCE.md`, `README.md`, снимки PNG.

Полные поля, required и interfaces — из **фактической схемы и metadata**, а не только из подготовленного статического JSON. Текущая документация описывает 34 поля `home_page`. При расхождении stop-and-report, не изменять schema/permissions ради UI.

## 3. Визуальная спецификация (обязательно до кодирования)

Референсы в архиве: `home-hero-desktop.png`, `home-hero-mobile.png`, `home-sections-desktop.png`, `home-sections-mobile.png`, `home-seo-desktop.png`, `home-overview-desktop.png`, `home-conflict-desktop.png`. В интерактивном `home-page-reference.html` доступны вкладки/разделы, раскрытие настроек поиска, демонстрация раздельного сохранения и состояния конфликта. **Это локальный макет, НЕ запущенный код CMS**.

- Сохранить **действующую оболочку Directus**, её логотип, системное меню, поведение и штатные интерфейсы. Оболочка в HTML только показывает расположение, её не копировать в расширение.
- Desktop при 1536×1024: компактный header с «Главная страница», фактическим статусом и **одной основной кнопкой** сохранения. Никакого двойного заголовка, повторяющего toolbar, и повторяющихся состояний readonly.
- Вкладки в фиксированном порядке **«Основное», «Первый экран», «Секции», «SEO», «Дополнительно»**. По возможности открывать «Первый экран» по умолчанию (ценность для пользователя), но при конфликте с штатным поведением A0 проверить и документировать. Строгий keyboard tabs contract.
- «Первый экран»: слева 54–58% — тексты, кнопки, раскрываемая подгруппа поиска/заявок; справа — штатный native file picker + alt. **Высота обычного input 40px**; достаточно воздуха; две колонки только для коротких пар label/url. На мобильном одна колонка; изображение ниже полей.
- «Секции»: читаемый список **существующих** `page_sections` слева и выбранная секция справа через **существующий A0 PageSectionEditor**. Нумерация, тип, видимость; только настоящие данные. Визуально отдельное действие «Сохранить секцию», с guard по dirty/saving, включая состояние родителя. Не сохранять child при сохранении parent.
- Никакой ложной сортировки перетаскиванием, если `sort_order` недоступен в A0. В текущем `page-sections.js` `sort_order` входит в `SYSTEM_FIELDS` и исключается из edit. Показывать фактический порядок, но управление порядком — отдельно подтверждённый API/backend-contract task, НЕ придумывать.
- «SEO»: native SEO JSON plugin, scalar fallback, canonical, OG image и индексация. Сниппет — только маркированная **локальная подсказка по введённым текстам**, не выдача/оценка Яндекса.
- «Основное»: H1, текущий статус, `source_page` **readonly**; различие обычного save и publication. Статус не должен менять публичную видимость через неочевидный «Сохранить». Любую публикацию отделить от edit-form.
- «Дополнительно»: translations через штатный интерфейс; `id`, `created_at`, `updated_at` readonly.
- Компоновка 1536/1024/390, длинные тексты и URL, error/empty/readonly/409. Нет horizontal overflow или несоответствия языку приложения.

Внешний образец — **условие визуальной приёмки**. До merge обязательно сравнить реальную CMS с ним по ширине, порядку, расположению, плотности, типографике, мобильному виду, нетронутости других редакторов. Тесты API не заменяют visual review.

## 4. Поля и вкладки — точный функциональный scope

### 4.1 «Основное»

- `status` — отображение реального статуса; изменяемость только при доказанной бизнес-семантике и проверенном release workflow. Никакого молчаливого опубликования.
- `source_page` — только просмотр текущей связи с `pages`.
- `h1` — обязательный заголовок, с учетом реальных прав.

### 4.2 «Первый экран»

**Контент:** `hero_title`*, `hero_text`*, `hero_image`*, `hero_image_alt`*.  
**Кнопки:** `hero_primary_button_text`, `hero_primary_button_url`, `hero_secondary_button_text`, `hero_secondary_button_url`.  
**Поиск:** `hero_search_label`*, `hero_search_placeholder`*, `hero_search_button_text`*.  
**Отправка списка:** `hero_bulk_prompt`*, `hero_bulk_link_text`*, `hero_bulk_link_url`*.  
**Excel:** `hero_excel_link_text`*, `hero_excel_link_url`*.  
**Фото:** `hero_photo_link_text`*, `hero_photo_link_url`*.

`*` — required в статической модели; сверить с live schema/Directus required flags. Все поля должны быть **доступны в нужной вкладке**, но допустимо свернуть длинную группу ссылок в disclosure. Не терять поля при смене вкладок. Native file interface; unlink ≠ delete. Нельзя сохранять целое `home_page` как произвольный JSON, только разрешённые поля с delta.

### 4.3 «Секции»

Alias `sections` не отправлять как write payload. Использовать `page_sections` с `home_page` owner и `page = null`, как требует A0. Редактор A0 имеет отдельный child baseline и CAS; обобщённое «сохранить всё» не гарантируется.

Обязательная проверка: количество/состав блоков (bounded list), текущий статус публикации `page_sections`, данные, типы `section_type`, собственная видимость, ошибка отсутствующей связи/файла, unknown types, stale responses, read permissions, independent save. Никакой неавторизованной массовой публикации, create/delete/reparent, самодельного drag-and-drop и автоматической перезаписи.

### 4.4 «SEO»

`seo_title`, `seo_description`, `canonical_url`, `og_title`, `og_description`, `og_image`, `is_indexable`, `seo`. Native `seo-interface` без перепаковки. Существующее поведение JSON-first + scalar fallback не разрушать. После успешного guarded update загружать актуальные разрешённые поля повторно, чтобы hook-projected значения не устарели. SEO preview визуальный и не является подтверждением Yandex Webmaster/индексации.

### 4.5 «Дополнительно»

`translations`; технические `id`, `created_at`, `updated_at` только для просмотра. Никакого создания нового singleton.

## 5. Обязательный честный аудит связки с витриной

Проверенный статически код `storefront/lib/content.ts` читает подмножество `hero_*` и SEO. Публичная `storefront/app/page.tsx` использует не все объявленные поля; например, часть bulk/excel/photo полей может храниться в CMS, но не выводиться текущей витриной.

**До реализации** составь матрицу `поле → Directus → API чтение → использование Next.js → эффект после публикации`. Раздели состояния: `влияет на витрину`, `хранится, но сейчас не отображается`, `контракт не доказан`. Не добавляй ложные подписи «текст уже изменён на сайте», не расширяй task в storefront без отдельного разрешения. Недоступные потребители отмечать прямо в UX/хандофе без тихих frontend правок.

## 6. Singleton load, permissions и CAS

- Единственный route `/admin/product-editor/sections/home_page`. **Нет списка, поиска, фильтров, /+ или /:id в UI.** Не создавать/удалять записи. Загрузка через фактически поддерживаемый Directus singleton service shape; `response.data.data` нельзя применять вслепую ко всем endpoints без проверки. Если нет ровно одной записи, блокировать edit и показать понятную ошибку с retry/контактом владельца экземпляра.
- Перечень полей для native request — только необходимые для экрана/версии. Требуемый `id`, поле `updated_at` (значение `null` допустимо), `source_page` и read permissions. Если права неизвестны, fail closed. Повторно сверить actual live metadata и permission subsets.
- Parent updates — только `POST /commerce/mutations/home_page/:id {expected,changes}` через действующий CAS в авторизованном контексте. Никогда не отправлять `sections` alias, системные поля или protected flags. `expected` — подтверждённый baseline, `changes` — dirty allowed fields. Нельзя менять `status` в результате обычного сохранения черновых правок.
- Учитывать `409`, timeout/unknown acknowledgement, не терять локальные данные, явный reconcile. Никакого auto-retry опасных write операций. Кнопки disabled на loading/saving/readonly/conflict. Validation required, missing image/alt, invalid URL, missing SEO plugin, stale data.
- DirtyGuard обязательно включает **child dirty+child saving**, чтобы смена route/tab/закрытие/переключение сущности не теряли правки секции. Вкладки без навигации должны сохранять staged parent values. Ошибку одного child не маскировать успехом parent save.

## 7. Версии и предпросмотр — самые важные границы

Три независимых действия:

**A. Обычное сохранение parent** — guarded mutation текущей `home_page` с CAS. Без новых версий, без публикации отложенных секций.

**B. Редактирование черновой версии** — существующее `POST /commerce/versions/:id/save {expected,changes}` только после проверки runtime, contract, native Directus version ID и разрешений. Не заменять этим обычный save. Запрещено придумывать поля `sections_source`, `sections_snapshot` в `home_page`: статическая схема их не содержит; `sections_capture` — метаданные delta версии.

**C. Публикация версии** — `POST /commerce/versions/:id/promote {expected,mainHash,capturedSections?}` только при доказанных версионных инвариантах и отдельном явном действии/подтверждении. `promote` не гарантирует атомарность всех текущих `page_sections` и нельзя выдавать его за «одной кнопкой публикуем всю главную».

**Preview** — использовать только существующий подписанный/защищённый маршрут по его реальному контракту после runtime-проверки. Не подменять preview публичной ссылкой, не помещать секреты в браузер. Если изолированное proof отсутствует, action недоступен с честным пояснением; версионный функционал отмечается `BLOCKED`, а безопасное редактирование parent/sections остаётся рабочим.

Не добавлять fake version actions для красоты. В offline HTML кнопка «Версии» объясняет контракт, **не имитирует backend action**.

## 8. Реализация и файлы

Основные разрешённые изменения для A2:

- `directus/extensions/deere-shop-product-editor/src/sections/home_page.js`
- `directus/extensions/deere-shop-product-editor/dist/sections/home_page.js`
- `directus/extensions/deere-shop-product-editor/test/sections/home_page.test.mjs`

Минимальная регистрация одного редактора — только в `src/index.js` и `dist/index.js` отдельным малым integration commit ведущего агента. Документы в `docs/admin-sections/sections/home_page/` можно дополнить точным финальным контрактом, screenshot evidence paths и фактическим proof. Адресный runtime probe — в `directus/extensions/deere-shop-product-editor/verification/` по согласованному паттерну.

A0: AdminShell, SectionTabs, NativeFieldGroup, EditorToolbar, MediaPicker, ReadonlyDetails, createEditorState, PageSectionEditor. Используй их текущие реальные props/events; **не дублируй**. Адаптер data/context — в `home_page.js`. Минимальное обратно совместимое расширение A0 допустимо только по конкретному доказанному препятствию и с регрессией товаров/категорий; в остальных случаях общий компонент защищён.

**Не менять**: `directus/schema/**`, `directus/access/**`, `directus/extensions/commerce-api/**`, `directus/extensions/commerce-integrity/**`, `storefront/**`, `dev/**`, `profiles/**`, third-party plugins/manifests/dependencies, Docker/production config/реальные данные. Если требуется такой diff — stop/report, отдельное точное задание.

## 9. Тесты и визуальная приёмка — блокирующие gates

### До изменения кода

1. `git fetch origin`, новая чистая task branch/worktree от свежего `origin/main`. Не использовать грязный source checkout и старый SHA из документации.
2. Проверить и согласовать фактический зарегистрированный A1/Categories UI, при наличии незавершённого UI-FIX не затрагивать его общие файлы; не считать PR #6 (архив) доказательством исправленного интерфейса.
3. Live read-only probe схемы, singleton, permissions, plugins, actual version/API shape; матрица storefront field consumers; минимальная архитектурная заметка.
4. Сверить образец из архива на 1536px и 390px; перечислить точные реализации без новых UX-концептов.

### Адресные автоматические проверки

- `node --test directus/extensions/deere-shop-product-editor/test/sections/home_page.test.mjs`.
- Regression current A0 (`test/admin-state.test.mjs`, `test/page-sections.test.mjs`) и product/category tests после любого shared/index diff.
- В конце **`node scripts/verify-local.mjs`**. Не восстанавливать старые source markup snapshot тесты ради статистики, не удалять полезные проверки.
- src/dist byte equality для изменённых модулей; git diff --check; absence of secrets/bad imports.

### Критическая runtime-проверка в собственном изолированном Directus 12.1.1/PostgreSQL 17

- Singleton реально открывается, отображается только одна запись; graceful missing/ambiguous; permissions denied; API error + retry.
- Нативные fields/file picker/SEO plugin, required behavior, status safety, tab changes, parent CAS update, 409 with retained input, unknown-write recovery.
- Секции: owner `home_page`, exact 25-row paging, child save, child 409, dirty navigation, invisible/not-published, unknown section type, unrelated parent error independence. Проверить, что parent save не записывает child и наоборот.
- Versions/preview: только если соответствующие actions включены после настоящей проверки; один проверенный тест не равен proof атомарного site publish.
- **Никаких записей в реальную главную действующего магазина ради тестов.** Для мутационных smoke использовать отдельный допустимый test instance с заранее созданным собственным synthetic singleton, либо безопасный owned demo baseline и журнал точного восстановление через CAS; не создавать второй singleton и не трогать чужие записи. Если собственного safe fixture нет, runtime-write acceptance `BLOCKED`, а не фальшивый PASS.
- Визуальные screenshot принятого кандидата в actual Directus: 1536×1024 desktop, 1024 responsive, 390×844 mobile; hero, sections, SEO, conflict/readonly, long copy. Проверить реальный browser screenshot, а не offline HTML. Нет overflow, контекстной шапки-дубля, невидимых блоков, растянутых inputs/нелогичных кнопок, лишних технических полей. Не захламлять интерфейс предупреждениями.
- Визуальный reviewer сравнивает **концепт и реальный кандидат side-by-side** по 6+ пунктам: shell integration, header, tabs, column widths, native fields, sections behavior, typography, mobile. Письменная mismatch matrix: исправлено/осознанное отличие/блокер. Любое заметное нерешённое UX расхождение блокирует merge независимо от PASS тестов.

**Стоп-сигнал:** итоговые зелёные unit/build без реального rendering evidence НЕ означают приёмку. Не объединять UI если не удалось открыть его в настоящем Directus и проверить desktop/mobile. Не маскировать runtime permission limitations.

## 10. Git и deploy

Одна задача — одна отдельная временная ветка от свежего `origin/main`; независимые read-only ревью могут идти параллельно, но один владелец общих файлов. Локальный gate на точный кандидат; reviewed PR. Если всё действительно зелёное (функции, безопасность, runtime, visual), commit → push → PR → independent review → merge в `main` самостоятельно, без повторного разрешения. При опережении main rebase/merge latest + проверка. После интеграции проверить ancestry и tree, удалить **только свою** временную ветку и чистый worktree. Чужой dirty checkout, branch и runtime не изменять.

Deploy только если подтверждён проектный target, инструкции, доступ, резервные копии и rollback; проверить работоспособность после. Если production target не известен — `DEPLOY BLOCKED`, не создавать новую инфраструктуру и не касаться иных сайтов.

## 11. Definition of Done / автономный отчёт

**Принят именно редактор `home_page`:** одна запись, пять работающих вкладок, честные поля и связи, первая экранная форма/файлы, безопасный parent CAS, отдельные `page_sections`, SEO с plugin, read-only техполя, ошибки и права, evidence desktop+mobile из actual Directus. Версии и preview показываются только при прошедшем отдельном runtime proof; при незавершённой проверке не выдавать их за готовую функцию и указать reason.

Качественный продукт важнее формальных «зелёных тестов». Исполнитель должен показать владельцу фактические скриншоты до интеграции и не вливать интерфейс, который он сам признал неудобным.

**В конце один цельный копируемый Markdown HANDOFF**, содержащий: baseline/head PR/merge/delete branch/worktree; 34 поля+отметки реально используемых витриной; singleton и permissions; parent/children/version/preview различия; точную матрицу implemented/readonly/blocked; тесты и actual Directus screenshots; visual mismatch report; code review и оставшиеся риски; deploy/blocked; следующую единственную задачу («Страницы», если A2 принят); контекст для нового агента.

Передать постоянные правила: одно задание/один агент implementation owner; read-only ревью параллельно; временная ветка от свежего main; функциональное+визуальное доказательство; зелёное → автономные push/PR/review/merge; безопасный confirmed deploy; удаление только своего merged worktree/ветки; все ТЗ/промпты/хандофы в копируемых блоках.

**После A2 остановиться. Не начинать «Страницы» до нового задания.**
