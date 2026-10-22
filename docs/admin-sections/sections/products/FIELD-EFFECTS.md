# Product fields and current storefront effects

Read-only source trace at base `97c3339178f1febee5ed3c23f3b2e6dd2417f5c8`, 22 October 2026. This is a contract map, not an installed storefront acceptance or authorization to change the storefront/backend.

| Field | Hook / projection | Storefront query → component | Actual effect / limit |
|---|---|---|---|
| `cta_text` | No projection into a consumed product field | Omitted by `productFields` and `mapProduct` in `storefront/lib/catalog.ts`; `ProductCard` / product detail use `AddToRequest` | Product-specific button text is not connected in this storefront. Preserve stored data; do not promise a button change. |
| `is_featured` | No projection into query/sort fields | Omitted by product adapter; catalog sorting uses popularity/price/title | No confirmed featured-product effect. |
| `show_on_homepage` | No projection into consumed home product fields | Omitted by product adapter | No confirmed home-placement effect from this product toggle. |
| `seo_text` | Not an SEO scalar/JSON synchronization key | Omitted by product adapter; product page renders other description fields | No product text effect. Other CMS page consumers using a same-named field do not establish a product effect. |
| `og_image` | `synchronizeSeoPayload` mirrors it into `seo.og_image` | Product adapter does not read either; product page `generateMetadata` uses `main_image` | Projection exists, but this storefront still takes the product social image from its main image. |
| product `sort_order` | No projection into product popularity/title | Omitted by product fields / `directusSort` | Does not set catalog product order. Child images/documents/specifications use their own `sort_order`. Category sorting is separate. |
| `documents` / `document_items` | Hooks mark `media_sources.documents` as legacy/children | `getProductDetail` reads published `product_documents`, ordered by child `sort_order`; product page renders document links | Published child documents are connected. The legacy product UUID array is preserved but is not read by this storefront adapter. Do not silently convert one model to the other. |
| `specifications` / `specification_items` | Hooks mark legacy/children source mode | `mapProduct` preserves legacy object; `getProductDetail` reads published child rows; product page prefers child rows and falls back to legacy | Both supported presentation sources matter. Preserve unknown data/source mode and do not overwrite unread children. |

Primary sources: `directus/extensions/commerce-integrity/src/index.js` (`synchronizeSeoPayload`, product and child hooks), `storefront/lib/catalog.ts` (`mapProduct`, `productFields`, `directusSort`, `getProductDetail`), `storefront/components/ProductCard.tsx`, `storefront/components/AddToRequest.tsx`, `storefront/app/product/[slug]/page.tsx` (`generateMetadata` and details).

## Creation response attribution

Existing product creation uses native `POST /items/products`. The current request has no client-known record ID or idempotency key. An entirely lost response cannot be attributed to a record by SKU/slug similarity. UI work can retain the entered values and block repeat creation; deterministic lost-create recovery requires a separately authorized contract. No backend endpoint, schema, role or idempotency change is included here.
