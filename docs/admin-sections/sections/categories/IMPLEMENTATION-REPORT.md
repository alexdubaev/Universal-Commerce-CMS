# A1 UX category implementation report

Base: `ca03a0bb619b55e24b0084e4c84950c587b9ee61`
Branch: `codex/a1-ux-categories-issue17`
Worktree: `D:/codex/ucms-a1-ux-issue17`

## Changes

- Kept the list on supported title, address, order, and modified sorts; removed the ineffective homepage column/filter and corrected the shifted desktop widths. Search, status/parent/indexability filters, paging, and session list context remain.
- Kept empty catalogue, no results, denied access, and request failures distinct. Added human field labels, focused field errors, safe duplicate-address recovery, and read-only parent name/top-level context.
- Publication now uses a centered responsive three-choice dialog with heading hierarchy, visible selected card/radio state, effects, current state selected, keyboard navigation, and a staged apply-to-form action. Save remains separate. Empty native field groups are omitted when a tab has no readable fields, leaving the human readonly summary unobscured. New categories are labeled “Создать черновик”; uncertain create responses remain separate from read failures, block retry, and route toolbar verification to bounded address recovery. Ordinary edits preserve unknown existing statuses.
- Kept the image picker and editable image description in media context, with the precise note that the current site does not render category images. Inactive settings use readable saved/not-saved summaries with current storefront limits; creation and update timestamps show their real values. SEO remains one scalar title/description editor, preview, and indexability control.
- Failed post-save readback keeps the submitted input, reports failure, and blocks resubmission until explicit successful recovery or discard. Recovery reapplies only submitted scalar fields over freshly read data, preserving fresh server SEO JSON. Confirmed duplicate-address rejection refreshes the CAS baseline while keeping the address editable and avoiding uncertain-write lockout. Required, address-format, and duplicate-address validation now use the existing adapter-supported `required`, `regex`, and `unique` types so errors appear inline on the field.

## Regression evidence

The first controller regressions showed missing publication intent methods, false saved state after failed readback, and duplicate-address rejection left in uncertain-write state. Follow-up boundaries cover status intent/busy guards, new-record duplicate rejection, readback retry/discard, server-normalized acknowledgements, fresh SEO JSON preservation, malformed legacy readonly JSON not blocking ordinary saves, and human comparison labels for publication/indexability values and native-field validation mapping.

## Verification

- `node --test directus/extensions/deere-shop-product-editor/test/sections/categories.test.mjs` — PASS, 25 tests.
- `node --test directus/extensions/deere-shop-product-editor/test/admin-state.test.mjs` — PASS, 37 tests.
- Category source/dist parity — PASS (also asserted by category test).
- `git diff --check` — PASS.

## Limits and remaining acceptance

This worker did not touch the Directus runtime, database, Docker, or browser. Native component rendering, screenshots at 1536×1024 and 390×844, runtime persistence/CAS scenarios, installed bundle hashes, and the repository publication gate remain with the lead-owned runtime and release phase. Prototype screenshots are mockups, not evidence of the installed UI.
