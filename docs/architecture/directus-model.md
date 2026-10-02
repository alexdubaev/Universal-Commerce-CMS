# Directus model and extension notes

Directus is pinned to 12.1.1 and PostgreSQL 17. `schema/blueprint.mjs` is the canonical collection and relation model; it imports only the active profile's seed records. Schema application creates missing collections, fields, and relations without copying instance IDs. The included commerce profile seeds neutral `site_settings`, a standard page, and a product as synthetic drafts. The profile settings step applies its `ru-RU` locale, neutral project branding, and a visible product-editor module entry while preserving the existing Directus module bar.

The model includes site settings, pages and page sections, navigation, catalog categories and products, product images/specifications/documents/analogs/codes, articles and editor nodes, FAQs, leads and lead attachments, orders and order items, SEO redirects/work items, recent supplies, and contact/forms content. Collection fields, choices, relationships, required flags, and Studio metadata are declared in the blueprints.

## Extension dependencies

| Extension | Role | Distribution note |
| --- | --- | --- |
| `commerce-api` | `/commerce` search, lead/order APIs, and guarded mutations/version endpoints | Project source and built output are both included |
| `commerce-integrity` | Product identity and page-section integrity hooks | Project source and built output are both included |
| `deere-shop-product-editor` | Product editing route and save-state behavior | Historical package/interface identifier retained for compatibility |
| `deere-shop-product-gallery-preview` | Product gallery preview interface referenced by Studio metadata | Required for the product form to load completely |
| `deere-shop-search` | Existing catalog search module | Historical identifier retained for compatibility |
| `directus-labs-seo-plugin` | `seo-interface` and `seo-display` | Upstream MIT license retained |
| `directus-extension-flexible-editor` | `flexible-editor` interface/display for article content | Upstream GPL-3.0 license retained |

The `deere-shop-image-contain` display bundle is not included in the active extension closure: no current schema or Studio metadata references it. Add it only if a reviewed field configuration begins using that display.

No source database snapshot, product/media assets, importer, production flows, or site secrets are part of this baseline. The default Core bootstrap creates only local asset folders and leaves public access closed; content is managed through the existing Administrator account. The full strict business role/permission blueprint is available through `npm run access:apply` only when the Directus instance is entitled to custom permission rules. Core rejects the folder-scoped validation/preset rules used here, so the installer does not strip them or fall back to broader access. A rejected full apply reports its partial state; inspect it before retrying or cleanup.
