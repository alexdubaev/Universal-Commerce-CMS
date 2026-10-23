# Category field consumers — A1-UX #17

Source baseline: ca03a0bb619b55e24b0084e4c84950c587b9ee61. This map distinguishes confirmed source consumers from runtime observations; the latter are recorded in ACCEPTANCE/HANDOFF after verification.

| Category field | Hook / projection | Public request and component | Effect / approved UI |
|---|---|---|---|
| title, slug | ordinary category values | `storefront/lib/catalog.ts:getCategories/mapCategory`, homepage, Header/catalog/about links, category breadcrumbs and route | Category name/link. Public route `/category/{slug}`. Existing slug never follows an edited title automatically. |
| status | publication filter | getCategories uses `status=published`; category lookup depends on it | Visibility changes through explicit publication intent, applied by Save. New category remains draft. Unknown status is retained. |
| parent | relation metadata | admin list/readonly name; public category projection does not include parent | Explains catalogue position in CMS. Readonly: no transactional server cycle guard; no movement introduced. |
| h1 | ordinary scalar | category page H1 and metadata fallback | «Заголовок на странице», falls back to category title. |
| intro | ordinary scalar | category page introduction | «Текст в начале страницы»; falls back to description if empty. |
| description | ordinary scalar | category page intro fallback; metadata description fallback | «Краткое описание». Intro takes precedence on the visible category page. |
| sort_order | server sort, not a projection into rendered markup | public category request sorts `sort_order,title`; homepage takes first eight categories | Affects order of published category links; no direct homepage toggle. Lower number first. |
| seo_title, seo_description | commerce-integrity synchronizeSeoPayload merges scalar edits into existing `seo` title/meta_description, retaining unrelated keys | public projection → category generateMetadata | One primary input each, existing A0 preview retained; full readable record refreshed after save. |
| is_indexable | SEO hook synchronizes inverse `seo.no_index` | category robots metadata and sitemap inclusion | Controls index instruction and sitemap membership, not publication or guaranteed search-engine inclusion. |
| image, image_alt | ordinary media relation/scalar; asset allowlist recognizes published category image | image is fetched by getCategories/product-category projection, but current category/home/header renderers do not render it; alt is not selected | Keep image selection and description with exact limitation: current site does not show category images. Unlink never deletes the file. |
| show_on_homepage | no hook consumer found | not selected by getCategories; homepage uses first eight published categories regardless of flag | Removed from normal form/list/filter/sort; saved value readonly, preserved. |
| icon, icon_alt | published-category asset-access helper recognizes icon references; no renderer | not selected by category request or rendered | Readonly saved-value summary; no claim that asset authorization renders the icon. |
| og_image | SEO hook projects between scalar and `seo.og_image`; asset-access helper recognizes it | not in getCategories projection; category generateMetadata emits no OG-image entry | Readonly summary; hook projection alone does not create a public OG image. Preserve value/unknown SEO. |
| seo_text, selection_guide, internal_links, faq | no category hook consumer found | not projected or rendered for categories; similarly named page/section fields belong to other consumers | Readonly human summaries outside ordinary content editing. No new storefront blocks. |
| redirect_target | no active category redirect hook found | category page does not redirect; canonical route is `/category/{slug}` | Readonly saved value with accurate limitation. No promise of active redirect and no `/catalog/{slug}` self-route check in normal editing. |
| translations | no category public consumer found | not in public projection/renderers | Readonly human summary, no JSON editor or clearing. |
| id, created_at, updated_at | identity / CAS version | admin state expected snapshot, server guarded writes | Technical identity remains internal; human timestamps may be shown, UUID is not ordinary form copy. |

## Source chain checked

- `directus/extensions/commerce-integrity/src/index.js`: SEO synchronization for categories (title, description, OG image, indexability); no consumer for the other inactive settings above.
- `directus/extensions/commerce-api/src/storefront.mjs`: category field allowlist, publication boundary, fixed public order and bounded asset authorization.
- `storefront/lib/catalog.ts`: category mapping, explicit published query, limit 200, sort `sort_order,title`, 300-second revalidation; getCategory searches this returned set.
- `storefront/app/category/[slug]/page.tsx`: visible heading/intro/products, metadata title/description/canonical/robots.
- `storefront/app/page.tsx`: first eight published category title links, no homepage flag or category image renderer.
- Header/catalog/about/sitemap consumers: category links/order/indexability; no alternative inactive-field renderer found.

## Limits and data safety

The initial local instance has 21 categories, below the existing 200-row public query bound. More than 200 categories can make getCategory miss a published category; A1 does not hide or repair that storefront/API limitation. Cache revalidation also means an acknowledged CMS write does not promise immediate public refresh.

Hidden/readonly is a manager-flow choice, not a server permission grant or new field allowlist. Keep full readable baselines and unknown values; only dirty, permitted active fields enter guarded category changes. Existing SEO readback must not erase local input when refresh fails. No schema, hook, public route or permissions change is included.
