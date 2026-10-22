# Authorized backend closure for PRODUCTS-UX #16

Owner expanded this same unfinished task in chat: «Не, давай до конца доводи, надо в бекэнд, лезь в бекэнд». This authorizes the narrow backend/schema fix required for photo detachment. It does not authorize production, storefront, access/credentials, dependencies, Docker configuration, unrelated relations or the next task.

Base and fresh `origin/main`: `97c3339178f1febee5ed3c23f3b2e6dd2417f5c8`. Continue `codex/products-ux-16-review`; preserve its existing PRODUCTS-UX diff and the unrelated dirty original checkout.

## Requested behavior and allowed files

Removing a photo from a product through the existing gallery/CAS transaction removes that product's `product_images` child row. It does not delete `directus_files`, stored file bytes or another product's reference. The remaining gallery order/main image and unknown fields remain correct. A rejected/stale save produces no partial gallery or parent changes.

Newly allowed code: `directus/schema/blueprint.mjs` (only `product_images.product`), `directus/schema/apply-schema.mjs` (explicit, scoped relation policy reconciliation), and `directus/schema/apply-schema.test.mjs` (behavioral applier tests). Existing approved product frontend/test/dist/doc files remain in scope, but no gallery rewrite is planned. No schema snapshot regeneration or broad schema apply is authorized by this plan.

## Implementation task

1. Add an explicit `oneDeselectAction: "delete"` only to the canonical `product_images.product` field declaration. Preserve other relation defaults.
2. Respect and validate the explicit override in relation creation. Reconcile existing relations only when they explicitly opt in. Match the actual relation identity before changing it; reject missing/incompatible metadata instead of guessing.
3. Provide an exported scoped applier and a `--relation-deselect-only` CLI path with dry-run/idempotence. It may inspect relation metadata and PATCH only explicitly opted-in existing relations. It must not run collection/field/archive/versioning/seed reconciliation.
4. Directus 12.1.1 recreates a relation FK even for a metadata PATCH. Send full validated `collection`/`field`/`related_collection` identity and preserve the read current `schema.on_delete` and `schema.on_update`; current target is CASCADE / NO ACTION. Do not reset other metadata or change required/nullability behavior. A fresh readback must prove FK identity/actions, the desired policy and unchanged unrelated metadata before reporting success.
5. Add meaningful applier behavior tests first: creation override/default preservation; targeted existing migration preserving FK/unrelated metadata; no unrelated calls/writes; dry-run; idempotence; incompatible identity or unsafe missing FK metadata rejected. Do not add source/config snapshots.

One fresh worker writes production code; lead inspects actual diff, runs checks and owns native runtime operations. A fresh independent review covers the new backend delta and final integration safety after deterministic checks.

## Own runtime rollout and verification

Confirmed own Windows Directus 12.1.1, Compose `universal-commerce-cms-dev`, loopback 18056. Current target relation snapshot is `evidence/backend-relation-before.json`. A second reproduction on new exact-ID own fixtures returns 500 and preserves parent/remaining child (`backend-detach-before.json`). Three own image rows across two own products reference two existing neutral synthetic files read-only; journal `backend-runtime-journal.json`.

Run only the scoped dry-run/apply. Compare the full relation graph before/after: the target deselect action is the only persistent metadata difference; FK actions stay identical. Prove configuration rollback by restoring the exact original target policy with the original FK actions, checking equality, then reapply the reviewed fix. A metadata patch does not automatically delete content. No broad schema apply or production action.

Native acceptance: gallery detach with main image/order/alt saved and fresh accepted readback; shared file and another own product reference unchanged; file metadata and asset bytes unchanged; stale parent CAS rejected without child loss; invalid nested write leaves parent/children unchanged; actual UI on desktop/mobile. Retain original full frontend checks and rerun affected cases plus `node scripts/verify-local.mjs` on the final candidate. Clean only exact own fixture IDs using guarded snapshots; never delete files.

STOP if relation identity/FK actions drift, an unrelated write is needed, permissions fail, rollback cannot be verified, or native deletion touches file content/another product. Investigate before escalating; do not weaken CAS or reinterpret this approval as production authorization.

Final user acceptance remains required by the original request before publication. After mandatory acceptance: commit/push/PR/merge, confirm main, safe own branch/worktree cleanup and final HANDOFF. Do not ask again for already authorized routine implementation or integration actions.

## Verified result

The fresh worker implemented the declared three-file delta. Fresh independent backend review and one bounded correction pass are complete. A first native trial exposed Directus 12.1.1 returning HTTP 200 while dropping the FK for an incomplete PATCH identity. The exact original 105-relation graph was immediately restored before any content writes. The corrected payload/readback contract above and regression now cover that boundary. This trial and recovery are retained in `evidence/backend-initial-migration-recovery.json`.

The actual scoped CLI subsequently passed dry-run, one-target apply, idempotent repeat, exact original metadata rollback and reapply. The only final graph difference is the intended target deselect policy. FK actions, required/nullability and other metadata stayed unchanged (`backend-migration.json`). No full schema apply ran.

Actual desktop/mobile gallery saves removed the main photo and last photo, selected/cleared the correct main-image fields, and returned accepted readbacks. A stale parent snapshot returned 409 without child loss. A later invalid specification update (after native image deletion in the O2M processing order) restored the parent, removed image and other own children exactly. Another own product and its shared file reference stayed unchanged; both original files' metadata and raw disk SHA-256 still match after cleanup.

Final gate: `node scripts/verify-local.mjs` PASS on the exact final source — 295 backend cases, 36 storefront cases, audit 0, production build/token scan and 2 Chromium journeys. Product focused tests 14/14 and applier tests 8/8 pass. Independent narrow closure verified the applier's exact hash against native evidence and found no remaining issue. All six backend fixture IDs are absent; the original nine implementation fixture IDs and earlier reproduction fixture ID are also absent. Media files were never deleted or modified.

The own local target intentionally retains the fixed policy. Production was not touched. The owner completed final UI acceptance on 22 October 2026 with «Принимаю». All required acceptances are complete; the authorized checked publication workflow can proceed.

## Scoped operator command

Use the selected instance's own environment only; `dev/.env` must remain ignored. Never copy another instance's relation snapshot or credentials.

```powershell
node --env-file=<OWN_DEV_ENV> directus/schema/apply-schema.mjs --relation-deselect-only --dry-run
node --env-file=<OWN_DEV_ENV> directus/schema/apply-schema.mjs --relation-deselect-only
```

Before applying, record the exact target relation and graph digest. A rollback must PATCH that same target with full identity, the recorded old deselect policy and the recorded FK actions, then verify the restored relation/graph. In this own runtime that exact restore/reapply was verified. A metadata rollback does not recreate a deliberately removed child row; native transaction rollback covers rejected saves. Production rollout remains separately scoped.
