# Local catalog upload — 2026-10-07

STATUS: PASS for authorized local import; production acceptance remains pending. Owner explicitly authorized local upload after supplying catalog and converted WebP photos. Earlier approval publishes gallery entries. This supersedes the earlier synthetic-only data stage for this local instance; no production deployment or source-instance writes are authorized.

Behavior: import own runtime catalog from supplied archives, remap all instance IDs, preserve product/category/media references and published gallery, keep pricing/availability values without guesses.

Allowed: localhost18056 catalog/categories/file/image content writes via Administrator provisioning only; private import tooling/ownership journals outside Git; aggregate operational docs here.

Protected: original/source instances; credentials/roles/permissions/schema/Compose/deployment/design/application source; existing unrelated runtime records. Credentials stay ignored/in memory. Catalog rows, images and old identifiers never enter Git. Existing server-to-server technical identity remains unchanged.

Plan: offline input/media mapping and duplicate quarantine; reviewed resumable private importer with fresh target IDs and durable pending writes; fresh independent review before write execution; controlled local import; real database/API/browser readback; refresh local storefront build/cache if needed; aggregate final report.

Known input:12971 products/18categories/1269images. Convert1251 photos to validated1200x1200WebP; retain18existingWebPicons. Exclude four records in two normalized-SKU collision pairs for owner adjudication rather than merge/destroy them; planned12967 imported products. Source gallery rows968 are draft; approved target gallery is published (exclude quarantined parents as necessary).

Safety: exact local URL; immutable input checksums; no blind retry or overwrite on a partial manifest; target collision preflight; publication/current folder gates preserved; no deletions for failure recovery. Native child writes use the proven transactional nested-parent creation path.

Verification: owned count and field/MIME/reference readback, published gallery, category/brand/catalog/search/product/asset/API checks through the running storefront; same-payload resume creates no duplicates; private source/quarantine remains available. Performance claims only at imported size, not100k.

Execution notes: pre-import database backup and immutable count baseline saved privately. Fresh independent importer reviews completed before writes. Runtime restart is journal-based with exact target IDs and readback; native missing-item UUID reads return403, so ownership checks use filtered list queries. A Windows journal rename interruption after5532 completed products left two already-created, verified pending products; bounded retry of the same prepared journal file was added for EPERM/EACCES/EBUSY. Its isolated tests pass3/3. No catalog overwrite, rollback deletion, schema, permission or application change was used.

Result: PASS — authorized local content import. Imported12967 published products,18categories,1269WebPassets (1251photos+18icons),968publishedgalleryrecords. Four conflicting source product records remain privately quarantined. Existing runtime records retained: final totals12986products,21categories,1276files,972galleryrecords,15leads.

Both lead and independent GET-only verification checked every imported product's title/slug/SKU/brand/category/main image/price/currency/price status/availability; categories and parent/icon references; all gallery IDs/status/files/order/alt text; file MIME/folder; fresh instance UUIDs; quarantine absence; exact baseline count preservation. All nine aggregate checks PASS. Interrupted import resumed without duplicates. Ledger complete, zero pending writes/issues.

Fresh live Next production build PASS; mocks/fallback off, technical gateway identity unchanged. Own CMS/admin and storefront health/home/JohnDeere brand/sitemap returnHTTP200. One-shot local observations: home73ms, brand132ms, sitemap14ms; these are smoke observations, not load/p95 evidence.100k acceptance remains pending.

Private before-import database backup, source/quarantine, checksums, remap journal and reviewed tooling retained next to the owner's archives in local-cms-import-2026-10-07, outside Git. Temp source retained. No source instance touched; no schema, permissions, credentials, Compose, deployment, design or application changes. No main merge or production deployment.


Targeted read-only Chromium browser acceptance PASS: JohnDeere12967; all published catalog12982including preserved fixtures; exact SKU one match; imported category; fixed/on-request/no-image products; six-image gallery switching; public assetHTTP200/image-webp/validsignature; missing-productHTTP404; no horizontal overflow1440/390. The initial cached catalog count refreshed through normal30-second revalidation. No RFQ writes or broad synthetic suite rerun; WebKit not rerun for this content-only import. Earlier integration-suite results remain historical, not newly claimed.
