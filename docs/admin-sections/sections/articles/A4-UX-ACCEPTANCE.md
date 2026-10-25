# A4-UX-FIX — installed Windows acceptance

Date: 2026-10-25. Approved variant: [proposal](ux-proposal/PROPOSAL.md), explicitly approved by “Реализуй”. Base main/A3: `6db7cb33f0ed240d0445ba7a90cfbc21a9fec382` (merged PR #27). Prior A0–A3 HANDOFFs, merges and the actual installed A3 artifact were checked before implementation. No A5 work is included.

## Environment and artifact

Real Windows Directus 12.1.1 at `http://127.0.0.1:18056`, Compose project `universal-commerce-cms-dev`, loopback binding, existing isolated database/uploads volumes and existing extension bind. The local storefront observer is `http://127.0.0.1:3000`. No public/production host was established or used.

Final article source/distribution SHA256: `f2b358e72ec4ee2760d87c8df76aac4229353428f876921db3180994863cdda5`. Installed served aggregate SHA256: `cdd4710fcc538fab326ae3a501a3d6612a3d0af9b2ed8bcc27add135b29e3fa7`. Authenticated health, version, served registration markers and mounted file hashes passed. The release HANDOFF records the eventual Git/PR/merge identity; installation receipts distinguish an uncommitted test candidate from the clean merged release.

Only `src/sections/articles.js`, its byte-identical distribution copy, article behavior tests and this documentation change. Native editor/interfaces/vendor assets, shared A0, backend/publication, schema, roles, credentials, dependencies, storefront and infrastructure configuration remain unchanged.

## Verified behavior

| Boundary | Evidence and result |
|---|---|
| SEO consistency failure | Before-fix controller regression reproduced stuck saving; corrected validation releases saving without POST, correction permits guarded save/read-back. Existing contradiction protection remains. |
| Required field error | Installed empty-title failure reproduced invisible guidance; final local alert explains the field, sends no POST, focuses editable input and permits successful corrected save. Desktop/mobile captures reviewed independently. |
| Selected products/categories | Actual pre-fix installed search replaced a selected readable title with a UUID. Final independent selected queries retain labels/unlink across a different search, errors and retries. Unknown/unreadable values remain without IDs or unlink. |
| Async/access/legacy boundaries | Controller tests cover bounded chunks, stale responses, collection/field permission filtering, denied brand, unknown numeric values and legacy JSON-string containers. No broad catalog read or automatic conversion. |
| HTML and unknown structures | Complex uppercase HTML, attributes, entities, whitespace, comments and table markup retained byte-for-byte across non-content saves, cover/alt, relations, search settings, hydration, tabs and canceled dialogs. Nonempty custom structural/source/translation JSON survived. |
| Intentional editing | Real typing, clipboard paste and Ctrl+B saved in ordinary and Writing modes. Native Russian source dialog saved intentional HTML exactly. |
| Files | Native cover selection, alt update and explicit clear persisted. Clear retained the actual file record until its later explicit fixture cleanup. |
| Search settings | One title/description/image surface, JSON-first initial projection, live intentional value display and guarded synchronized save; unknown JSON members retained. |
| Concurrency/recovery | Real concurrent update caused CAS conflict, preserved local edits and required explicit comparison. Compare/reconcile did not write. Lost acknowledgement caused one write and no automatic retry. |
| Creation/publication | Native UI created a draft with journaled identity. Separate status action sent only status. Draft/future routes returned 404, due publication returned 200/content, archive returned 404. Backend predicate unchanged. |
| Real negative access | Existing configured non-admin service identity could not read the own draft or mutate it (403); admin read-back was unchanged. No role/user/policy was created or widened. |
| Visual/keyboard | Desktop 1536×1024 and phone 390×844; targeted 320/1024 overflow/focus checks. Five mobile tabs wrap visibly after removing an obsolete local override. Unlink button stays readable; measured custom text contrast 5.54–5.81:1. |

The primary inspected the actual diff and installed captures against the approved reference. [Independent review](A4-UX-REVIEW.md) and its bounded closures found no unresolved in-scope significant code finding. Native editor height and existing Directus chrome remain native rather than copying static mockup markup.

## Local gate and data safety

`node scripts/verify-local.mjs` passed on the final product bytes: 336 backend tests, 36 storefront tests, zero audit vulnerabilities, production build/TypeScript, client-secret/deployment-artifact checks and both short Chromium journeys. Article behavior tests: 38 passed; shared A0 state: 37 passed. No GitHub Actions gate was introduced. Private final log: `D:/codex/ucms-release-backups/a4-ux-20261025/verify-local-final7.log`.

Native tests ran against the installed bundle, with no extension/module replacement. A mutex serialized fixture writers. Exact IDs were journaled before writes; cleanup checked identity plus ownership title/slug and verified exact absence. Failed harness assumptions and the real validation red case remain in private evidence; they were not relabeled as product successes. Corrected reruns were limited to affected scenarios. No company article was published in production, no foreign rows were edited, and no global restore/prune was used.

The lead independently audited every exact journaled ID after native acceptance: 66 IDs across 19 fixture runs were absent. Private evidence: `fixture-audit-final.json`. The final date visual closure shows the complete date and `Europe/Moscow · UTC+03:00`; publication values use normal wrapping, visible overflow and readable color (146px client/scroll width), rather than ellipsis. All five mobile tabs are visible at 356px inner width without horizontal overflow. Final capture run: `01531ade-9959-420a-9224-95f609536410`.

An A4-specific two-file installer passed eight isolated guard tests. The pre-A4 artifact backup, immutable receipts, expected-hash checks, unrelated-extension inventory and recovery journal are under `D:/codex/ucms-release-backups/a4-ux-20261025/`. Real artifact rollback restored the exact original pair and served aggregate, with authenticated health passing. Database/uploads were not restored. Final release uses the same guarded procedure and requires a clean merged source.

## Screenshots and limits

Final installed candidate screenshots are under `ux-installed/`; these show the actual Directus bundle on synthetic owned records. Native dialog captures retain their verified candidate-6 identity: later changes only fix publication/additional-date CSS and do not change these dialogs. Each PNG records its actual artifact/run identity. The paired Before/proposed images remain under `ux-proposal/`. PNG dimensions/hashes and source run identifiers are recorded alongside the installed images. Final post-release smoke and cleanup are recorded in HANDOFF.

The [native language-asset limitation](A4-NATIVE-LANGUAGE-LIMITATION.md) was reproduced on the exact original bundle. The checked toolbar/link/image/source controls are Russian and work; this is not a claim that the missing language pack loads or that the console is completely clean. No table tool is configured. Final closure observed no other browser exception.

The native UI run used Administrator. The existing service-token denial is a real API-boundary check, not Manager-UI role coverage. Field-denied/legacy-string edge cases are additionally covered at the controller boundary; no unsafe SQL seeding or role expansion was used. No external novice/user study or additional owner acceptance was fabricated or made a release condition.
