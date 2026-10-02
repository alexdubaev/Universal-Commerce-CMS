# Исследование и источники
Снимок 2026-10-02, read-only source: D:/codex/deere-shop-worktrees/test-universal-cms, HEAD4b241f0. Основная рабочая папка main не является актуальной реализацией editor; поэтому она не использовалась как baseline.
Полные статические schema/studio metadata в research/schema.json и research/studio.json; SHA256 источников в source-hashes.json. Это кодовая инвентаризация, не live экспорт БД.

## Проверенные материалы
- Архив universal-cms-product-editor-handoff-2026-10-02.zip: HANDOFF.md, START-HERE.txt; архивные инструкции — контекст старого редактора, не разрешение менять новые protected areas.
- docs/decisions/ADR-002-scope-locked-changes-and-content-only-releases.md — scope-lock.
- directus/schema/blueprint.mjs — реальный перечень коллекций и полей.
- directus/schema/studio-blueprint.mjs — шесть групп, 14 видимых коллекций, native forms/readonly.
- directus/studio/workspace-blueprint.mjs — existing queues/bookmarks.
- directus/extensions/deere-shop-product-editor/{README.md,src/index.js,src/editor-state.mjs,test/editor-state.test.mjs} — product precedent,16tests previoustask.
- commerce-api/src/{mutations.mjs,versions.mjs,index.js} — current guarded allowlist + routes.
- commerce-integrity/src/index.js — protected request identity + derived codes.
- seo-worker/src/directus-client.mjs — claim/draft/release; не API публикации.
- frontend/src/lib/directus/{content.ts,catalog.ts,product-media.ts,articles.ts}, frontend/src/app/HomePageView.tsx, components/articles/ArticleContent.tsx, app/api/revalidate/route.ts — READ ONLY consumers.
- Официальная документация [Directus Modules](https://directus.com/docs/guides/extensions/app-extensions/modules), [Composables](https://directus.com/docs/guides/extensions/app-extensions/composables), [Items](https://directus.com/docs/api/items).

## Что уже существует
Custom module товаров и native экраны остальных коллекций. Полноценного universal editor module пока нет. Content version safety для pages/home_page, legacy/child media fallback товаров, SEO plugin и Flexible Editor статей — существующие совместимости.
Новые экраны не требуют новых коллекций. Старый AGENTS planning list не отражает текущий actual schema: нет standalone advantages/banners/testimonials/seo_text_blocks.

### Условная изоляция версий страниц

В HEAD blueprint и сгенерированном schema snapshot у `pages` и `home_page` нет физических полей `sections_source` и `sections_snapshot`; поиск по schema/release migrations также не нашёл их объявления. `sections_capture` встречается только как служебная метаинформация в delta `directus_versions`, а не как поле коллекции. `commerce-integrity` и `commerce-api` содержат условные ветви для этих ключей, но статические материалы не доказывают, что колонки установлены в live БД. До проверки live schema не включать эти поля в формы или payload.

Guarded `save/promote` сравнивает и блокирует устаревшее состояние записи `pages`/`home_page`. Секции `page_sections` остаются отдельными дочерними записями; их хуки обновляют `updated_at` родителя, но это не означает атомарную публикацию/изоляцию полного набора дочерних строк для публичного чтения. Сравнение снимка дочерних секций применяется только в условной ветви начального переключения родителя в snapshot-режим. Считайте поддержку режима и deployed-взаимодействие с frontend неизвестными до проверки live schema, permissions и read path.

## Поддержка секций
Schema steps преобразуется в process frontend. Реально распознаваемые HomePageView типы: categories, featured_products, process(steps), company_trust, recent_supplies, articles, faq, contacts; hero имеет отдельную логику/fallback. Другие schema choices не обещают новый renderer. Существующие данные сохранять; у неподдержанного типа показывать ограничение, не удалять и не менять storefront ради макета.

## Пробелы и риски
1. Live database contents/permissions/plugins не выгружались; проверить при запуске.
2. CAS пока отсутствует у девяти коллекций, перечисленных CONTRACTS; native edit остаётся существующим поведением, новые безопасные UI actions зависят от G1.
3. canonical_key analog create derivation не найден; G2.
4. Приоритет JSON/scalar SEO и native plugins проверить на fixture; запрещена миграция формата.
5. Parent/child операции не объявлять одной атомарной транзакцией.
6. Скриншоты товаров взяты из завершённого предыдущего smoke. В этой задаче editor tests/runtime не запускались, production не трогался.

