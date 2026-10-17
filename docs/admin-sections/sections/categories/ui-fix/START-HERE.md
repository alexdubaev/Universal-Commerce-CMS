# A1-UI-FIX — начать здесь

Одна задача: исправить интерфейс существующего списка «Категории» и его фильтров. Не переписывать CMS, A0, карточку категории, создание, CAS, API или права. Следующий редактор не начинать.

## Где материалы

Архив в этом каталоге: [categories-ui-fix-source.zip](categories-ui-fix-source.zip).
Контрольная сумма: [SHA256SUMS](SHA256SUMS).

Внутри каталога `categories-ui-fix/`:
- `README.md` — состав, ограничения и подготовка визуальных эталонов;
- `TASK.md` — полное исходное задание A1-UI-FIX;
- `categories-reference.html` — неизменённый интерактивный визуальный образец;
- `check_reference.py` — исходный проверщик макета и генератор его скриншотов;
- `reference-checks.json` — исторический отчёт только об офлайн-макете;
- `MANIFEST.json` — SHA-256 исходных файлов.

Это компактная исходная версия пакета, НЕ побайтная копия прежнего `categories-ui-fix.zip`: готовых PNG здесь нет. Исходные TASK.md, HTML и проверщик сохранены без изменений. PNG нужно получить из того же HTML, а исходный экран «до» — снять в настоящем Directus перед исправлением. Не придумывать новый дизайн вместо этого образца. Контакты, каталог и тестовые значения HTML не переносить в CMS.

## Получение, пока материалы находятся в отдельной ветке

Ветка публикации: `docs/a1-ui-fix-materials-20261017`.

Начни с `git fetch origin`. Рабочую ветку и отдельный чистый worktree создай от свежего `origin/main`, НЕ от ветки материалов. Если этот каталог ещё не вошёл в main, перенеси только его в новую рабочую ветку:

```sh
git restore --source=origin/docs/a1-ui-fix-materials-20261017 -- docs/admin-sections/sections/categories/ui-fix/
```

Команду выполняй только в собственном новом worktree; не перезаписывай чужую локальную работу. Включи сохранённые материалы в итоговый проверяемый diff. Когда этот каталог уже есть в main, отдельное копирование не требуется.

## Проверка и распаковка

PowerShell, из корня собственного worktree:

```powershell
$zip = Join-Path $PWD 'docs/admin-sections/sections/categories/ui-fix/categories-ui-fix-source.zip'
$expected = 'a2def2dae8dba60cefa4fd05d13cccfebc02a9e05dba6843b6dab7c98c67c86d'
if ((Get-FileHash -Algorithm SHA256 $zip).Hash.ToLowerInvariant() -ne $expected) { throw 'Archive checksum mismatch' }
$destination = Join-Path ([System.IO.Path]::GetTempPath()) ('categories-ui-fix-' + [guid]::NewGuid().ToString('N'))
Expand-Archive -LiteralPath $zip -DestinationPath $destination
$materials = Join-Path $destination 'categories-ui-fix'
Get-Content -LiteralPath (Join-Path $materials 'README.md') -Encoding UTF8
Get-Content -LiteralPath (Join-Path $materials 'TASK.md') -Encoding UTF8
```

Открой `$materials/categories-reference.html` в браузере. Сделай эталонные снимки при 1536×1024, 390×844, с открытыми фильтрами и с `?stress=1`. Если в рабочей среде уже установлен Python Playwright, исходный `python -X utf8 check_reference.py` из распакованной папки создаёт PNG автоматически. Иначе используй существующий Browser/Playwright проекта; не устанавливай новые зависимости приложения ради документации. Проверщик пишет PNG и новый reference-checks.json рядом с собой, поэтому распаковывать лучше вне Git.

Ссылки TASK.md на готовые PNG означают эти воспроизведённые эталоны. `categories-before-user.png` отсутствует: вместо него зафиксируй настоящий before текущей CMS. Исторический reference-checks.json не означает успешных новых тестов.

## Приёмка и автономность

Сначала прочитай актуальные AGENTS.md, CONTRACTS.md, DESIGN-SYSTEM.md и A1-INTEGRATION.md. Выполняй TASK.md в пределах одного UI-исправления. Сохрани серверную фильтрацию/пагинацию, CAS и ограничения прав; родитель в карточке остаётся readonly, удаления категорий нет.

До merge обязательны функциональная проверка и сравнение реальных скриншотов кандидата в Directus с этим образцом на desktop/mobile. Макет не доказывает работающую CMS. Если реальный UI не проверен — VISUAL NOT VERIFIED, PR draft, без merge. Общий локальный gate: `node scripts/verify-local.mjs`; не создавать GitHub Actions и не обходить проверки.

После зелёных обязательных проверок автономно выполнить push, review и merge. После проверки main удалить только собственную объединённую временную ветку и чистый worktree. Ветка материалов — отдельная задача: не удалять её до подтверждения, что содержимое сохранено в main и связанный PR закрыт. Чужую работу не трогать.

Deploy — только в подтверждённое собственное окружение с безопасным обновлением и rollback; иначе DEPLOY BLOCKED. Новую инфраструктуру здесь не создавать.

Все ТЗ, промпты и финальный самодостаточный HANDOFF — в копируемых блоках. В HANDOFF указать SHA/PR, проверки, фактические before/after, визуальное review, способ загрузки bundle, deploy/blocker и cleanup. После A1-UI-FIX остановиться.

## Статус публикации

Эта публикация добавляет только материалы задания. Код CMS, API, schema, permissions, storefront и окружения не изменяются. Целостность ZIP и соответствие исходных файлов проверяются отдельно; общий локальный gate CMS и новая runtime/визуальная приёмка этой публикацией не заявляются.
