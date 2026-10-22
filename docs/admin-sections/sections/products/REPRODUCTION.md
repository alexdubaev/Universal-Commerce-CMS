# PRODUCTS-UX reproduction before implementation

22 October 2026; source/base `97c3339178f1febee5ed3c23f3b2e6dd2417f5c8` (accepted A0). Windows local Chromium, real Directus 12.1.1 at `127.0.0.1:18056`. Confirmed Compose project `universal-commerce-cms-dev`, loopback binding, own PostgreSQL/uploads volumes and extension bind mount. All 14 installed A0 src/dist runtime artifacts matched the accepted manifest before edits. No production operations.

## Observed directly

- List has search and fixed pagination, no status/availability filters or sort selection.
- Search with no result renders an empty table without an explanation/reset action.
- Failed list GET shows an error without a dedicated retry action.
- Search for synthetic part 02, open its unchanged card, return: search resets to empty and the first 25 rows are shown.
- Delay actual GET for synthetic part 02; issue search for part 03; let part 03 finish first; release part 02: the field still says part 03 but rows become part 02.
- New, never-saved card says all changes are saved.
- Choosing Archive leaves the action named Save draft. These are form-only status changes initially; a later own synthetic create confirmed Archive was actually preserved.
- Card includes technical labels and gallery on unrelated tabs. On 390×844 the list extends beyond the screen; desktop screenshots use 1536×1024.

## Controlled transport faults (not claims of real server outages)

- Intercept an update with 409: local input stays, but UI suggests reload and offers no comparison.
- Abort an update before sending: raw `Network Error`, ordinary Save enabled again.
- Return HTTP 200 containing only the existing ID; abort subsequent product readback: UI clears dirty and announces saved while a fresh independent GET proves the database title is unchanged.

## Data ownership

One own synthetic product was created during reproduction because the initial interception covered the guarded update path but creation uses the separate native items path. This was disclosed in chat. Its exact ID was journaled, all scalar initial fields were checked, and guarded deletion used `require_unreferenced: true`; exact-ID remaining = 0. No existing product, singleton, role or media file was changed. Review removed list screenshots containing existing catalogue rows from the candidate; retained and replacement evidence uses synthetic fixtures only.

## Baseline and approval

`node --test directus/extensions/deere-shop-product-editor/test/editor-state.test.mjs`: 5/5, no failures. This baseline does not cover the newly reproduced problems. The broad local gate is due on the implementation candidate, not represented as already passed.

Owner received before screenshots and proposed static after sketches, then authorized implementation with «Делай». Sketches are not installed screenshots or acceptance. Real installed after screenshots and final owner acceptance remain required before PR/merge.

The active runtime currently exposes Administrator and a synthetic storefront role, but no manager role was found. No roles or credentials were created/expanded for this task. Administrator-only behavior cannot establish manager acceptance; targeted denied-permission transport tests will be labeled separately from native role verification.


## Owner acceptance — 22 October 2026

The owner accepted the final installed result with «Принимаю» after real desktop/mobile before/after screenshots. This supersedes historical pending-acceptance checkpoints above. No product code changed after the verified and independently reviewed candidate. Publication proceeds through the authorized checked PR workflow; production remains untouched.
