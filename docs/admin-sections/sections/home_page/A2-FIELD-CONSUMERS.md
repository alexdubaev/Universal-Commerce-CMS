# A2 field consumers — verified baseline

> Historical baseline only. The current A2-UX-FIX matrix for `5b7879b` (2026-10-23), including working header search, SEO projections and installed child interfaces, is [FIELD-CONSUMERS-CURRENT.md](ux-proposal/FIELD-CONSUMERS-CURRENT.md). This older report is retained for provenance, not current runtime evidence.

Baseline: `c594fd9ac874cd38cfb71abeedf932cfd785de55`, inspected 2026-10-18.
Sources: `storefront/lib/content.ts` (`getCmsHome`, separate sections read),
`storefront/app/page.tsx`, `storefront/components/CmsPageRenderer.tsx`.
This is source evidence, not a production publication or cache-invalidation test.

Live own Directus 12.1.1 read-only preflight: all 34 documented field names,
types and required flags match. Metadata also contains five presentation groups.
Singleton response is an object under `data`; `updated_at: null` is legitimate.
Native `hero_image` uses `file-image`; native `seo` uses `seo-interface`.
Live `og_image` uses `select-dropdown-m2o`, whereas the static snapshot declares
`file-image`. Preserve actual metadata and record this native-picker difference;
no schema or interface configuration change is authorized.

| Field | Directus / A2 mode | API reader | Current Next.js effect |
| --- | --- | --- | --- |
| `id` | readonly UUID | home identity | joins separate sections |
| `status` | readonly status | home query | published selects CMS home; otherwise fallback |
| `source_page` | readonly relation | not requested | no direct home rendering |
| `h1` | editable required | home query | metadata fallback, not hero H1 |
| `hero_title` | editable required | home query | hero H1, metadata fallback |
| `hero_text` | editable required | home query | hero description, metadata fallback |
| `hero_image` | native file, required | home query | hero image and fallback OG image |
| `hero_image_alt` | editable required | home query | hero image alt |
| `hero_primary_button_text` | editable | home query | primary action label when valid URL exists |
| `hero_primary_button_url` | editable | home query | validated hero primary action URL |
| `hero_secondary_button_text` | editable | home query | secondary action label when valid URL exists |
| `hero_secondary_button_url` | editable | home query | validated hero secondary action URL |
| `hero_search_label` | editable required | home adapter | not passed to public search |
| `hero_search_placeholder` | editable required | home adapter | not passed to public search |
| `hero_search_button_text` | editable required | home adapter | not passed to public search |
| `hero_bulk_prompt` | editable required | not requested | stored; no demonstrated home effect |
| `hero_bulk_link_text` | editable required | not requested | stored; no demonstrated home effect |
| `hero_bulk_link_url` | editable required | not requested | stored; no demonstrated home effect |
| `hero_excel_link_text` | editable required | not requested | stored; no demonstrated home effect |
| `hero_excel_link_url` | editable required | not requested | stored; no demonstrated home effect |
| `hero_photo_link_text` | editable required | not requested | stored; no demonstrated home effect |
| `hero_photo_link_url` | editable required | not requested | stored; no demonstrated home effect |
| `seo_title` | editable scalar fallback | home query | document metadata title |
| `seo_description` | editable scalar fallback | home query | document metadata description |
| `canonical_url` | editable | home query | canonical after existing URL validation |
| `og_title` | editable | not requested | stored; current OG derives from hero/metadata |
| `og_description` | editable | not requested | stored; current OG derives from hero/metadata |
| `og_image` | native relation | not requested | stored; current OG derives from hero image |
| `is_indexable` | editable | home query | robots indexability |
| `seo` | native SEO JSON | not directly requested | hook-projected scalars can affect metadata; opaque JSON preserved |
| `sections` | alias, never parent payload | separate published child query | supported visible child blocks through CmsPageRenderer |
| `translations` | native JSON | not requested | stored; no direct home rendering |
| `created_at` | readonly | not requested | no public effect |
| `updated_at` | readonly, parent CAS baseline | not requested | concurrency/version boundary |

The public home also contains code-defined blocks and other collection readers.
A2 does not make those blocks editable or promise every section type is rendered.
Ordinary CAS changes the current row: edits to an already published record may be
read by the storefront. Saving does not promote a version or save child sections.
Versions, signed preview and promotion require their own runtime proof before an
action is enabled. No production target is inferred from this source inspection.
