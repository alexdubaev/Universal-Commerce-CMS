# A5 — проверка реализации, 25.10.2026

Основание: актуальные #21/#22, пакет v3 из PR #14 (`d8d8082cf05a04824e343b99769311caacb97db0`), утверждённые парные снимки в `ux-proposal/`. Владелец утвердил показанное предложение и отдельно описанный узкий backend scope сообщением «Реализуй». Старые запреты повторного разрешения/деплоя в архиве заменены #21/#22.

База: `6bbfd3cdbc06fc17fa91251f92218480778bb44f`. A0–A4: issues #15–#20 закрыты, PR #23–#28 объединены; установленный A4 и исходный aggregate проверены. PR #14 остаётся историческим открытым draft, старый незавершённый A5 worktree сохранён. Полезная реализация адаптирована на свежем A0; старые shared/index не переносились.

## Результат и границы

Настоящий Vue-раздел существующего Directus: обзор, короткие формы на месте, пять вкладок и одна запись настроек. Общий Save отправляет только изменённые разрешённые поля через принятый A0 и существующий guarded endpoint. Регистрация добавляет одну ссылку из товаров, маршрут singleton не принимает id. Создания, удаления, публикации и второй админки нет.

Серверное дополнение ограничено `commerce-api/src/mutations.mjs`, его dist и целевым тестом: 29 строковых/файловых полей, запрет чувствительных/неизвестных/nested полей и удаления; caller ItemsService, CAS и транзакционная проверка единственности. Новые file-связи требуют читаемого изображения в существующей настроенной публичной папке. Отвязка не удаляет файл, неизменённые недоступные связи сохраняются. Это контракт guarded endpoint; native Directus и его роли не заменены.

Схема, роли, аккаунты, secrets, зависимости, storefront, Docker/infra-конфигурация и другие разделы не изменены. 59 посторонних файлов расширений защищены проверкой hash-инвентаря при установках и откате. Матрица фактических потребителей: `CURRENT-CONSUMERS.md`.

## Подтверждённое окружение

- Windows Directus **12.1.1**, `http://127.0.0.1:18056`, Compose `universal-commerce-cms-dev`, loopback-only.
- Проверены принадлежность контейнеров, image, config label, bind расширений и именованные volumes. Существующий bind-mounted worktree не перемещался.
- Внешний production target не установлен; публичный сервер не придуман. `:3000` использовался только как наблюдатель неизменённой витрины через существующий service gateway.
- REST singleton — объект; metadata singleton=true, физическая запись одна, 38 полей. Подтверждены collection/item/field permissions и required/readonly/hidden/type metadata. Для глобального count нужен full read; частичные права не доказывают единственность.

## Проверки

| Проверка | Фактическое свидетельство |
|---|---|
| A0/A5 controller и серверная граница | Целевые Node-тесты: tab/draft/reset, metadata/permissions, dirty-only CAS, конфликт, потерянный ответ/readback, файлы, неизвестные данные, double-save lock; последняя A5 suite 29 PASS |
| Настоящий Directus API | 20 проверок PASS: строки с ведущими нулями, stale CAS 409, обязательные поля, sensitive/unknown/nested/delete denial, private/unreadable file denial, public link/unlink, сохранность файла, anonymous и подтверждённый service user 403 |
| PostgreSQL | 16 PASS на собственной изолированной копии: scalar/file/CAS, пустая/множественная запись, гонка на двух соединениях с одним победителем. Тестовая схема удалена после проверки owner/manifest/точного списка таблиц; общий singleton не дублировался |
| Native UI | Объединённый Save company/city/footer/logo, reread после сохранения; затем все четыре picker (logo/favicon/company_image/default_og_image), их общий Save и отвязка без удаления. Два окна/409/явная сверка на desktop/mobile, подтверждение отмены/ухода, ArrowRight по вкладкам, переход к обязательному полю и возврат фокуса после отмены |
| Витрина | После revalidation реально появились проверочные название, город и footer; затем восстановлены. Нет обещания мгновенного эффекта или замены статического логотипа/темы/SEO |
| Данные и очистка | Сравнены все 37 полей кроме updated_at с приватным baseline; всё восстановлено, версия закономерно изменилась. Собственные API/UI PNG удалены через проверку точной identity и отсутствия связей. Служебные/unknown значения сохранены |
| Installer | 10 disposable checks PASS: шесть точных artifacts, src/dist, drift/foreign hash denial, отсутствие файлов до A5, частичная установка, rollback, target/source identity, app-only aggregate markers. Recovery guards 6 PASS |
| Независимое review | Один свежий reviewer, bounded closure исправлений. Подтверждённый P2 перехода к полю исправлен; после закрытия замечаний P0/P1/P2 нет. Отдельно просмотрены пять реальных desktop/mobile снимков против утверждённых ориентиров |
| Канонический gate | `node scripts/verify-local.mjs` — полный PASS точного финального кода: backend 374, storefront 36, audit 0 vulnerabilities, production build/TypeScript, token canary и 2 Chromium journeys. Приватный лог `verify-local-release-pass.log`; source/dist hashes приведены ниже |

Исторические неуспешные попытки не скрыты: тестовый PG adapter сначала передавал Date вместо HTTP JSON/ISO, затем исправлен без изменения продукта; Directus 403 для удалённого file заменён проверкой пустого filtered admin list. Один Windows Next/Turbopack процесс завершился `0xC0000409` без доступного WER/panic следа; изолированная сборка и новый полный gate прошли. Неуспешный частичный прогон не засчитан.

Финальные SHA256 source/dist пар: index `ec73cae145f354332c535a46dc7becfc43e2a5d407b4acf60c2ca0f0c4e2bc4d`; A5 `f3c5a68250009f6fdfca31db97b4916aa631689f02f47e5c8a3979b52ff83e02`; mutations `0c75a6aa5f98f760d8131224dbab26a52e731365644493b7540e61372723b190`. Проверенный native aggregate `897756e62299a0732f2af5ef0761362cd24d2a95ef4d864a4bbe65e7ca15db61`.

## Визуальная проверка и ограничения

Реальные основные экраны сняты при **1536×1024** и **390×844**. На mobile нет page overflow, native поля 16 px, кнопки Save 44 px, вкладки 46 px. Панель Save около 100 px; последнее проверенное поле заканчивается выше панели (499 < 744 px). Текст вкладок `rgb(79,84,100)` на белом имеет контраст выше 4.5:1. Используются theme tokens.

Это самостоятельная проверка исполнителя, не исследование с новичком и не WCAG-сертификация. Hardware virtual keyboard и dark theme в браузерной приёмке не эмулировались; профиль пользователя ради темы не менялся. Native A0 отображает русские labels, но его исходная привязка aria-label/id к input не менялась вне scope A5. Lost ACK/частичные права/недоступные metadata проверены контролируемыми controller/handler boundary tests; это не заявлено как испытание отдельной native Manager роли. В этом runtime Manager отсутствует; Administrator-only UI не доказывает права сотрудника. Подтверждённый существующий service user не может изменять настройки.

Мессенджеры и social_links имеют неподтверждённый input-code формат: только понятный readonly-статус без JSON-ввода. Не подключённые logo/images/colors/CTA/global SEO помечены; действующий footer к ним не приравнивается. Новых потребителей storefront не добавлено.

## Backup и откат

Приватные receipts и baseline находятся вне Git: `D:/codex/ucms-release-backups/a5-settings-20261025/`. Исходный `a5-pre-a5-baseline.json` хранит четыре прежних файла и отсутствие двух A5 файлов. Репетиция `a5-rollback-rehearsal.json` восстановила исходный aggregate **cdd4710fcc538fab326ae3a501a3d6612a3d0af9b2ed8bcc27add135b29e3fa7**, health ok, затем кандидат установлен повторно.

Откат меняет только шесть проверенных artifacts при совпадении ожидаемого hash и инвентаря; БД и uploads целиком не восстанавливаются. Перед финальной установкой из чистого merged main снимается дополнительный backup. Точные candidate/merge/deploy SHA, PR, итоговые receipts, screenshots и cleanup указываются в финальном HANDOFF после выпуска.
