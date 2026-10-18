# A3 — Pages Editor: локальная приёмка

Дата: 2026-10-18. Runtime и визуальная приёмка выполнены локально на Windows. Значимых открытых замечаний нет; PR #10 готов к интеграции после локального gate.

Продолжена существующая codex/a3-pages-editor, исходный HEAD 8278a5f29dfd07441e9241ca8a64e415fe57eb05. База main: 9a0b55fd17f2b7f58d2889ff0c2e4e033ce64ab7. Чужая dirty-папка D:\codex\Universal Commerce CMS и прочие worktree не изменялись.

## Среда и границы

Подтверждены Windows, локальный Docker Engine 29.6.2, существующий universal-commerce-cms-dev, Directus 12.1.1 на http://127.0.0.1:18056 и healthy PostgreSQL 17. Инфраструктура не создавалась. Только новые собственные синтетические pages, page_sections и один файл на соответствующий прогон; существующий singleton, source_page, другие записи и старые ownership manifests не изменялись.

Кандидат загружался только в отдельном Playwright-контексте: проверенные dist-модули читались один раз до запуска браузера, их SHA256 сохранены. Native Directus UI/плагины, HTTP mutations и PostgreSQL — настоящие. Установленный bundle и bind mount не обновлялись. Это runtime-приёмка кандидата, не deployment.

Изменены только Pages source/dist/tests, адресный verification/a3-pages-runtime.mjs и документы A3. Регистрация pages в index сохранена отдельным исходным коммитом. Общие A0/A2/section editor, API/hooks, schema, access, credentials, manifests/dependencies, storefront, Compose и deployment configuration не изменялись.

## Проверенное поведение

| Область | Доказательство |
|---|---|
| Список | Настоящие metadata/effective permissions, server search/filter/sort, filtered count, 25 строк и page 2; Ctrl-click открывает собственную страницу в новой вкладке |
| Фильтры | Apply, отмена pending через Escape, удаление chip, Tab/Shift+Tab boundaries, возврат фокуса |
| Создание | Native POST draft+standard; точный UUID журналируется до отправки, добавляется только probe; ID/reload подтверждены. При потере ответа после настоящего commit форма блокируется, exact-slug lookup не присваивает найденную запись и не повторяет POST |
| Родитель | Реальный delta-only CAS и refetch; настоящий конкурентный 409 сохраняет ввод, compare/keep и последующее сохранение; потерянный ответ после commit сохраняет ввод и блокирует повтор |
| Секции | Новые блоки принадлежат точному pages ID, home_page=null; native отдельный save, parent updated_at продвинулся; подготовленные правки родителя сохранены до явного reconcile |
| Статус | Отдельное подтверждённое status-only CAS; отмена опубликованного save не пишет, подтверждение сохраняет поля без смены статуса |
| SEO | Native seo-interface и production hook; правка скаляра при seo=null сохраняется и возвращается в JSON. Адресные тесты сохраняют все 10 противоречивых create/update сочетаний, explicit empty/unknown JSON и повторный save |
| Файлы | Настоящий native select-dropdown-m2o chooser: выбор собственного загруженного файла, сохранение relation, unlink и сохранение null; файл остаётся в библиотеке |
| Навигация | Отмена ухода с dirty-вводом сохраняет текущую страницу; четыре native вкладки, translations и readonly системные сведения доступны |
| Ошибки/доступ | Реальные anonymous read/write отказы; readonly UI проверен контролируемой подменой permissions-response, loading/503/retry — browser overrides. Отдельный restricted account/новые роли не создавались |
| Регрессии | Товары, категории и home_page открываются в том же кандидате без записи |

Версии/preview/promote остаются явно недоступными: общего принятого workflow нет. Публичная ссылка относится только к сохранённому опубликованному пути; G1/G2 не заявлены.

## Найденные и закрытые дефекты

1. P2: статус в узкой мобильной таблице обрезался. В Pages добавлены container-aware controls и достаточное место/перенос для badge; обычные 390px сохраняют пару status/filters. Проверены 320/390/430px и native panel states.
2. P2: native SEO hydration ошибочно конфликтовала с обычной правкой скаляра. Native initialValues получают недостающие legacy-проекции, сохраняя явные пустые и неизвестные JSON-значения. Перед JSON-first hook baseline-equivalent проекции согласуются со скалярами; настоящие противоречия отвергаются. Покрыты create/update и последующий save.
3. P3: временная блокировка после child save/conflict больше не выдаётся за отказ permissions.

Независимый reviewer открыл approved и actual screenshots, проверил итоговый source/probe и адресное закрытие. Итог production_ready, открытых P0/P1/P2 нет. Второй полный review не запускался для формальности.

## Визуальное сравнение

Оригинальный approved ZIP не изменён; SHA256 10bf71dc1991349b88664905a6555026be23063483284fcc46363aea4c71b2a6 и все 24 manifest entries подтверждены. PNG/HTML открыты как offline-эталон. Actual screenshots находятся в evidence/; это настоящий Directus с кандидатом, не HTML-макет или test harness.

| Пара | Результат |
|---|---|
| List desktop/mobile | Один heading/count, порядок controls и таблица сохранены; native логотип, semantic colors, sidebar и реальные synthetic values допустимо отличаются |
| Main desktop/mobile | Четыре tabs, поля слева и контекст справа; один столбец mobile, нет overlap/overflow. Native toolbar переносит недоступные Versions ниже; отличие не блокирует действия |
| Sections desktop/mobile | Выбор слева/editor справа на desktop, selector над editor на mobile; отдельное сохранение, без двух узких колонок |
| SEO | Native поля слева, отмеченный локальный snippet и OG relation справа. У экземпляра og_image=select-dropdown-m2o, page_type=input с live choices; schema/interface сохранены |
| Filters/create/conflict/readonly/long | Native состояния и размеры проверены; readonly screenshot явно контролируемый, конфликт настоящий |
| 1024 и 320/390/430 | Адресная responsive-проверка без постоянной viewport-матрицы. Open mobile panel — native overlay Directus; после закрытия весь A3 доступен. Финальные captures сняты после завершения native transitions |

## Проверки и очистка

Единый локальный release gate:

```powershell
node scripts/verify-local.mjs
```

Exit 0: 240 backend/tooling, 36 storefront, audit 0, mock production build/TypeScript/client-token canary, 2 Chromium journeys. Pages: 35 PASS. Все 8 runtime src/dist hashes совпали с итоговыми файлами и между основным/closure прогонами. После gate менялись только probe/документы и убраны добавленные incidental VNode assertions; узкие Pages checks снова PASS. Hosted CI/CD не создавалась и не запускалась.

Runtime command (только подтверждённый собственный local stack):

```powershell
node --env-file=<own-dev-env> directus/extensions/deere-shop-product-editor/verification/a3-pages-runtime.mjs --synthetic-probe
```

Probe держит общий Windows mutex, освобождаемый при завершении родителя; приватный exact-ID journal пишется до POST. Контекст immutable по модулям. Guarded CAS cleanup идёт children → pages → files; успешные exact-ID collection queries подтверждают отсутствие, а не item-level 403. --only=<case-name-regex> выполняет адресное закрытие плюс необходимые собственные fixtures.

Основной final-source run fae3116b-309f-4c68-9671-a3bae591c419: core/native SEO/status/409/lost acknowledgement/child/readonly/routes/loading PASS. Три FAIL относились к неоднозначному selector unlink и незавершённому native panel transition. Они не скрыты и закрыты адресно:

- ec76b80b-d047-457b-b29d-b7452ddd5a0c: native file select/save/unlink, page2/new-tab, dirty cancel и unknown create PASS, exit 0.
- fdc83da5-0b24-4ecb-8292-ff8200467266: повторная visual closure только panel/paging/new-tab с ожиданием transition; open/closed labels подтверждены reviewer, exit 0.

Все промежуточные неудачи и cleanup journals остались приватно на Windows. Сводка evidence/acceptance-results.json содержит очищенные результаты без credentials и fixture IDs. Общий read-only audit охватывает все журналы текущей Windows-сессии и подтверждает zero remaining; число новых IDs фиксируется в evidence/cleanup-audit.json.

## Интеграция и deploy

PR #10: https://github.com/alexdubaev/Universal-Commerce-CMS/pull/10. После успешного локального gate и review разрешены commit/push/merge без повторного подтверждения. Итоговый merge SHA и удаление временной ветки/worktree фиксируются в HANDOFF после проверки ancestry/tree и синхронизации локального main.

Production deploy не выполнен: безопасный целевой runtime/update/backup/rollback для установки A3 не подтверждён. Merge не является deployment. После A3 остановиться.

Дополнительная адресная native-card приёмка 477f6575-9658-40ef-afe5-8c05183ece2b: четыре вкладки, translations, readonly ID, main при 1024px и native panel desktop PASS, exit 0. Итоговая сводка: 18 уникальных runtime-сценариев PASS после адресного закрытия; общий audit 11 журналов — 125 pages, 16 page_sections и 4 files отсутствуют (145 exact IDs), zero remaining.
