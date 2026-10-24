# Запуск агента — A5 v3

Продолжай **Universal Commerce CMS**, не начинай проект заново. A0–A4 уже выполнены. Сначала прочитай `AGENTS.md` и `docs/admin-sections/sections/site_settings/a5-v3-handoff/README.md`; затем открой там `A5_IMPLEMENTATION_TZ.md`, `A5_settings_v3.html` и матрицу `A5_FIELD_CONSUMERS.md`. В ZIP этой папки лежат исходники прототипа, тесты и реальные скриншоты.

Проверь свежий `origin/main`, статус документационного PR и существующих A5-веток. Работай в отдельном worktree на Windows. Реализуй удобный **русскоязычный `site_settings` singleton внутри текущего Directus Vue module**, переиспользуя A0; HTML — только образец, не production-код. Сохраняй только разрешённые поля через подтверждённый guarded CAS, не меняй схему, роли, секреты, витрину, другие редакторы и production. Если нет безопасного field-level контракта — останови запись и опиши точный блокер.

Проведи фокусные проверки, `node scripts/verify-local.mjs`, установку в подтверждённый тестовый Directus, desktop/mobile сравнение с v3 и независимый review. После всех PASS — commit, PR, merge и единый HANDOFF с фактическим SHA/PR, тестами и ограничениями. Никаких тестов на чужих данных и глобальной очистки Docker.
