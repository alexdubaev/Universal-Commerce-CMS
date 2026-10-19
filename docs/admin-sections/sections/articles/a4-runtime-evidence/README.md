# Actual A4 Directus evidence

**Current final acceptance: PASS.** See [A4 FINAL installed evidence](A4-FINAL.md), [final independent review](A4-FINAL-REVIEW.md) and [acceptance record](../A4-ACCEPTANCE.md). The following record is historical: its browser-substitution mode, Articles404 blocker and no-install statements do not describe the final installed runtime.

## Historical initial evidence

Mode: **candidate module substitution in an isolated browser against the existing own Directus 12.1.1 / PostgreSQL 17.11**. These are real native Directus screens/API interactions, not offline mockups. The candidate bundle was **not installed**; this is not production deployment. Public Articles gateway support in the mounted older backend remains blocked (404), so ready/merge is forbidden. See [acceptance record](../A4-ACCEPTANCE.md).

## Capture provenance

Private raw journals/requests remain outside Git under Windows Temp. Only synthetic screenshots and sanitized summaries are included here.

| Run | Included captures | Interpretation |
| --- | --- | --- |
| `83d9dc59-8684-4458-98e5-c99833ea9def` | list 1536/1024/390, create-known 1536/390, CAS409 1536/390, readonly-controlled 1536/390, error-controlled1536, native SEO, future status, unknown update | Broad run; writing width and two harness assertions failed then were closed below. Readonly/error are explicitly controlled browser responses. |
| `8122679d-7303-4bd9-ae68-d04b4b7976df` | main 1536/1024/390 and right panel open, material1536/1024/390, writing1536, own cover, relations1536/390, SEO1536/390, additional1536, unknown create1536/390 | Five narrow scenarios pass; source is candidate `6d97af8`. Covers exact HTML/JSON retention, writing width, synthetic relations, native SEO and uncertain create. |
| `bc13cf65-0fd1-4c3a-8a9c-a629f8a0dff7` | filters1536/390 | Reviewer CSS fix on candidate `144c26b`; desktop center/mobile bottom sheet geometry, no overflow and Apply/Cancel/Escape/focus pass. |

Desktop captures are 1536×1024; intermediate captures 1024×1024; mobile 390×844. `main-panel-open.png` shows the native right panel open at1536; the other main captures have it closed. Width assertions check document overflow. Later narrow runs intentionally avoid repeating unrelated successful mutations after scoped CSS fixes.

## Review and checks

One fresh independent code/visual reviewer found no confirmed P0/P1/P2 code defect. It compared approved desktop/mobile PNGs with actual list/main/material/writing/relations/SEO/create/readonly/conflict/panel/filter captures. The sole material visual discrepancy was filter positioning; its one bounded CSS fix received a narrow runtime closure. Native chrome, theme and metadata-driven editor controls account for remaining differences.

[Final local gate output](final-local-gate.txt) records `node scripts/verify-local.mjs` on product candidate `144c26b` before documentation-only commits. Confirmed result:262 backend/extension checks,36 storefront checks, audit0, build/type/canary,2 Chromium journeys. Focused Articles:22/22. Source/dist parity and whitespace checks pass. No unchanged product tests need another run for later evidence/docs commits.

The independently reproduced stock TinyMCE locale request returning HTML is recorded in runtime summaries as `knownNativeLanguageHTML`, with `Unexpected token '<'`; other page errors fail. No claim of a clean stock-runtime console is made.

`fixture-audit.json` verifies all exact IDs from18 private A4 journals:129 Articles,9 files,2 categories,2 products; **zero residual**. Journals were written before POST; cleanup deleted only exact owned IDs. The audit itself is read-only. No real Articles were changed or published.

## Screens

- [List desktop](list-1536.png), [mobile](list-390.png), [1024](list-1024.png).
- [Main desktop](main-1536.png), [mobile](main-390.png), [1024](main-1024.png), [right panel](main-panel-open.png).
- [Material desktop](material-1536.png), [mobile](material-390.png), [writing mode](writing-1536.png).
- [Relations](relations-1536.png), [mobile relations](relations-390.png), [SEO](seo-1536.png), [mobile SEO](seo-390.png).
- [Creation](create-known-1536.png), [mobile creation](create-known-390.png), [unknown create](unknown-create-390.png).
- [Filters](filters-1536.png), [mobile filters](filters-390.png), [CAS409](cas409-390.png), [readonly](readonly-controlled-390.png), [error](error-controlled-1536.png).

Remaining integration gate: safely update the existing protected test backend under separately approved scope, prove actual public draft/future/due exclusion/inclusion, then assess ready/merge. Do not infer that a GitHub merge deploys this bundle.
