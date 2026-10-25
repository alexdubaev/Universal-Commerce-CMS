# A4-UX-FIX Articles — proposal, awaiting approval

2026-10-25. User requires actual Before / rendered isolated After, followed by an explicit approval stop. No implementation, publication or installation has been performed.

## Source and predecessor verification

- Fresh origin/main / base: 6db7cb33f0ed240d0445ba7a90cfbc21a9fec382.
- Own branch: codex/a4-articles-ux-issue20.
- Own worktree: C:/Users/Alexandr/.codex/worktrees/a4-articles-ux-issue20/Universal Commerce CMS.
- Read AGENTS.md, ADR-002, CONTRACTS, DESIGN-SYSTEM, testing.md, current issues #20/#22 (including empty comments), A3 #19 and relevant article contracts/source/consumers.
- PRs #23/#24/#25/#26/#27 are merged. Reviewed A0/product handoffs, A1/A2 durable release handoffs, A3 acceptance and durable HANDOFF.
- Current A3 installed source release: 6db7cb33f0ed240d0445ba7a90cfbc21a9fec382. All nine product-editor dist files match this fresh main byte for byte. Served aggregate SHA256: d8a9f876785624c5d32b2805642c3240e5f8a1897c1f5341e93374b5a0f09d1c, matching A3 release HANDOFF.

## Confirmed release target

Windows Directus 12.1.1, http://127.0.0.1:18056, Compose universal-commerce-cms-dev, container universal-commerce-cms-dev-directus-1. Docker labels/image/loopback/mounts inspected. Existing PostgreSQL and uploads volumes retained. Runtime extension bind remains C:/Users/Alexandr/.codex/worktrees/storefront-directus-acceptance/Universal Commerce CMS/directus/extensions. Main checkout is D:/codex/Universal-Commerce-CMS-main. These locations differ; do not delete the runtime worktree or overwrite unrelated dirty work. Existing local storefront http://127.0.0.1:3000 is the A3 integration observer, not a newly chosen production server. No public production target is established.

## Actual Before provenance

The current article collection is empty. Before images show the actual installed new form, with unsaved neutral demonstration input, native tabs/dialogs and existing synthetic relation candidates. No article was created, saved or published. No HTTP response/module substitution was used. A browser guard aborted non-read requests other than authentication, including native telemetry PATCH. No shared database or installed artifact was modified.

Real unsaved relation observation: selecting Synthetic Components and Synthetic test part 01, then searching for Synthetic Tools / Synthetic test part 15, replaces selected titles with identifiers and removes their unlink buttons. SEO duplicate native panel and English plugin text are visible. Current toolbar, link, image and source dialogs have Russian Directus labels. Native file-input accessibility text is browser-owned; image dialog controls are icons. No table tool is configured. Repeated material open produced no new captured console/page error; the historically reported language script issue is not asserted fixed.

No existing article exists to reproduce save busy/conflict states without a write. Those cases are shown only as proposed states and require regression fixtures after approval.

## Proposed scope and acceptance

Keep the existing module/shell, native rich HTML editor, native media library, A0 state/CAS and native origin authorization. Change only articles.js src/dist, focused article tests and article documentation. Any extracted article helper must be separately declared within this same narrow surface before editing. Preserve publication backend, schema, permissions, auth/credentials, dependencies, infrastructure and deployment configuration, storefront and protected vendor/interfaces. No A5 work.

One primary search title/description/image input preserves projections, fallback and unknown values. Selected relations resolve independently from candidate search with bounded field-limited requests under current permissions; unavailable values stay intact without unsafe unlink. Main dates show time and timezone and explain separate publication. Hide technical structural/translation values while preserving bytes. Comparison shows meaningful changed fields and safe plain-text fragments; comparison/reconcile do not write. HTML stays byte-identical for cover/alt/relation/search-only changes, native hydration and tab/dialog visits. Error validation retains editable input and releases saving; correction permits another save, without removing projection consistency checks.

After approval: first behavioral reproductions, delegated minimal implementation, narrow tests, actual Windows Directus own-fixture checks (HTML/unknown data, native editing/dialogs, relation/access, dates/publication, conflicts/uncertain responses), desktop/mobile visual comparison, one independent review and bounded fixes, node scripts/verify-local.mjs, exact candidate/source checks, authorized commit/push/PR/merge, guarded backup/artifact rollback and local deployment, installed release/read-only smoke/screenshots, own cleanup/HANDOFF. No second owner acceptance gate.

## Proposal assets

proposal.html is a separate throwaway HTML mockup, not product implementation. SHA256: de95156b01bbfdf3f72a800b388abc7919908a70a2733d6ff8c81f23a0b70daf.

Static loopback-only preview: http://127.0.0.1:18120/proposal?screen=main. It serves only this fixed file, without directory browsing, external resources, API access or write endpoints. Query screens: main, material, relations, seo, other, error, comparison; main&status=scheduled.

Canonical final screenshots: D:/codex/Universal Commerce CMS/output/a4-ux-issue20-proposal/*.png. Before images were captured on Windows; After images are rendered mockup screenshots via the permitted HTTP surface. Exact 1536x1024 / 390x844 image dimensions verified. Earlier inconsistent in-app JPEG captures are retained only as diagnostics in capture-diagnostics/ and are NOT canonical references. The unavailable relation chip in After is an additional illustrative state, not an existing saved article.

Product tests/review/deploy NOT RUN before approval. Current tracked application diff is empty. Own branch/worktree and proposal artifacts retained for the approval continuation.
