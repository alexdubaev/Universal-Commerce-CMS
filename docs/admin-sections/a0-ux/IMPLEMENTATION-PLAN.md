# A0-UX: выполнение согласованного предложения

Владелец согласовал PROPOSAL.md и desktop/mobile-фрагменты 20 октября 2026 сообщением «согласовываю».
BASE: `5cb9958181d4df211d9dcaccd16aa66439a8b8bb`; ветка `codex/a0-ux-issue15`.

## Исполнитель и scope

Один worker владеет всеми продуктовыми правками, lead выполняет интеграцию, runtime-проверку и итоговую проверку. A5 idle; его dirty worktree и PR #14 не меняются. Перед установкой проверяется неизменность runtime-файлов и владельцев. Нет параллельных продуктовых writers.

Разрешённый набор (относительно `directus/extensions/deere-shop-product-editor/`):

- `src/admin-shell.js`, `dist/admin-shell.js`: единый статус/безопасные сообщения, явные save/compare/cancel/back, штатные подтверждения Directus, безопасное представление сравнения.
- `src/page-sections.js`, `dist/page-sections.js`: русские defaults/groups/types, отдельное сохранение блока, удаление no-op back, состояния/сравнение без raw ошибок, отмена только текущего блока.
- `src/index.js`, `dist/index.js`: исключительно fallback SectionRoute и необходимый экспорт общего helper; товарный редактор, route IDs и registry не изменяются.
- `src/sections/{categories,home_page,pages,articles}.js` и dist-пары: только адаптация общих событий/состояний, сравнение с понятными полями и удаление дублей. Формы/структура разделов не переделываются.
- `test/admin-state.test.mjs`, `test/page-sections.test.mjs`, `test/sections/{categories,home_page,pages,articles}.test.mjs`: только затронутые поведенческие проверки; небольшой `test/admin-ux.test.mjs` допустим, если существующий setup неудобен. `node --test` должен обнаружить его без нового CI.
- `docs/admin-sections/a0-ux/`; уточнения CONTRACTS.md / DESIGN-SYSTEM.md только при необходимости.

`admin-state.mjs` src/dist остаётся без изменений, пока воспроизводящий тест не докажет невозможность минимального UI-исправления. Любая необходимость его изменения сначала рассматривается lead. CAS/concurrency/identity/generation/permissions/acknowledgement recognition не ослабляются.

## Последовательность и приёмка

1. Поведенческий RED: подтверждённые ошибки статуса, конфликта, cancel и навигации; состояние после неподтверждённой записи; no-op back и небезопасные defaults. Проверки не читают source-текст и не копируют incidental DOM.
2. Минимальный GREEN в общих компонентах и необходимых адаптерах. Сравнение и выбор своего варианта не пишут. Отдельный Save сохраняет существующую защищённую запись. Ошибка чтения не снимает блокировки и не теряет ввод. Повторное изменение конкурентом снова приводит к конфликту.
3. Lead проверяет фактический diff, src/dist parity и адресные команды:
   `node --test directus/extensions/deere-shop-product-editor/test/admin-state.test.mjs directus/extensions/deere-shop-product-editor/test/page-sections.test.mjs directus/extensions/deere-shop-product-editor/test/sections/categories.test.mjs directus/extensions/deere-shop-product-editor/test/sections/home_page.test.mjs directus/extensions/deere-shop-product-editor/test/sections/pages.test.mjs directus/extensions/deere-shop-product-editor/test/sections/articles.test.mjs`.
   Новый admin-ux test, если есть, запускается явно.
4. Установить только согласованные файлы в подтверждённый test runtime после проверки mounts и исходных hashes. Не подменять модули браузером. Только собственные synthetic fixtures; singleton не меняется. Реальная проверка основных действий, ошибок/409/потерянного ответа, выхода и фокуса. 1536x1024/390x844; 1024/320 только панели/диалоги.
5. Одно независимое review без implementation history, один bounded fix pass для подтверждённых P0/P1/P2, narrow closure check. Lead оценивает безопасность и scope.
6. `node scripts/verify-local.mjs` на точном финальном кандидате. Существующие зависимости устанавливаются по lockfile в своём worktree, без изменений manifests/lockfiles и без CI. Никакой syntax-only подмены недоступных integration/E2E.
7. Пользовательская приёмка установленного интерфейса. До неё commit/push/PR/merge не объявляются завершёнными. После неё выполнить согласованный Git workflow без повторного merge-разрешения. Production и следующий раздел не запускать.

STOP: защищённые файлы/данные нужны для исправления; main изменился и есть конфликт; конкурентный writer в shared runtime; неразрешённый P0/P1/P2; обязательная проверка недоступна/красная; пользовательская приёмка ещё не получена.
