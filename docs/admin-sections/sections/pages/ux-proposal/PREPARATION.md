# A3-UX-FIX «Страницы» — подготовка, без утверждения

Дата: 2026-10-24. BASE / fresh origin/main: `22c2892e3ee632e0a08e0f9ba27bc47b7dc649bc`.
Собственная ветка: `codex/a3-pages-ux-issue19-20261024`.
Worktree: `C:/Users/Alexandr/.codex/worktrees/a3-pages-ux-issue19/Universal Commerce CMS`.

Прочитаны текущие issue #19/#22 целиком, AGENTS.md, ADR-002, CONTRACTS, DESIGN-SYSTEM, testing.md, исторические A3 TZ/routes и актуальные потребители страницы. Исторические ограничения дополняются актуальным прямым решением владельца в #19/#22. До утверждения меняется только изолированная папка предложения. Продуктовые src/dist, установленный bundle, общая БД и runtime-конфигурация не менялись. Продуктовые проверки и deploy не запускались.

## Предшественники и фактическая установка

PR #23 (A0), #24 (товары), #25 (категории), #26 (главная) подтверждены merged через GitHub и ancestry fresh main. Прочитаны A0 HANDOFF, PRODUCTS HANDOFF, текущие A1/A2 UX acceptance и долговечные release HANDOFF A1/A2. Старые A2-ACCEPTANCE.md и A1-INTEGRATION.md описывают прежние этапы; не являются окончательной записью последних UX выпусков.

Последний A2 HANDOFF: `D:/codex/ucms-release-backups/a2-ux-25ca1089-4115-4e8f-aa5e-0a0a8100dcd1/HANDOFF.md`; release `22c2892`, PR #26, post-deploy 2026-10-24. Все девять файлов установленного `deere-shop-product-editor/dist` побайтно совпадают с fresh main, включая A0/товары/категории/главную/страницы. Сейчас HTTP aggregate `/extensions/sources/index.js` возвращает 200 и SHA256 `28eedfd568f3d9228bef6b70ee1bd6fdaaac5a2049c0673d99e77e4b41eb9349`, равный release-manifest/post-deploy A2.

Подтверждённый target установки: Windows, Directus 12.1.1, `http://127.0.0.1:18056`, Compose `universal-commerce-cms-dev`, контейнер `universal-commerce-cms-dev-directus-1`. Проверены labels, образ, loopback port, bind и named uploads volume. Bind: `C:/Users/Alexandr/.codex/worktrees/storefront-directus-acceptance/Universal Commerce CMS/directus/extensions`. Основной checkout `D:/codex/Universal-Commerce-CMS-main` отличается от runtime bind. Рабочий runtime worktree нельзя удалять. Production сервер не определён.

Локальная витрина `http://127.0.0.1:3000` принадлежит прежнему проверенному проектному runtime по сохранённому A2 launcher и NEXT_PUBLIC_SITE_URL; сейчас она остановлена, listener отсутствует. Её текущая доступность не заявляется. После утверждения предложено запускать только эту собственную витрину для настоящей проверки публичного URL, без изменения её исходников. Итоговый target выпуска — указанная локальная CMS; production не выбирается по догадке.

## Реальный осмотр

Все `before-*.jpg` сняты сейчас с установленной CMS через in-app browser, без подмены ответов или bundle. Размеры desktop 1536×1024, mobile 390×844. Снимки показывают существующие нейтральные записи. Запись `Synthetic acceptance page` защищена как источник главной; обычная опубликованная запись для сравнения — `Synthetic section transaction probe`. Она содержит существующий `Fixture section` с неизвестным типом; данные не преобразовывались.

Открытие native SEO-панели только для осмотра не сопровождалось сохранением. Русское название «Доставка и оплата» введено в несохранённую новую форму: адрес остался пустым. Ввод явно отменён штатным диалогом; POST создания/обновления/публикации не выполнялись. Диалог статуса открыт и отменён. Пустая выдача получена настоящим поиском «несуществующая страница». Полностью пустой коллекции сейчас нет; ради снимка существующие страницы не удалялись. Её вариант показывается только в предложении.

## Обнаруженная зависимость публичного URL

Сейчас ссылка опубликованной страницы имеет относительный href и ведёт на CMS origin. Ни текущая schema/site_settings, ни существующие commerce endpoints не предоставляют редактору подтверждённую базу витрины. Native /settings project_url и pages preview_url отсутствуют/не заданы; /server/info не отдаёт базу витрины. NEXT_PUBLIC_SITE_URL существует в процессе витрины, но недоступен клиенту CMS. Использовать canonical_url, Host, название компании, origin CMS или порт по догадке нельзя.

Для обязательного исправления предлагается явно утвердить узкое расширение scope: instance-local `COMMERCE_STOREFRONT_URL`, один read-only authenticated `GET /commerce/config/storefront` и чтение только адреса редактором. Значение задаётся отдельно для конкретного собственного окружения; никакого домена/порта в коде по умолчанию. Это предложение, не выполненная настройка и не скрытый backend diff. Без него обязательный сценарий корректного открытия сайта не может считаться завершённым.

## Дальше

Показать реальные парные изображения и точный scope в сообщении, затем остановиться. После явного утверждения — план и делегированная реализация, полезные узкие проверки, настоящий Windows Directus, сверка вида, одно независимое code/visual review с исправлениями, `node scripts/verify-local.mjs`, commit/push/PR/merge, backup/guarded rollback, штатная установка на подтверждённый target, post-deploy screenshots и HANDOFF. A4 не начинать.
