> Historical Wave 1 audit. Its statuses and test counts describe discovery before implementation. Current results and resolved findings are in [11-FINAL-HANDOFF.md](11-FINAL-HANDOFF.md) and [09-FINDINGS.md](09-FINDINGS.md).

# Directus map for synthetic storefront acceptance

Scope: map the checked-in schema, commerce endpoints, integrity hooks, and storefront reads needed to create and verify synthetic acceptance records. This report does not authorize schema, access, database, or runtime changes. The source Deereshop environment and its data remain excluded.

## Storefront read contract

| Storefront read | Directus fields and conditions |
| --- | --- |
| Site settings (`content.ts`) | singleton `site_settings`; reads `company_name`, `phone`, `email`, CTA, address/city/hours/region and legal/footer fields. Schema requires `company_name`, `phone`, `email`. |
| Home (`content.ts`) | singleton `home_page`, `status=published`; reads hero fields and `canonical_url`. Schema requires `source_page` -> `pages`, `h1`, hero title/text/image/alt and search/bulk/Excel/photo labels and URLs. `hero_image` is a Directus file UUID. |
| Pages (`content.ts`) | `pages`, filters `status=published` and `slug`; reads title, slug, page_type, h1 and SEO fields. Required: title, unique slug, page_type, h1. Page types include `standard`, `catalog`, `about`, `delivery`, `contacts`, `privacy_policy`, `thank_you`, `articles`, `home`. |
| Page sections (`content.ts`) | `page_sections`, filters published and visible plus either `page` or `home_page`; sorts `sort_order`. Exactly one owner is additionally enforced by SQL CHECK. `section_type` is required. |
| Navigation (`content.ts`) | `navigation_items`, filters published, visible, requested `location`, root (`parent` null); sorts `sort_order`. Required label, URL, location; locations header/footer/legal. |
| Category list/detail (`catalog.ts`) | `categories`, published; reads slug/title/descriptions/SEO/image. Required unique slug and title. |
| Product list/search (`catalog.ts`) | `products`, published; reads ID, slug/title/SKU/MPN/brand, price/currency/price status/availability/part type/main image/specifications/delivery status/SEO/updated time, and category fields. Filters use category slug, availability status, part type and brand. Search route is `/commerce/search`; normalized SKU/MPN and active `product_codes` supply candidates. |
| Product detail (`catalog.ts`) | Same product fields, then children by `product`: active `product_codes`; published `product_images`, `product_documents`, `product_specifications`; `products_analogs` by either endpoint. Opposite product must not be draft or archived. |

## Schema and integrity facts

- IDs in content collections are required UUID primary keys, with Directus UUID defaults. The shared content status field is required, indexed, defaults to `draft`, and permits `draft`, `published`, `archived`; synthetic acceptance records must be explicitly published only when exercising public reads.
- Products require title, unique slug, SKU, currency (default RUB), price_status (fixed/on_request/hidden), and availability_status (in_stock/on_request/out_of_stock). Price and category are optional. SKU is indexed. Product status is inherited. Published list reads require `status=published`; order submission additionally requires `price_status=fixed`, a valid profile currency, and matching current price.
- `brand_key` is derived from NFKC-normalized, trimmed, whitespace-collapsed lowercase brand. `sku_normalized`/`mpn_normalized` uppercase and remove non-ASCII alphanumeric runs. `identity_key` is SHA-256 of JSON `[brand_key, sku_normalized]`; create hooks require nonblank brand and SKU and schema marks identity key unique. No brand aliases are guessed. See `commerce-integrity/src/product-identity.mjs` and `src/index.js`.
- `product_codes` requires product UUID, code, normalized_code, code_type, source_name. Code types: oem/mpn/supplier/previous/superseded/external/barcode. Normalization is uppercase alphanumeric. `is_active` defaults true; search only includes active codes. A physical composite unique constraint is `(product, code_type, normalized_code, source_name)`; duplicated normalized codes for the same tuple cannot be used as fixtures. The code lookup is optional in `/commerce/search` and failure degrades to normalized product search.
- `products_analogs` requires two product UUIDs, relation_type, canonical_key and source_name. Types: analog/oem_cross/compatible/superseded_by. Symmetric types use sorted product UUIDs in canonical key; `superseded_by` preserves direction. SQL enforces no self-edge and unique canonical_key. Neither aliases nor the storefront create the edge key; fixtures need a correctly derived key. Opposite endpoint must be published to appear in detail results.
- Child media rows require product UUID and image/file UUID; specifications require product/name/value; children have shared status and `sort_order`. Integrity hooks require an active transaction for child create/update/delete and lock/update the parent media-source marker. Direct single-item REST child creation may be rejected; use an already approved transactional path only after confirming its behavior. Legacy product JSON gallery/specifications/documents remain valid independent reads; R7C aliases are declarations and are not the current editable JSON interface.
- Page snapshot writes validate section types, unique string IDs, visibility, order, and at most 500 published blocks / 1 MiB. Child `page_sections` mutation also requires a transaction. Do not use ordinary unguarded REST mutation for fixture children without evidence it enters a transaction.
- `leads` require `page_url`; API further requires a UUID request key, name, page URL and phone or email. API forces `status=new`, stores fingerprint and attachments, and permits request items only when `site_settings.commerce_profile.features.parts_request===true`. `orders` similarly force `status=new`, require profile cart enabled/currency, and validate products/prices. These write routes need authenticated accountability.

## Profile and neutral prerequisite records

The checked-in neutral profile content (`profiles/commerce/demo-content.mjs`) explicitly labels records synthetic and draft, and gives `site_settings` neutral test contact values. Its `commerce_profile` has `site_id=synthetic-demo`, `currency=RUB`, and cart/parts-request features false. This is suitable as evidence for the profile shape, but its draft product is not storefront-readable; do not silently flip it to published as an acceptance fixture. The API derives a private attachment folder from `site_id` if testing attachment submissions.

Minimum reads have distinct prerequisite records: `site_settings` must exist for settings; a published product (plus published category if category filtering/detail is being tested) for catalog; published children and code/edge rows for product detail; a published page and its sections for page content. A published `home_page` needs a `pages` source and a real Directus file UUID because required fields include `source_page` and `hero_image`. No actual file fixture has been established here. Required `site_settings` company/contact fields can use neutral synthetic values; do not invent legal/company facts. Enabling order/parts-request behavior changes profile capabilities and is outside this schema map.

## Fixture blockers to resolve before writing

Update after the audit: on 2026-10-07 the authorized local probe created an owned synthetic product with nested `specification_items` through native `POST /items/products`. Read-back confirmed one correctly linked specification. Both IDs were immediately recorded in the ignored ownership manifest. This proves the transaction-aware nested-create route for that child; it does not establish standalone child update/delete safety. Full media/section variants still require their own apply/read-back evidence.

A subsequent owned probe created a new synthetic page and one published section through native `POST /items/page_sections`; REST read-back confirmed the page relation and status. Thus standalone section creation is transaction-aware on the installed runtime despite the missing `pages.sections` alias. The initial possible-create blocker below is superseded by this runtime evidence. No schema, hooks, direct SQL or original content were changed; update/delete behavior still needs separate verification.

1. Confirm the authorized insertion route can create/update synthetic parent records with the current service identity. A create hook derives identity fields, but the `/commerce/mutations/:collection/:id` guarded route is an update/delete contract for an existing UUID and does not expose create. Avoid Administrator as storefront identity.
2. For product_codes and products_analogs, determine whether their parent/derived fields can be created through a supported transaction-aware route. Codes require normalized_code and a unique composite; analogs require canonical_key matching edge type/direction and unique physical constraint. Integrity hooks normalize codes but do not derive analog canonical keys.
3. For product_images/specifications/documents/page_sections, integrity requires `database.isTransaction===true`; identify an already supported atomic path for creation or keep these child-based scenarios out of acceptance. Direct REST writes are not established as safe.
4. The cleanest no-file product fixture can omit image fields and test catalog/detail without child images. Full home-page acceptance is blocked until a synthetic file can be uploaded through the local stack and its resulting UUID referenced. No real media may be copied.
5. Product identity requires a unique, nonempty synthetic brand + SKU pair; each acceptance run should use a fresh slug/SKU identity or explicitly query and reuse the same synthetic record. UUID IDs must be valid UUIDs. Do not invent a direct SQL bypass to meet these constraints.

## Evidence paths

- Schema declarations and required/index/choice/relation metadata: `directus/schema/blueprint.mjs`.
- Product identity and code normalization, transactional child guards, SEO and section hooks: `directus/extensions/commerce-integrity/src/index.js`, `product-identity.mjs`, `section-snapshot.mjs`.
- Search endpoint query and optional code lookup: `directus/extensions/commerce-api/src/index.js`.
- Guarded mutation contract: `directus/extensions/commerce-api/src/mutations.mjs`.
- Atomic lead/order validation, profile gates and persisted status: `directus/extensions/commerce-api/src/leads.mjs`, `orders.mjs`.
- Storefront field names/filters: `storefront/lib/catalog.ts`, `storefront/lib/content.ts`.
- Local neutral profile: `profiles/commerce/demo-content.mjs`.
