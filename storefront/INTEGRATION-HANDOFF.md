# Integration handoff — 2026-10-07

**Local real Directus acceptance PASS on synthetic fixtures. Genuine catalog/100k/production pending.**

Tested implementation: `8535da036c5f2286a01e61a382589ea1864394f9`, branch `feat/storefront-directus-acceptance`, continuing [Draft PR#1](https://github.com/alexdubaev/Universal-Commerce-CMS/pull/1). No main merge or production deployment approval.

Worktree: `C:/Users/Alexandr/.codex/worktrees/storefront-directus-acceptance/Universal Commerce CMS`. Existing Directus12.1.1 at `http://127.0.0.1:18056`, PostgreSQL17.11, Compose `universal-commerce-cms-dev`. Directus now mounts this reviewed checkout's extensions; keep it available. Its original DB/uploads/network are preserved. Schema, dependency versions and visual design were not replaced.

Installed Core cannot persist required native custom permission filters. The explicit default-off fixed `/commerce/storefront` gateway authorizes only its configured own technical user, which has zero native business/file grants. Internal elevated calls are bounded by fixed selectors/publication/parent/category/folder/ownership rules. No entitlement bypass or unrestricted access. Native transport remains default for an appropriately provisioned instance. Only the owner operates CMS as Administrator; no staff roles required. Never give Administrator token to storefront or browser.

Local config is ignored: `DIRECTUS_URL`, server-only `DIRECTUS_TOKEN`, gateway=true, mock=false, fallback=false. CMS gateway flags/user/public-folder values and manifest remain ignored. Fixtures are15 published synthetic products/3unknown brands/3categories with content/pages/nav/home/files. RUB, parts_request=true, cart=false; orders/attachments disabled. Additional code-alias search stays off; exact SKU/MPN global200 candidates and RFQ100-item cap preserved.

Final: unit62, Directus205, race4, mockbrowser30, livebrowser21 PASS; TypeScript/builds/audits/canaries PASS. All15 journaled lead rows have matching IDs/technical creator and one row per key. Retry survives process restart; conflict/invalid/outage/asset revoke-restore tests PASS. No unresolved implementation P0/P1/P2; local fixture concurrency/system cleanup is P3. Do not delete by prefix or overlap fixture tools; retain exact private journal/snapshots.

Current routine checks run locally with `node scripts/verify-local.mjs` from the repository root; the old browser matrix and `test:e2e:live` command have been removed. Use `npm run start:live` only for an own-runtime preview. The opt-in observer requires explicit loopback DIRECTUS_URL and `npm run probe:live -- --runtime-approved`; it can write owned fixtures and restart the local storefront. The browser/probe results above are historical. Production must use its own credentials/configuration and accept100k/load/topology/CSP/edge controls/cache/backups/security before deployment.

Authoritative detail: [11-FINAL-HANDOFF](../docs/storefront-live-integration/11-FINAL-HANDOFF.md). Read root/storefront AGENTS, DESIGN-CONTRACT, ADR002 and [decisions](../docs/storefront-live-integration/10-DECISIONS.md) before further changes. Do not rebuild storefront, migrate schema for presentation, add brand apps, invent inventory/prices or enable fictional fallback.
