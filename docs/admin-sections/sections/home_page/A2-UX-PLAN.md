# A2-UX-FIX implementation plan

Owner explicitly approved the displayed proposal with «Утверждаю» on 2026-10-23. Approval includes autonomous checked merge and local installation on Windows Directus 127.0.0.1:18056, Compose universal-commerce-cms-dev. No A3 implementation.

BASE: 5b7879b6bec22e4585940151d23cd5821a2ea6a8. Branch codex/a2-home-ux-issue18, worktree D:/codex/worktrees/ucc-a2-home-ux. Fresh origin/main unchanged at start of implementation.

Goal: implement the approved four-tab home editor with honest field effects, separate parent/child saving and safe native editing.
Architecture: reuse NativeFieldGroup/MediaPicker/EditorToolbar/createEditorState/PageSectionEditor. Keep the singleton, routes, permissions, identity and CAS protections. Scalar SEO input uses existing hooks and server readback; it does not replace or normalize unknown JSON.
Spec: issues #18/#22 and ux-proposal/PROPOSAL.md, prototype.html, capture-manifest.json, PREPARATION.md and FIELD-CONSUMERS-CURRENT.md.

## Task 1 — home presentation and protected edit boundaries

Worker owns src/sections/home_page.js, corresponding dist, test/sections/home_page.test.mjs. If necessary for approved block states only, opt-in src/page-sections.js + dist and test/page-sections.test.mjs; default pages behavior stays intact. No other product files without a lead scope ruling. Documentation/evidence stays under this home_page directory.

- [x] Add useful failing boundary tests before changes: inactive fields cannot enter changes; SEO scalar save/readback preserves unknown keys; parent reconcile retains local parent edits and independent child state; validation opens the proper group/tab and does not lose input. Retain existing cardinality/permissions/identity/uncertain-result protections. Do not add source-string/CSS snapshots or tests for incidental markup.
- [x] Implement four tabs: hero default, blocks, search/links, additional. Hide source_page without changing its value; reserve h1 in a rare search group. Keep hero layout/media native, two button pairs with real fallback condition. Search placeholder/button only are working inputs; label/bulk/excel/photo/OG/translations readonly with concrete limits.
- [x] Use one scalar search title/description/canonical/indexability input and existing SEO hook readback. No editable raw JSON duplicate. Preserve all unknown/server data and no status write.
- [x] Child states distinguish publication from visibility. Known Russian type labels; unknown type remains unchanged and may render generically. Live items/settings are JSON interfaces, so safe parsed readonly item display and a concrete editor blocker; settings/subtitle/translations without a consumer are not sold as working settings. Keep native usable fields and separate child CAS saves, do not add publish/create/delete/reorder.
- [x] Keep aggregate dirty state and child buffers across tabs/selection. Parent cancel only affects parent. Parent stale messages describe refresh/compare without claiming a write. Save labels identify their record. Human labels/errors/comparison/aria; no raw field keys.
- [x] Run node --test directus/extensions/deere-shop-product-editor/test/sections/home_page.test.mjs directus/extensions/deere-shop-product-editor/test/page-sections.test.mjs plus relevant A0 tests for touched adapters. Lead inspects diff and reruns relevant final checks.

## Task 2 — real Windows verification, documentation and release

- [x] Reuse existing safe runtime mechanisms where applicable; a bounded opt-in probe may be written under home_page/runtime. Probe writer edits documentation/script only, never shares product implementation ownership. One runtime writer/mutex; verify runtime ownership/mount and exact installed artifact hashes before mutation.
- [x] Prepare private artifact backup and guarded artifact-only rollback before changing runtime files; preserve unrelated mount files. Singleton test fields journaled privately before change and restored with CAS/field-specific ownership checks. No second singleton/full DB restore. Children/files only own exact IDs, exact cleanup.
- [x] Verify real native form, image selection/unlink safety, parent and two children across tabs, separate save/readback/SEO unknowns, conflict/stale/uncertain/403/read errors, publication/visibility and unknown type; verify actual frontend effect through existing own gateway/live storefront where safely available. Do not broaden roles. Administrator acceptance is distinct from manager RBAC.
- [x] Capture installed 1536x1024/390x844 and compare to proposal; address 320/1024 only where relevant. Fix confirmed regressions through delegated implementation.
- [x] One fresh independent code/security/visual review, bounded fixes, narrow closure; no mandatory second whole-change review.
- [x] Lead runs node scripts/verify-local.mjs on final product source. No GitHub Actions. Resolve real failures; do not turn unavailable infrastructure into PASS.
- [x] Update old consumer matrices with provenance/link to the current evidence; record exact commands/results and limitations.
Release execution follows the verified candidate: fresh main check → commit/push/attached PR/merge → tree/ancestry/main synchronization → exact local release installation → post-release checks → removal of only this merged branch/worktree. The completed release record is written after merge into the durable HANDOFF; no pre-merge release completion is claimed here. Stop at A2.

## Stop conditions and review focus

Do not change protected schema, access, backend, storefront behavior, dependencies or Docker/deploy configuration to make UI tests pass. Investigate errors safely and continue unaffected work. Escalate only a proven protected decision/access gap. Never reset/stash/clean/rebase/force-push unrelated work. No prune/down -v.

Review high-risk inputs: hidden fields retaining existing values; missing/read-denied fields not becoming writable; late native events after tab/identity changes; parent stale and committed-but-readback-failed responses preserving input; unknown child type/items/settings preserved without normalization. Tests and actual runtime evidence must cover these boundaries as relevant to the active diff.
