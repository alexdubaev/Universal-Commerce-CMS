# Baseline — 2026-10-06–07

Full original runtime and query evidence: [REAL-DIRECTUS-ACCEPTANCE](../../storefront/REAL-DIRECTUS-ACCEPTANCE.md).

PR #1 was fetched and verified at `0f883b26e5003cb00bfad1ed7dc2586268182052`, open Draft, source `feat/storefront-nextjs-dark`. Integration branch: `feat/storefront-directus-acceptance`, managed worktree based on that SHA. Main and the clean original bootstrap checkout are unchanged.

Existing local stack: `universal-commerce-cms-dev`, Directus 12.1.1, PostgreSQL 17.11, loopback URL `http://127.0.0.1:18056`, isolated named volumes. Authenticated health succeeds; anonymous products/health are forbidden. Only Administrator is installed; no storefront identity/business policy exists.

Content baseline: one synthetic draft product, zero published products, brand groups, categories or files; one draft page, draft home singleton, zero navigation. Runtime profile: RUB, cart disabled, parts request disabled. Secrets remain ignored and are never printed.

User steering on 2026-10-07: use specifically created synthetic records in this local CMS; defer genuine catalog acceptance. Synthetic CMS records qualify as live API/database integration tests, not genuine catalog/production acceptance.

Fresh checks before further implementation: unit 43/43, TypeScript/build PASS, Directus 170/170, race 4/4, audits zero, client token canary PASS. Mock Windows Playwright 27/30; serial WebKit repeat 7/10 with the same three failures. Original Linux CI at the PR head was green.

No runtime/profile/access/schema/Docker changes have yet been made. Two bounded adapter fixes are uncommitted and have passed first independent review.
