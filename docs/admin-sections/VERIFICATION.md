# Проверка материалов в destination

Автономная проверка пакета запускается из корня проекта:

```powershell
node docs/admin-sections/research/verify-package.mjs
```

Она проверяет JSON-файлы, 14 секционных пакетов, совместимость полей/вкладок/fixtures с сохранёнными static blueprint и mockup data, embedded DATA в HTML макете, синтаксис его скрипта, относительные Markdown-ссылки и целевые файлы mockup links. Она не читает исходный checkout и не подключается к Directus.

`research/schema.json`, `research/studio.json` и 42/76-счётчики в старых заметках происходят из исторического пакета, подготовленного 2026-10-02. Скопированные документы получили операционные обновления, поэтому manifest этого каталога пересчитан отдельно. Для проверки применяйте manifest и verifier из destination-копии.

Проверка в браузере и live schema/permission не входит в этот offline verifier. Её следует выполнять отдельно в рамках будущей согласованной реализации.
