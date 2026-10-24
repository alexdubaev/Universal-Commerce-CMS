# A2-UX-FIX: предварительный показ, утверждён 23.10.2026

Владелец утвердил показанный вариант сообщением «Утверждаю». Ниже сохранена запись подготовки до реализации; фактическое выполнение и результаты фиксируются в A2-UX-PLAN.md и отчёте приёмки.

База: `5b7879b6bec22e4585940151d23cd5821a2ea6a8`, fresh origin/main, 23.10.2026.
Ветка: `codex/a2-home-ux-issue18`; worktree: `D:/codex/worktrees/ucc-a2-home-ux`.

Полностью прочитаны актуальные #18 и #22, comments отсутствуют; корневые инструкции, ADR-002, CONTRACTS, DESIGN-SYSTEM, testing.md и относящиеся A2 контракты. Старые пакеты описывают прежние этапы, а не текущее разрешение на реализацию. Предыдущие A0/товары/A1 подтверждены HANDOFF, ancestry PR #23/#24/#25 и установленными артефактами. A1 release HANDOFF находится в `D:/codex/ucms-release-backups/a1-ux-a237a557-60c0-4348-b985-9b5b827b21d9/HANDOFF.md`.

Фактически выдаваемый HTTP aggregate SHA256 совпадает с A1 release: `1ab7f3af5e8618528981dbb8db05350de521dec808f9ed41166d562b2d863afa`. Installed index/A0/home/categories совпадают с fresh main. Отдельные module URL не обслуживаются, поэтому их 404 не трактуется как отсутствие модулей; они входят в aggregate. Anonymous health 403 ожидаем, authenticated health = ok. Docker image Directus 12.1.1; админская сессия не доказывает manager RBAC.

До утверждения разрешённые изменения ограничены этой изолированной папкой предложения. Product src/dist, runtime mount и данные не изменялись. Чужой dirty checkout и все существующие worktree сохранены. Временный preview — `http://127.0.0.1:18118/prototype.html`; он не подключён к CMS.

## Предлагаемый объём после утверждения

Поведение: четыре вкладки с рабочим первым экраном по умолчанию; правильный видимый заголовок; понятные условия двух кнопок; два реально подключённых параметра поиска; один ввод поисковых значений с сохранением SEO-проекций; readonly-настройки без эффекта; понятные блоки, статусы, сохранение и сверка без ложного Save All.

Основные разрешённые файлы: `directus/extensions/deere-shop-product-editor/src/sections/home_page.js`, соответствующий `dist/sections/home_page.js`, `test/sections/home_page.test.mjs`, документы/evidence внутри `docs/admin-sections/sections/home_page/`. Shared A0 переиспользуется. Только если без него нельзя выразить согласованное A2 состояние блока, допустима узкая opt-in адаптация `src/page-sections.js` / `dist/page-sections.js` и `test/page-sections.test.mjs`, с прежним поведением pages по умолчанию и адресной регрессией A3. Новая общая UI-библиотека не создаётся.

Защищены: схема, backend/hooks, роли/permissions, credentials, Docker/deploy config, зависимости, storefront, товары/категории/A3–A5 и чужие данные. Неподключённые поля не очищаются. Source_page/status/identity остаются защищёнными. Ни новой главной, ни create/delete/reorder блоков, ни версий/preview/promote/публикации в custom workflow. Неизвестный тип может выводиться общим renderer; его данные не преобразуются.

Подтверждённый target будущей штатной установки: существующий Windows Directus `http://127.0.0.1:18056`, Compose `universal-commerce-cms-dev`, Directus 12.1.1. Фактический bind: `C:/Users/Alexandr/.codex/worktrees/storefront-directus-acceptance/Universal Commerce CMS/directus/extensions`. Основной Git checkout `D:/codex/Universal-Commerce-CMS-main` не является этим mount. Production-сервер не установлен и не выбирается.

## Проверка после утверждения

Адресные home/controller и child/A0 проверки → настоящий Windows Directus с безопасным сценарием singleton/адресным guarded restore затронутых полей → persistence, SEO-projection/unknown keys, поиск/кнопки, parent/двое children, concurrency и ошибки → соответствие утверждённому макету 1536×1024 и 390×844 → один свежий независимый review и bounded fixes → `node scripts/verify-local.mjs` на точном кандидате → commit/push/PR/merge → подготовленный artifact backup/guarded rollback → штатная установка на подтверждённый target и post-deploy checks/screenshots → cleanup/HANDOFF. После выпуска A2 остановиться.

Запись тестовых данных, запуск product tests, независимый code review, commit/push/PR/merge и deploy на этой стадии НЕ выполнялись. Проверена только геометрия отрисованного HTML: девять основных views/states в обоих размерах без горизонтального переполнения; это не product acceptance. Текущая главная не содержит блоков; populated block/conflict screenshots — явно подписанные синтетические состояния предложения.
