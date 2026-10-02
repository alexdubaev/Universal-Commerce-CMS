# A0 — общая основа редакторов Directus

Реализуй общую основу в `directus/extensions/deere-shop-product-editor`. Перед началом прочитай корневые правила проекта, ADR-002, этот пакет, план, дизайн-систему, контракты и актуальный код редактора. Используй текущий HEAD destination, проверенный после извлечения базового проекта, а не исторический SHA из исследовательских материалов. Работай в отдельной чистой task branch/worktree и зафиксируй SHA и проверенное состояние.

## Поведение
Единая оболочка, компактные native поля и вкладки, пагинированный список, toolbar, dirty/error/conflict/read-only state, штатный file picker. Существующий редактор товаров сохраняет маршруты и поведение. Новые разделы подключаются через стабильные exports; их реализация принадлежит отдельным исполнителям.

## Разрешённые файлы
Относительно `directus/extensions/deere-shop-product-editor/`:
- `src/admin-shell.js`, `src/admin-state.mjs`, `src/page-sections.js`;
- зеркальные `dist/admin-shell.js`, `dist/admin-state.mjs`, `dist/page-sections.js`;
- `test/admin-state.test.mjs`, `test/page-sections.test.mjs`.

Маршрутизация `src/index.js` и `dist/index.js` — отдельный scoped integration commit того же единственного владельца. Новый namespace `/admin/product-editor/sections/<collection>`; существующие product routes `/admin/product-editor`, `/+`, `/:id` сохранить. Не переносить весь product editor в новую секцию.

## Контракт для параллельных исполнителей
Зафиксируй сигнатуры AdminShell, SectionTabs, EditorToolbar, NativeFieldGroup, CollectionList, MediaPicker, ReadonlyDetails, createEditorState, PageSectionEditor до запуска wave1. Каждый export опиши примерами props/events и обработкой permissions/409. PageSectionEditor один для home_page/pages. Дочерние строки имеют отдельный baseline и сохранение; версия родителя не означает изоляцию live children. Не добавляй отсутствующие в схеме snapshot поля.

## Предстарт
Проверь целевой проект `D:/codex/Universal Commerce CMS`: чистую отдельную ветку/worktree, актуальный destination HEAD и отсутствие чужих изменений в разрешённых файлах. Проверь текущие ADR и API contracts. Scope этой задачи ограничен файлами выше, кроме отдельного разрешённого integration изменения. До проверки статического плана подтверждай live schema/plugins/permissions; не добавляй новые контракты.

## Проверки
Из каталога расширения:
```powershell
node --test test/editor-state.test.mjs
node --test test/admin-state.test.mjs test/page-sections.test.mjs
git diff --check
git diff --name-only
```
Вторая команда относится к тестам, создаваемым этим заданием. Покрыть реальные границы: сохранение между вкладками, changed-fields payload, сохранность baseline, 409 без потери ввода, поздний ответ другой записи, запрет записи без permission/contract, независимость дочерних изменений. Проверить src/dist parity. После разрешённого обновления только тестового bundle — native picker, desktop1536×1024/mobile390×844 и регрессия товаров. Старые результаты тестов из исследовательского отчёта не заменяют свежий запуск.

## Границы
Schema, dependencies, роли/права, secrets, Docker/deploy, storefront, lead processing и каталоговые данные не менять. G1/G2 сюда не входят. Если для UI нужна отсутствующая возможность API, зафиксируй зависимость и оставь действие недоступным. Реальные данные не использовать для демонстрационного smoke.

Перед commit проверь фактический diff по allowlist, передай независимому reviewer, исправь подтверждённые замечания и отдай один reviewed commit с точными exports и результатами проверок. Параллельные UI-задачи стартуют от этого reviewed commit, а не от незавершённой общей основы.
