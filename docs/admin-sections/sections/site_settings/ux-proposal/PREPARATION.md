# A5 — подготовка и предложение до утверждения

Дата: 25.10.2026. Утверждение нового предложения не получено. Продуктовый код, регистрация, установленный bundle и содержимое site_settings не менялись. Разрешённые новые файлы этого этапа — только отдельный макет, снимки и отчёт в этой папке вне репозитория.

## Проверенные источники

- Свежий origin/main: `6bbfd3cdbc06fc17fa91251f92218480778bb44f`, локальный main чистый.
- #21/#22 прочитаны с GitHub 25.10.2026, включая актуальный порядок утверждения/автономного выпуска.
- A0 #15 / PR23, товары #16 / PR24, A1 #17 / PR25, A2 #18 / PR26, A3 #19 / PR27, A4 #20 / PR28: issues закрыты, PR merged, HANDOFF/acceptance и актуальные установленные артефакты проверены. A4 release HANDOFF: D:/codex/ucms-release-backups/a4-ux-20261025/HANDOFF.md.
- PR14 OPEN/DRAFT, документационный пакет v3 на `d8d8082cf05a04824e343b99769311caacb97db0`. Материалы извлечены только в эту папку, в main их нет.
- Старый A5: C:/Users/Alexandr/.codex/worktrees/a5-site-settings/Universal Commerce CMS, ветка codex/a5-site-settings-2026-10-19, HEAD cc95ed7148ed7caf19f9ebea2abe1e2a4c3ddcf3. Есть незакоммиченные section/index/tests/evidence; сохранены без изменений. Старый HANDOFF явно останавливал writable A5 из-за отсутствия серверного field guard. Исторические PASS не переносятся на новую реализацию. После утверждения — свежая ветка от актуального main с адресным переносом пригодного A5, без повторного создания или переноса старого index/A0.

## Фактический target и предстарт

Windows Directus 12.1.1, http://127.0.0.1:18056, Compose universal-commerce-cms-dev, loopback 18056→8055, собственные database/uploads volumes. Реальный extension bind: C:/Users/Alexandr/.codex/worktrees/storefront-directus-acceptance/Universal Commerce CMS/directus/extensions. Чужой bind/worktree не перемещать и не удалять. Витрина :3000 — только наблюдение по затронутому scope; публичный production-target не установлен.

Проверены authenticated health ok, версия, mount, все перечисленные A0–A4 hashes и aggregate `cdd4710fcc538fab326ae3a501a3d6612a3d0af9b2ed8bcc27add135b29e3fa7`. Custom A5 отсутствует в регистрации и установленном bundle. «До» — сегодняшняя native форма /admin/content/site_settings, не старый архив.

Singleton metadata=true; глобальный SQL SELECT count=1; native ответ — объект. Есть PK и четыре FK файла, отдельного DB cardinality constraint нет. Эффективный Administrator read/update '*' и item update=true. Manager/app-политика отсутствует; ни роль, ни аккаунт не создавались. Нельзя объявлять Administrator-only проверку менеджерским тестом. Нулевой/множественный/неподтверждённый singleton должен блокировать Save, автоматически создавать запись нельзя.

Live поля company_name/phone/email обязательны и NOT NULL; реквизиты string. Служебные commerce_profile/translations/analytics доступны администратору, отдельного server-side field запрета в /commerce/mutations нет. Общий endpoint допускает также delete. Скрытие UI-полей проблему не решает.

Native logo/favicon=file-image. Библиотека реально открыта и закрыта без выбора, загрузки или Save. company_image/default_og_image=select-dropdown-m2o; полноценный безопасный file-picker и save/read-back предстоит подтвердить после утверждения. messengers/social_links=input-code, принятого native repeater нет: в предложении они не редактируются, данные сохраняются.

## Предложение и граница сохранения

Файл proposal.html — изолированная адаптация v3/A0, без API и localStorage вместо CMS. Пять вкладок, компактный обзор и короткие inline-правки, объёмные формы в основной области. Никакого выдуманного логотипа/UUID/JSON/служебного профиля. Одна операция сохраняет dirty разрешённые поля одной записи из всех пяти вкладок, не товары/страницы/блоки. Переключения не пишут и не теряют ввод. Отмена подтверждается; сравнение только читает/выбирает; потерянный ответ требует проверки, без автоматического повтора записи.

Проверка макета: отрисованы desktop1536×1024/mobile390×844, просмотрены обзор/формы/файлы/конфликт/uncertain, исправлены перекрытие mobile Save пометкой и неверное приписывание конфликта другому сотруднику. Это не native/runtime acceptance A5 и не тестирование новичком. Снимки и размеры/hashes — screenshots-manifest.json; галерея /gallery.html.

## Эффекты настроек по актуальному коду

17 полей запрашиваются Next.js, 15 имеют потребителей. Контакты, компания, реквизиты, город/адрес/часы, footer_text/footer_disclaimer используются; legal_name/legal_address также Organization JSON-LD. vat_info/delivery_region участвуют во встроенных страницах, когда их не заменяет CMS-контент. CTA два поля читаются, но не используются. Логотип/цвета/global SEO не подключены к текущему представлению. Четыре file-связи участвуют в asset eligibility, дополнительно требуется настроенная публичная папка: отсутствие визуального потребителя не означает отсутствие последствий. Revalidate120 не обещает точный срок обновления.

## Scope, предлагаемый к утверждению

UI: deere-shop-product-editor/src/sections/site_settings.js и dist-копия, test/sections/site_settings.test.mjs, адресная регистрация src/index.js/dist/index.js, docs/admin-sections/sections/site_settings/. Актуальный A0 переиспользуется, общая основа не заменяется.

Отдельно требуется явное утверждение узкого backend scope: commerce-api/src/mutations.mjs, dist/mutations.mjs и профильные интеграционные тесты. Только для site_settings: точный разрешённый набор полей, запрет защищённых полей/удаления, CAS и подтверждённая единственность записи, безопасные file relations по существующим правам и public-asset правилам. Другие коллекции и native права администратора не переопределяются. Новые права/роли, schema/SQL миграции, секреты, storefront, зависимости и инфраструктура не входят в предложение.

После утверждения: полезные узкие тесты, настоящее установленное A5, ограниченные/ошибочные/конкурентные сценарии, точный verify-local.mjs, один независимый review и необходимые исправления, commit/push/PR/merge, guarded artifact backup/rollback, штатный deploy в указанный локальный target и post-deploy screenshots/проверки. Новая реализация до утверждения не начинается. Рутинный повторный запрос merge/deploy не требуется.

За A5 не переходить. Сегодня продуктовые тесты не запускались: продукта кандидата ещё нет. Commit/push/PR/merge/deploy не выполнялись. Main и чужая незавершённая работа сохранены.
