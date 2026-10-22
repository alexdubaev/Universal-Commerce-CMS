# PRODUCTS-UX independent review and closure

One fresh independent reviewer examined the active change without implementation history. Owner policy requires a bounded fix pass and targeted closure; a second whole-change review is not required.

Confirmed findings fixed in the bounded pass:

- P1: a local `props` binding caused a product-card render exception; renamed to avoid shadowing the component props.
- P2: acknowledgement and accepted readback versions were not compared; mismatch is now rejected with a focused regression.
- P2: equivalent numeric/relation response shapes could introduce unintended changes; normalized comparison now excludes those fields, covered by regression.
- P2: gallery reads checked IDs but not all required preservation fields; incomplete rows now disable gallery edits.
- P2: conflict state allowed another Save, and uncertain writes allowed form mutation; writes are blocked until comparison/reconciliation and pending forms are inert.
- P2: known-ID create reconciliation stayed on the create route; verified creation now routes to its canonical item path.
- P2: readable status was absent from the product GET; the query now includes permitted status and an untouched card reports no unsaved changes.
- P2: three screenshots contained existing catalogue rows; they were removed and are replaced by synthetic-fixture evidence.

Lead native checks subsequently confirmed rendering, status, native field focus, cancel/Escape, two real CAS conflicts, read-only comparison/keep, uncertain-write locking and GET-only verification, incomplete acknowledgement rejection, one POST after double-click, zero-price retention and explicit status transitions.

The narrow disconnected-field closure displays unsupported storefront settings read-only with explanations. A later lead runtime check caught a comma-expression render regression introduced by that closure (native forms disappeared despite passing syntax and helper checks). It is now an array of sibling children; source and dist contain the correction, and the lead's installed native UI check confirmed that create/save forms render and scalar create/save work. The independent closure check also verified the duplicate-record error branch, write permission gating, Save-primary/Publish-secondary button semantics, and the requested native-form array correction. The focused helper tests and syntax/diff checks pass. Final installed verification and the final local gate remain lead-owned.

One protected integration limitation remains: detaching a product image relation returns Directus HTTP 500 because the installed schema marks the child product foreign key required and the existing mutation path nullifies it. The lead traced this to the installed Directus one-to-many schema handling and `apply-schema` configuration; nested deletion follows the same nullification path. No safe product-editor-only change can implement this detach under the current schema without risking media/data integrity, so the reviewer did not change the protected schema, backend, or permissions. Image removal should be treated as unavailable until a separately authorized backend/schema design resolves the constraint. The runtime path was exercised and failed as described; this remains a P2 release limitation.

Final owner acceptance remains pending. No publication or production operation has occurred.

Lead final closure: `node scripts/verify-local.mjs` passed on the exact final source (295 backend cases, 36 storefront cases, audit 0, build/token scan, 2 Chromium journeys); focused tests passed 14/14. Source/runtime hashes and the actual served bundle are recorded, the other 12 accepted A0 artifacts remain unchanged, and final desktop/mobile screenshots were recaptured. All 9 own test records were guarded-deleted and exact remaining IDs are zero.

Backend P1 closure review: the applier source SHA-256 matches `evidence/backend-migration.json` (`ad0bd4ca21be60eb58244568b7369a94b5c9c5921166586d480d0e8de37f1424`). The scoped CLI dry-run planned one action, apply changed one relation, repeat was idempotent, and rollback restored the exact original 105-relation graph before reapply. The resulting relation retained its original FK identity, CASCADE/NO ACTION actions, and required field. The applier sends the full relation identity and verifies a fresh readback, failing closed if the FK, policy, or unrelated metadata differs.

Native closure evidence now passes: main-photo and last-photo detach preserve other product references, file metadata, and upload bytes; stale parent CAS leaves the child intact; an invalid later nested write rolls the parent and children back. `node scripts/verify-local.mjs` passes with 295 backend tests, 36 storefront tests, zero audit findings, build/token checks, and two Chromium journeys. The backend P1 is closed with no further findings in this bounded review. Owner UI acceptance remains pending; no publication or production operation occurred.


## Owner acceptance — 22 October 2026

The owner accepted the final installed result with «Принимаю» after real desktop/mobile before/after screenshots. This supersedes historical pending-acceptance checkpoints above. No product code changed after the verified and independently reviewed candidate. Publication proceeds through the authorized checked PR workflow; production remains untouched.
