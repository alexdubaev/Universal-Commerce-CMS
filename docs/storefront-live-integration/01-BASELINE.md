# Baseline — 2026-10-06–07

This records the initial state, before integration. Current acceptance is in [11-FINAL-HANDOFF.md](11-FINAL-HANDOFF.md).

PR #1 was fetched and verified at `0f883b26e5003cb00bfad1ed7dc2586268182052`, open Draft, source `feat/storefront-nextjs-dark`. It was re-fetched before final verification and still had that head. Integration branch: `feat/storefront-directus-acceptance`, managed worktree based on that SHA. Main and the clean original bootstrap checkout are unchanged.

Existing local stack: `universal-commerce-cms-dev`, Directus 12.1.1, PostgreSQL 17.11, loopback URL `http://127.0.0.1:18056`, isolated named volumes. Authenticated health succeeded; anonymous products/health were forbidden. Initially only Administrator existed; no storefront business policy/service identity existed. Installed Core rejected the required native custom permission rules; no entitlement bypass or unrestricted grant was used.

Initial content: one synthetic draft product, zero published products, brand groups, categories or files; one draft page, no stored home row, zero navigation. Runtime profile: RUB, cart disabled, parts request disabled. Secrets remain ignored and are never printed.

Owner authorized specially created synthetic records in this local CMS on 2026-10-07; genuine catalog acceptance is deferred. Only the owner operates CMS as Administrator; no staff roles were requested or installed.

Initial deterministic checks: unit43, Directus170, race4, TypeScript/build/canary PASS, audits zero. Early native Windows WebKit failures led to the bounded hydration/skip-link fixes recorded in findings. These initial counts are superseded by final acceptance.

Activation reused this same Compose project, database, images, networks and volumes. Only Directus was recreated to mount the reviewed integration checkout's extensions; its reviewed local env enables the guarded gateway. PostgreSQL was not replaced. No schema migration, second CMS, version/dependency update, or production deployment occurred.
