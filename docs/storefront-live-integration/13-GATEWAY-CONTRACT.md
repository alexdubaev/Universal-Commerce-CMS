# Local Core gateway contract

This is the selected supported custom-endpoint transport, not a change to Directus Core licensing or schema. Native storefront transport remains the default; gateway transport requires explicit configuration.

CMS flags: `COMMERCE_STOREFRONT_ENABLED=true`, `COMMERCE_STOREFRONT_USER_ID=<own instance UUID>`, `COMMERCE_STOREFRONT_PUBLIC_FOLDER_ID=<own public fixture folder UUID>`. Values are generated/configured locally, ignored, and never committed. Missing/malformed configuration denies access. Exact authenticated user must match; anonymous, other users and Administrator accountability deny before schema/elevated services are constructed.

The service identity receives zero native business/file grants. Its `/items/*`, `/files/*`, `/assets/*`, role/user administration, mutations/versions and native commerce writes must remain denied in live negative tests. No user-supplied identity header, role-name shortcut or broad fallback is accepted.

Frontend flag: `STOREFRONT_DIRECTUS_GATEWAY=true`. Server transport maps existing internal paths and preserves query strings:

| Existing internal path | Guarded path |
| --- | --- |
| `/items/<allowed collection>` | `/commerce/storefront/items/<allowed collection>` |
| `/commerce/search` | `/commerce/storefront/search` |
| `/commerce/leads` | `/commerce/storefront/leads` |
| `/commerce/orders` | `/commerce/storefront/orders` (disabled) |
| `/server/health` | `/commerce/storefront/health` |
| `/assets/<UUID>` | `/commerce/storefront/assets/<UUID>` |

Unknown paths/collections/fields/query parameters reject, never fall through to native privileged APIs. No external browser routes change.

## Reads

Allow only selectors used by the current adapters (02 contract report). Enforce fixed publication and parent visibility regardless of incoming filters. Children require published parent products; codes require active state; analog endpoints must both be published. Visible page sections require a published page or home parent. Top-level navigation requires published/visible state. Site settings exclude integrations, secrets and commerce-profile internals from public DTOs.

Filters/sorts/fields/operators, aggregate count/groupBy brand, meta filter_count, pagination and query length/depth/list size have explicit allowlists/caps. No wildcard fields, deep relation traversal, arbitrary SQL/collection/filter proxy, or unbounded limit. Product category projection must not leak unpublished categories. Singleton response semantics match current adapters; list/count and sitemap offset semantics remain intact. Exact search preserves normalization and a global 200-candidate ceiling; additional codes remain disabled in this local stack.

## Assets

Valid UUID, configured public folder and a fresh published storefront reference/parent are all required before bytes. This folder check is mandatory even if CMS content wrongly references a private file. Deny metadata failures, missing references and stale/revoked publication. Assets are no-store initially; active content is forced to download with existing sandbox/nosniff protections. No file list/upload/import/delete/private attachments are exposed.

## Writes

RFQ accepts the existing validated payload and <=100 request items. Reuse its atomic transaction/advisory lock/fingerprint contract with explicit service-user ownership on lookup and audit fields; unknown-owner records cannot be replayed. Internal privileged service initialization occurs only after exact service caller authorization. Return acknowledgement ID/replay state only. Reject attachments/manifests in this minimal gateway; do not bypass their separate security contract. Orders stay disabled because cart is false; native handlers keep original caller accountability and race semantics.

## Evidence required

Deterministic gate/query/visibility/folder/ownership tests; service source/dist parity; live token denial on all native surfaces; synthetic CMS DTO/assets; real database durable identical retry and conflicting retry; server token absent from browser artifacts; unchanged native/mock tests. Local synthetic passes do not grant production acceptance. Rate controls, CSP/topology and true-catalog/100k acceptance retain their separate gates.
