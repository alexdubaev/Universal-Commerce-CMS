# СМ ТЕХНО: UX и статьи — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Independent tasks have exclusive file ownership; the orchestrator integrates and verifies the final candidate.

**Goal:** Выполнить пользовательское ТЗ на существующей светлой индустриальной витрине, сохранив поиск, RFQ и оригинальный первый экран.

**Architecture:** Сохранить представление feat/storefront-light-ux (cbcba3c) поверх актуального origin/main (991a352), включая существующие hooks и локальный verification gate. Использовать существующие Directus articles и канонический HTML content; публичное чтение ограничить опубликованными материалами с наступившей датой. Все реальные runtime, данные, инфраструктура и отправка заявок закрыты для изменений.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / CSS / Directus / Node tests / Vitest / Chromium Playwright.

**Spec:** ../specs/2026-10-09-smtechno-ux-tz.md

## Global Constraints

- Сохранить жёлто-чёрно-белую палитру, логотип, экскаватор, композицию hero, Oswald и прямоугольную геометрию.
- Не менять ключ smtechno-request, payload, idempotency, подтверждение отправленных количеств, маршруты товаров и семантику поиска/фильтров.
- Не публиковать сайт; реальные заявки и внешние сообщения не отправлять; Docker/config/secrets/roles/runtime остаются закрыты.
- Исключения data/API scope только для публичных статей и требуемого UX черновика формы; существующая schema не требует изменения.
- Бизнес-модель доказана существующим RFQ API: использовать «заявка», не обещать полноценную покупку.
- Проверить 1440, 1024, 768, 390 и 360px; screenshots outside repository.
- Сохранить local-only policy: два коротких критических E2E + scoped ручная browser QA, без hosted CI.

## Review Focus

- Длинные названия/SKU и mixed image states должны переноситься без переполнения; clipboard errors должны сообщаться.
- Draft, future, archived и снятые с публикации статьи/обложки недоступны через native/gateway/public routes/sitemap.
- HTML статей не должен выполнять scripts/events или разрешать опасные URL; malformed input безопасен.
- Отказ отправки сохраняет форму/позиции/key; успех очищает только подтверждённые позиции и собственный черновик вкладки.
- Нормализованный артикул, active filters и Back/Forward сохраняют исходную семантику.

## Task 0: Правильная база и исходные экраны

- [x] Создать отдельный worktree /workspace/smtechno-ux; перенести cbcba3c поверх main, разрешить UI/hooks конфликты.
- [x] Проверить backend 98 / frontend 18 / audit / build / два Chromium E2E.
- [x] Запустить explicit mock preview на 127.0.0.1:3002 и сохранить before home/catalog/product/request на 1440 и 390px.

## Task 1: Shell, главная и visual tokens

**Owner files:** storefront/app/page.tsx, app/theme.css, app/globals.css, components/Header.tsx, Footer.tsx, SearchBox.tsx, MotionEnhancements.tsx, new components/SearchFocusLink.tsx, styles/home-ux.css.
**Interfaces:** ArticlesSection is exported from components/articles/ArticlesSection.tsx; categories come from getCategories; RFQ bulk links use /request?import=1.

- [x] Сохранить hero photo/composition; H1 «Запчасти для спецтехники» с пробелами между строками, заданный подзаголовок.
- [x] Один заметный header search, быстрый «По артикулу» фокусирует input; mailto отдельно от tel; mobile menu Escape/focus.
- [x] Реальные 6–8 категорий → реальные routes; бренды с очевидным scroll и видимой ссылкой /brands.
- [x] До шести продуктов «Запчасти из каталога», три шага «Как заказать», до трёх опубликованных статей.
- [x] Согласовать typography/spacing/focus; убрать скрытие смыслового контента анимацией; компактный mobile footer.
- [x] Browser QA desktop/mobile и отсутствие overflow; без visual snapshot tests.

## Task 2: Каталог и товары

**Owner files:** components/ProductCard.tsx, ProductGallery.tsx, new CopyArticle.tsx, app/catalog/page.tsx, app/catalog/loading.tsx, app/product/[slug]/page.tsx, styles/catalog-ux.css.
**Interfaces:** Preserve Product/CatalogQuery fields and all existing query keys. Do not edit AddToRequest (owned by Task 3).

- [x] Компактная no-photo presentation; clear title/brand/SKU/status/price/action hierarchy; copy SKU with status/error.
- [x] Сохранить horizontal mobile catalog cards; 44px touch actions, wrapping long SKUs, text 13–16px.
- [x] «Применить» sorting, loading state, no-result link /request?import=1&article=encodedQuery.
- [x] Предметный product H1; маленький missing-image panel; русские типы кодов и связей по schema.
- [x] Отдельные аналоги/другие связи и дополнительные номера; related исключает IDs текущего товара и показанных связей.
- [x] Browser QA search normalized/hyphen, filters, long data, missing/present photos via synthetic fixtures only.

## Task 3: RFQ и формы

**Owner files:** app/request/page.tsx, components/RequestClient.tsx, BulkRequestImport.tsx, QuickLeadForm.tsx, AddToRequest.tsx, hooks/useRequestForm.ts, new hooks/useFormDraft.ts, hooks/useBulkRequestImport.ts, lib/request-import.ts, tests/request-import.test.ts, styles/request-ux.css.
**Interfaces:** /request?import=1 opens bulk section; article parameter prefills manual textarea without auto-adding; useRequestForm retains payload/idempotency and success-only cleanup.

- [x] Терминология «заявка», empty paths catalog/import, компактное пустое состояние; сохранять pricing lookup без заявления окончательной цены.
- [x] Добавить autocomplete/required labels/field errors/live feedback; no data clearing on failure.
- [x] sessionStorage form draft within tab, очистка after acknowledged success; no new permanent request key.
- [x] Сохранить import example/template/limits/upload behavior; добавить structured diagnostics по проблемным строкам без изменения parsing/merge semantics.
- [x] Browser checks intercept /api/lead for error→retry→success; no real submission.

## Task 4: Public articles backend / draft workflow

**Owner files:** commerce-api/src/storefront.mjs + dist mirror, directus/test/storefront-gateway.test.mjs, storefront/lib/directus.ts and lib/assets.ts article-only additions, directus/content/import-article-drafts.mjs + meaningful test, profiles/smtechno/article-drafts.json, docs/content/articles.md.
**Interfaces:** Public article fields: id,status,title,slug,excerpt,content,cover_image,image_alt,published_at,author,seo_title,seo_description,og_image,related_categories,related_products. Fixed sorts -published_at,slug / slug; normal pagination 1–24, narrow sitemap query ≤500. Frontend filter status=published,published_at._lte ISO; backend pins server publication condition independently.

- [x] RED handler integrations for published/draft/future/gateway escalation and asset visibility; run to confirm failures.
- [x] Implement exact allowlists/publication/reference gating; preserve every existing product gate and src/dist parity.
- [x] Preserve schema. Offline three honest draft texts have no invented author/date; importer dry-run default, own instance explicit opt-in and supplied preliminary date for existing NOT NULL schema, always status=draft, never overwrite existing slug.
- [x] Document native Studio editing canonical content, actual publication date/status, author/alt/SEO, planned date caveat, no runtime import performed.
- [x] Run backend integrations and report RED→GREEN evidence.

## Task 5: Public article adapter/pages/SEO

**Owner files:** lib/articles.ts, app/articles/page.tsx, app/articles/[slug]/page.tsx, components/articles/* + articles.css, app/sitemaps/[name]/route.ts, tests/articles.integration.test.ts. No Header/home changes.
**Interfaces:** getPublishedArticles({page?,limit?}) → {items,total,page,limit}; getPublishedArticle(slug) → Article|null; getArticlesForSitemap() → {slug,published_at}[]; ArticlesSection async renders max3, hides empty. Article type uses backend fields. Images through /api/assets/UUID; metadata uses absoluteUrl/getSiteUrl. Mock fixtures are labelled synthetic; actual three drafts never become published fixtures.

- [x] RED integration checks adapters/list/detail/sitemap/sanitized content and fail-closed live errors.
- [x] Safe bounded HTML→React allowlisted renderer (no raw HTML injection): h2–h4, prose/list/table/img/link; unsafe nodes/attributes removed, safe URLs only, TOC stable IDs, one page H1.
- [x] Published list with pagination; detail breadcrumb/intro/publication/known author/TOC/useful links/related material and unobtrusive RFQ link.
- [x] Article + BreadcrumbList JSON-LD, canonical/OG, real persistent publication date, published-only sitemap; reserve articles from CMS page slug list.
- [x] Render an explicitly synthetic published mock fixture for browser QA, with one private draft/future fixture to verify 404; no site claims.

## Task 6: Integration, static content and acceptance

**Owner files:** orchestrator app/layout.tsx CSS imports, app/robots.ts (allow request crawl to read noindex), lib/seo.ts if needed, about/delivery/payment/contacts page.tsx; docs/content/owner-data-needed.md; e2e/storefront.spec.ts only label/critical flow alignment. Footer contacts/legal label remains in Task 1 scope.

- [x] Correct «Доставка по России», remove CMS implementation copy, concrete available company facts only; no invented contacts or terms.
- [x] Home canonical/OG and single base URL; RFQ robots agreement; preserve Product/Offer/BreadcrumbList.
- [x] Independent scoped review for each task and whole diff; resolve all blocking findings.
- [x] Browser QA five widths + zoom, keyboard/menu/search/filter/RFQ/import/articles/drafts/metadata/sitemap; errors logged, screenshot after gallery saved outside repo.
- Final workflow: node scripts/verify-local.mjs final candidate; diff-check and article src/dist parity; commit checked changes. Result is recorded in the delivered verification report.
- Final workflow: reviewed branch PR and default authorized main integration under root AGENTS; no site deployment. Deliver screenshots, commands, drafts/instructions and unavailable owner facts/runtime verification.

## Scoped review acceptance

Tasks 1–5 and whole-change review PASS; findings on relation grouping, SKU token matching, late-success draft cleanup, article pagination, E2E locators, noindex/crawl and conditional contacts/legal labels addressed. Final verification and integration evidence are delivered in the task report after the remaining workflow steps. Next-generated next-env.d.ts is retained; the dev-generated AGENTS.md addition is excluded.
