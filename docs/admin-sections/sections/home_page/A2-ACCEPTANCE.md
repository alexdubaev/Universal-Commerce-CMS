# A2 — приёмка редактора «Главная страница»

Дата: 2026-10-18. База: `c594fd9ac874cd38cfb71abeedf932cfd785de55` (свежий `origin/main`, A1-UI-FIX / PR #7).

Реализован только редактор существующей singleton-записи `home_page` в зарегистрированном Directus module `deere-shop-product-editor`. Маршрут: `/admin/product-editor/sections/home_page`. Непустой ID и `+` не открывают создание записи. Редактор «Страницы» не начат.

## Результат и границы

| Область | Итог |
|---|---|
| Основное | Native H1; исходный `source_page` доступен только для чтения |
| Первый экран | Вкладка по умолчанию; текст слева, native изображение и alt справа; две пары кнопок; раскрываемые search/bulk/excel/photo поля |
| Секции | Существующий `PageSectionEditor`, отдельный CAS и кнопка «Сохранить секцию», 25 строк на страницу, владелец проверяется; status/sort отображаются без редактирования |
| SEO | Native `seo-interface`, поля SEO/OG и индексирования; справа явно обозначенный локальный пример сниппета |
| Дополнительно | Native translations; readonly ID и даты |
| Сохранение родителя | Только dirty-разрешённые поля через существующий guarded endpoint; затем native refetch для hook projections |
| Конфликты | Реальный 409 сохраняет ввод, запрещает повторный save и показывает одну панель сравнения/явного reconcile; потерянный ответ выделен отдельно |
| Права/ошибки | Effective field permissions + item update; отсутствие доказанного контракта, 0/2 singleton или ошибки чтения блокируют редактирование; доступны retry и readonly |
| Статус/версии | Status readonly. Preview/version/promote заблокированы и не имитируются. Обычный save опубликованной записи может менять текущую витрину — это написано в UI |

Все 34 бизнес-поля сверены с live metadata: имена, типы и required совпадают. 39 metadata entries включают ещё пять presentation `group_*`. Фактический `og_image` использует `select-dropdown-m2o`, хотя сохранённый статический паспорт указывает `file-image`: интерфейс экземпляра сохранён без миграции. Полная матрица edit/readonly/consumer: [A2-FIELD-CONSUMERS.md](A2-FIELD-CONSUMERS.md).

Изменения A0 минимальны и сохраняют defaults: optional `EditorToolbar.saveLabel`, opt-in `PageSectionEditor.labels` и permission-filtered `displayFields`. Display-only поля никогда не входят в editable payload. Дополнительные стили строк применяются только к opt-in классам. `index.js` меняется отдельным интеграционным коммитом: import/registration и singleton route guard.

Schema, permissions, credentials, API/hooks, storefront, исходники категорий/товаров, Docker/deployment и зависимости не изменены. Идентификаторы extension и публичные маршруты сохранены. G1/G2 не заявлены.

## Проверки

Единый локальный release gate:

```powershell
node scripts/verify-local.mjs
```

Exit 0: 205 backend/tooling tests, 36 storefront tests, dependency audit 0 vulnerabilities, production mock build с TypeScript и проверкой server-token canary, два критических Chromium journey. Эти repository tests дополняются реальным Directus runtime ниже; они не выдаются за проверку установленного candidate bundle.

Дополнительно: 88 focused A0/home/children boundary tests — PASS; `git diff --check` для candidate файлов — PASS (у неизменённых approved originals сохранены восемь Markdown hard-break пробелов из SHA256-пакета); все семь candidate source/dist пар побайтно равны; Impeccable detector — `[]`. Новые тесты проверяют permission subsets, malformed permissions, singleton cardinality, guarded delta/refetch, 409/uncertain recovery и display-only boundaries. Нет новой hosted CI/CD.

Реальный runtime: Directus 12.1.1 + PostgreSQL 17 на собственном `http://127.0.0.1:18056`. Команда требует приватный существующий manifest владения и явно включённый synthetic probe:

```powershell
node --env-file=<own-dev-env> directus/extensions/deere-shop-product-editor/verification/a2-home-runtime.mjs --synthetic-probe --ownership-manifest=<exact-private-manifest>
```

Финальный run `0e469f39-3725-4d8f-9418-f0f04047235e`: exit 0, 20 проверок preflight/runtime/restore и 26 exact-ID cleanup — PASS. Доказаны фактические parent и child CAS-save, отсутствие общего save, пагинация page 1/2, сохранение во время блокировки controls, native SEO, native выбор другого manifest-owned изображения с сохранением relation и возвратом исходного, required unlink validation без удаления файла, оба 409, потерянный ответ после commit, dirty tab/route guard, реальные anonymous read/write denials и регрессии маршрутов товаров/категорий. Readonly/missing singleton — контролируемые browser response overrides, без создания ролей или изменения permissions. Нет uncaught Vue errors/unresolved components.

Отдельный `--inspect-only` run `19144552-38d3-4cad-b4f4-9ff9cbb127db`: доступны Основное, source relation, все десять раскрываемых hero полей и translations; нет incidental POST/dirty state. Длинные локальные hero title/text проверены на mobile без записи, затем явно отброшены. Сводка, точные SHA256 обслуженных модулей и результаты сохранены в [evidence/acceptance-results.json](evidence/acceptance-results.json).

Приватные журналы записывались до любых тестовых изменений. После всех 12 запусков выполнен отдельный read-only audit точных journal IDs: отсутствуют все 182 созданные тестовые child-записи и один собственный probe-upload из прерванного запуска. Существующий singleton сохранён, исходное содержимое восстановлено; `updated_at` закономерно продвинулся. Удаление подтверждено успешным API list query по точным IDs, не только ответом 403 на item. Старый manifest и ранее существующие файлы не изменялись. Неудачные промежуточные проверки не скрыты: устранены реальные дефекты permissions/ошибок/геометрии/conflict duplication и ошибки probe selectors; финальный run полностью зелёный.

## Визуальная приёмка

Утверждённые оригиналы в [a2-approved/](a2-approved/) перенесены без изменений из PR #8; все семь записей `SHA256SUMS` проверены. HTML открыт и независимо от приложения отрендерен Chromium на 1536×1024 и 390×844. PREVIEW-пометки оригиналов отменены владельцем в START-HERE.

Ниже — реальные Directus screenshots финального candidate, не HTML-макет. Один свежий независимый reviewer сопоставил шесть обязательных пар, затем закрыл конкретные найденные P2 и проверил closure evidence. Итог `production_ready`, открытых P0/P1/P2 нет. Повторное согласование дизайна не требовалось.

| Пара | Сравнение и принятые различия |
|---|---|
| [Hero desktop](evidence/actual-hero-1536.png) / approved hero | Сохранены пять табов, двухколоночная форма и media справа, две пары кнопок и disclosure. Native shell/цвет active tab, реальные подписи и published badge отличаются от demo. Input 40 px, textarea 80 px; доля copy около 55%; image/caption не перекрывают alt |
| [Hero mobile](evidence/actual-hero-390.png) / approved mobile | Один столбец, системный sidebar свёрнут, tabs прокручиваются; длинный native заголовок переносится. Нет горизонтального overflow страницы |
| [Sections desktop](evidence/actual-sections-1536.png) / approved sections | Список слева и editor справа, отдельный save. 26 synthetic paging rows вместо трёх demo, native группы и controls; нет reorder или общего сохранения |
| [Sections mobile](evidence/actual-sections-390.png) / approved mobile sections | Список сверху с ограниченной высотой/внутренним scroll, editor ниже; показано меньше строк, native tabs переносятся. Overflow страницы отсутствует |
| [SEO](evidence/actual-seo-1536.png) / approved SEO | Поля слева, локальный snippet справа. Native поля имеют большие вертикальные интервалы; OG/native SEO ниже по scroll. Snippet не обещает выдачу Яндекса |
| [Conflict](evidence/actual-conflict-1536.png) / approved conflict | Одна заметная панель, local/remote diff, сохранённый ввод, disabled save и явные compare/keep/discard. Без публикационного действия |

Дополнительные доказательства: [1024 px](evidence/actual-hero-1024.png), [native file library](evidence/actual-native-file-library.png), [readonly](evidence/actual-readonly-1536.png), [missing singleton](evidence/actual-empty-1536.png), [Основное](evidence/actual-overview-1536.png), [раскрытые hero поля](evidence/actual-search-expanded-1536.png), [длинный текст mobile](evidence/actual-long-copy-390.png). Изображение — существующая нейтральная synthetic fixture; макетный placeholder не заменяет native picker. Принятые различия связаны с настоящей оболочкой/данными Directus, не с заменой утверждённой структуры.

## Runtime и deploy

Candidate подключался только в тестовом браузере через перехват `/extensions/sources/index.js` и отдачу ровно проверенных dist-модулей. Native UI/plugins и HTTP mutations работали с настоящим собственным Directus. Файлы установленного bundle/контейнеры не обновлялись. Screenshot acceptance не означает deployment.

Deploy не выполнен: подтверждённого целевого окружения с безопасной процедурой обновления и rollback для A2 нет. Git merge и runtime acceptance не объявляются production deployment. Для установки нужны отдельная подтверждённая процедура/цель и проверка фактически установленного bundle.

Следующему агенту: после A2 остановиться; Pages не начинать. Новая задача — новая ветка от свежего `origin/main`, отдельный проверенный PR, локальный gate перед публикацией; защищённые области и чужая dirty worktree неприкосновенны. Материалы PR #8 закрывать как заменённые только после проверки сохранности в main. Удалять только собственную объединённую ветку и чистый worktree.
