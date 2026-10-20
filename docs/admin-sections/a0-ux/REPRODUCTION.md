# A0-UX: факты до исправлений

Дата: 20 октября 2026, Windows, Europe/Moscow. Задание: issue #15.
Статус: воспроизведение и предложение для согласования. Исправления не начаты.

## База и изоляция

- `git fetch origin`: выполнен; `origin/main` = `5cb9958181d4df211d9dcaccd16aa66439a8b8bb`.
- Worktree: `C:/Users/Alexandr/.codex/worktrees/a0-ux-issue15/Universal Commerce CMS`.
- Ветка: `codex/a0-ux-issue15`, создана от свежего `origin/main`.
- Исходный checkout имеет чужие dirty-изменения; они не менялись.
- В A5 остались свои незакоммиченные `src/index.js`, `dist/index.js` и файлы A5. Чат A5 был idle при проверке; другие чаты проекта не были active. Это наблюдение, не обещание отсутствия будущих конкурентных правок. Перед реализацией проверить повторно.
- PR #14 остаётся OPEN/DRAFT; ни его ветка, ни материалы, ни регистрация A5 не менялись.

## Настоящий runtime

Проверены `docker ps` с фильтром проекта и `docker inspect` только контейнеров проекта `universal-commerce-cms-dev`.

- Directus 12.1.1: `http://127.0.0.1:18056`, bind `127.0.0.1:18056 -> 8055`.
- Directus container: `universal-commerce-cms-dev-directus-1`, id `de0406e89f66`.
- DB container: `universal-commerce-cms-dev-db-1`, id `dd99a9308047`, healthy.
- Extensions mount: `C:/Users/Alexandr/.codex/worktrees/storefront-directus-acceptance/Universal Commerce CMS/directus/extensions`.
- Volumes: `universal-commerce-cms-dev_directus-uploads`, `universal-commerce-cms-dev_postgres-data`.
- Runtime файлы `dist/admin-shell.js`, `page-sections.js`, `admin-state.mjs`, `index.js`, `sections/categories.js`, `home_page.js`, `pages.js`, `articles.js` побайтно совпали с `src` свежего main. Для тех же файлов в main `src` и `dist` совпали.
- Установка bundle, перезапуск контейнеров, изменение Docker, schema/metadata, ролей или singleton не выполнялись. Production не затрагивался.

Проверки браузером выполнялись в отдельной сессии Playwright `ucc-a0` на этой Windows-машине. Использована существующая Administrator; проверка реального менеджера/RBAC этим не подтверждается. Credentials не выводились и не включены в evidence.

## Воспроизведённые проявления

1. Открыть новую категорию без ввода. В заголовке и toolbar дважды появляется «Все изменения сохранены.» до первой записи. Скриншот: `evidence/before-category-new-desktop.png`.
2. Создать собственную draft-категорию. В первом окне изменить название на «Мой вариант A0». Во втором открыть ту же запись, изменить название на «Сохранённый вариант A0», сохранить: реальный HTTP 200. В первом сохранить: реальный HTTP 409; название «Мой вариант A0» осталось в поле. Появились пять alert-узлов (повторяющиеся сообщения конфликта/ошибки/неподтверждённого результата). Это видно и на screenshot, а не только в DOM. `before-conflict-desktop.png`, `before-conflict-mobile.png`.
3. Нажать «Сохранить мои изменения» после 409. Открылось «Сравнение перед повторным сохранением», новых mutation POST/PATCH/DELETE не было (проверен listener requests на время действия). В сравнении заголовок поля `title`, варианты «Ваше значение» / «На сервере». `before-comparison-desktop.png`.
4. В изменённой категории нажать «Назад». Браузерный confirm: «Есть несохранённые изменения. Покинуть страницу?». Отклонить: маршрут и локальный ввод сохранились. Это внутренний переход через `window.confirm`, отдельно от браузерного `beforeunload`. Штатный диалог Directus ещё не реализован.
5. Открыть собственную страницу, вкладку «Секции», собственный блок. В списке `Тип: text`; вкладки `Group content`, `Group main`, `Group button`, `Group items`, `Group system`. В PagesSection кнопка уже называется «Сохранить блок». Нажать дочерний «Назад»: URL и полный `innerText` дочернего редактора не изменились. `before-child-desktop.png`.
6. Изменить название собственного блока. Перехватить только ответ его guarded POST: сначала выполнить настоящий `route.fetch()` и проверить HTTP 200, затем передать браузеру повреждённое подтверждение `{data:{}}`. API/модули/bundle не заменялись. UI показал `Save acknowledgement does not contain the changed fields and version`, `Unsaved` и «Сохранение…»; повторный осмотр спустя несколько минут также показал «Сохранение…». Свежий GET подтвердил записанное название «Проверка потерянного ответа A0». Повторный POST сохранения не выполнялся. Это повреждённое подтверждение после реальной записи, а не доказательство сценария физического сетевого обрыва. `before-uncertain-child-desktop.png`.
7. Дополнительная проверка A0 без overrides: уже установленный `PageSectionEditor` взят из дерева настоящего Directus Vue и смонтирован с `labels:{}` в том же `appContext`. Новые исходники/модули в браузер не подставлялись. Получены `Page sections`, `Type: text`, `Status: draft`, `Hidden`, `Select a section to edit its native Directus fields.`, технические вкладки и общий «Сохранить». Harness после проверки размонтирован; это дополнительная проверка общих defaults, а не зарегистрированный менеджерский экран. `before-generic-desktop.png`, `before-generic-mobile.png`.
8. `/admin/product-editor/sections/home_page/invalid-a0-address`: «Редактор главной страницы работает только с singleton-записью без ID в маршруте.», недействующие действия общей панели. `/admin/product-editor/sections/a0_unknown_probe`: «Раздел «a0_unknown_probe» недоступен.». `before-invalid-home-desktop.png`, `before-unknown-route-desktop.png`.

Живая metadata `section_type` не содержит choice `text`. Наш блок поэтому проверяет неизвестный тип. В предложении: «Тип блока не распознан» с сохранением исходного значения, без выдуманного типа. Сама metadata оставлена неизменной.

## Собственные данные и cleanup

| Коллекция | Точный ID | Проверка владения |
|---|---|---|
| categories | `50172583-1711-4542-90ea-50c53078bc54` | slug `a0-ux-issue15-20261020-0657`, draft, собственное сохранённое название |
| pages | `519802b0-3b22-4581-83e1-5b46903882f8` | slug `a0-ux-issue15-page-20261020-0702`, draft, «Тестовая страница A0» |
| page_sections | `b7a5a105-af8f-42af-9ca1-ea41d511c0da` | точный parent ID выше, собственное сохранённое название |

Перед удалением все три записи перечитаны и проверены. Первоначальный native DELETE ребёнка получил 409: существующая защита запретила обход guarded mutation; запись не была удалена. Затем использован штатный `POST /commerce/mutations/:collection/:id` с `action:'delete'` и полным свежим expected snapshot, как в существующем A0 runtime verifier. Порядок: ребёнок, страница, категория. Все три guarded удаления получили HTTP 200; отдельные запросы списка с фильтром по каждому точному ID подтвердили отсутствие записей. Удаления по префиксу и восстановления БД не было. Существующие записи, singleton, assets не изменялись.

## Границы доказательств

Это диагностика до исправления, не итоговый PASS матрицы issue. Не выполнены пользовательская приёмка, real-manager RBAC, сетевой обрыв после записи, новая реализация штатного диалога/клавиатуры, финальное ревью и `node scripts/verify-local.mjs`. Они относятся к следующему шагу после согласования.

Статичный макет `panels-preview.html` не установлен в Directus. Его desktop/mobile screenshots показывают только предложение, не исправленный runtime. Проверка макета на 1536/1024/390/320 px: document overflow отсутствует; видимые подписи кнопок и ячеек помещаются. Скрытые заголовки мобильной таблицы исключены из измерения обрезания, поскольку для них намеренно используется visually-hidden CSS.
