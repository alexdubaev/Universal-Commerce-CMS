# A1-UX categories — installed acceptance

Owner approved the shown proposal and autonomous checked merge/deployment on 2026-10-23. Target: the existing Windows local Directus at http://127.0.0.1:18056, project `universal-commerce-cms-dev`. A2 is excluded. A0 #15 and products #16 were already completed and accepted; their shared artifacts were preserved.

## Source and scope

Base: `ca03a0bb619b55e24b0084e4c84950c587b9ee61`. Category source and dist SHA-256: `3b5813fa18212865c6e950c2c457e84c81635575e867971a0acab408fb23ac75`.

The category source/dist pair, focused controller/native-adapter boundary tests, and this category documentation contain the A1 changes. The owner separately approved Next.js 16.3.8 → 16.4.1 in the two package manifests to resolve the mandatory audit failure. No storefront behavior, schema, permissions, credentials, Docker configuration, other editor, parent movement or category deletion UI changed.

## Deterministic checks

Lead ran `node scripts/verify-local.mjs` on the final product source: PASS. Backend: 309 tests; storefront: 36 tests; dependency audit: zero vulnerabilities; mock production build with TypeScript, deployment artifact/client-secret checks, and two Chromium journeys passed. No GitHub Actions were introduced or used. The focused category/A0 command also passed 62 tests. Category source/dist parity and `git diff --check` passed.

The fresh independent review found one P2: the site-effect notice omitted description, intro and order. It was fixed. The bounded comparison-format closure passed; no unresolved P0/P1/P2 remains. The lead additionally verified the later native inline-validation mapping with the adapter boundary test and real field rendering. See [review](REVIEW.md).

## Visual acceptance

The lead compared the installed candidate with the approved [separate mock proposal](ux-proposal/PROPOSAL.md). Native Directus shell, accepted list geometry, desktop filter panel and phone full-screen filters remain. Human labels, readonly parent/settings, publication dialog, single SEO editor and honest media limitation match the approved behavior. Native component appearance and the existing shell branding remain.

Real installed captures (not mockups), 1536×1024 and 390×844:

| State | Desktop | Phone |
|---|---|---|
| List | [image](runtime/screenshots/installed-list-1536.jpg) | [image](runtime/screenshots/installed-list-390.jpg) |
| Main | [image](runtime/screenshots/installed-main-1536.jpg) | [image](runtime/screenshots/installed-main-390.jpg) |
| Content | [image](runtime/screenshots/installed-content-1536.jpg) | [image](runtime/screenshots/installed-content-390.jpg) |
| Search and links | [image](runtime/screenshots/installed-seo-1536.jpg) | [image](runtime/screenshots/installed-seo-390.jpg) |
| Saved settings | [image](runtime/screenshots/installed-advanced-1536.jpg) | [image](runtime/screenshots/installed-advanced-390.jpg) |
| Publication | [image](runtime/screenshots/installed-publication-1536.jpg) | [image](runtime/screenshots/installed-publication-390.jpg) |
| Filters | [image](runtime/screenshots/installed-filters-1536.jpg) | [image](runtime/screenshots/installed-filters-390.jpg) |
| No results | [image](runtime/screenshots/installed-no-results-1536.jpg) | [image](runtime/screenshots/installed-no-results-390.jpg) |

All 16 image dimensions were checked. Document width equals viewport width at 320, 390, 1024 and 1536. Status text is 12px; published text/background is #17643f/#edf7f0 (contrast 6.54:1), draft #43546a/#f2f4f7 (7.02:1), archive #805015/#fff4e8 (6.29:1). This is targeted visual acceptance, not a WCAG certification or human novice test.

## Runtime evidence and release

Runtime scenarios and exact cleanup are recorded in the accompanying runtime reports. The opt-in probe uses real installed modules and native Directus components on Windows. Controlled network/403/acknowledgement faults are explicitly test transport faults, not claims that the server naturally produced those failures. No source modules were substituted in the browser.

[Consolidated evidence](runtime/results.json) records 12 accepted scenarios. This is explicitly a full run plus a bounded closure, not a single all-green full command: run `3beae68e-cb16-4430-973b-d77a53c882eb` passed all other scenarios and stopped the CAS case at a wrong probe selector. The product source was unchanged. CAS-only run `62d7182a-57d0-4103-882c-c571f8d676b6` then passed with the actual native checkbox, active-tab lifecycle, explicit Compare action and scoped status locator. Both runs verified exact fixture cleanup and zero uncaught page errors. Console resource errors were observed during deliberate denial, validation and lost-response faults; a zero-console-error claim is not made.

Accepted flows: eight sort directions across real 25-row pages and stable ID ties; list context; filters/focus and separate empty/error/denied states; scalar/SEO/unknown-field persistence; explicit publication and unknown-status preservation; native draft creation; uncertain-create retry blocking/recovery; address validation and real CAS409/reconciliation; lost/malformed/readback-failed update recovery; anonymous denial; native library selection/unlink preserving the owned file; and controlled navigation guard handling. Cleanup includes reserved IDs whose create response was lost.

Additional real installed fault/creation captures (owned synthetic records):

| State | Desktop | Phone |
|---|---|---|
| Address validation | [image](runtime/screenshots/category-validation-1536.png) | [image](runtime/screenshots/category-validation-390.png) |
| New draft | [image](runtime/screenshots/category-native-create-1536.png) | [image](runtime/screenshots/category-native-create-390.png) |
| Uncertain creation | [image](runtime/screenshots/category-native-create-uncertain-1536.png) | [image](runtime/screenshots/category-native-create-uncertain-390.png) |
| Uncertain update | [image](runtime/screenshots/category-uncertain-update-1536.png) | [image](runtime/screenshots/category-uncertain-update-390.png) |
| CAS comparison | [image](runtime/screenshots/category-conflict-1536.png) | [image](runtime/screenshots/category-conflict-390.png) |
| Controlled denial | [image](runtime/screenshots/controlled-403-1536.png) | [image](runtime/screenshots/controlled-403-390.png) |
| Controlled network error | [image](runtime/screenshots/controlled-error-1536.png) | [image](runtime/screenshots/controlled-error-390.png) |

The existing non-admin technical gateway was verified through assigned policies. A live Next.js route returned 200 and rendered the owned category heading, introduction and SEO. Gateway publication filtering excluded draft/archive. The category query has an existing 300-second cache and first-200 limit; immediate public cache invalidation and categories beyond that limit are not claimed. The initial real collection contained 21 categories. See [field consumers](FIELD-CONSUMERS.md).

No pre-existing manager-like role was available: manager-role acceptance is NOT RUN. Anonymous read/write denial, native Administrator flows and controlled UI denial were checked; no role was created or broadened. All runtime writes are journaled owned synthetic fixtures, never existing catalogue records. The temporary live Next server was stopped after verification; this release deploys Directus only.

Before installation, exact category artifacts were backed up outside the repository at `D:/codex/ucms-release-backups/a1-ux-a237a557-60c0-4348-b985-9b5b827b21d9`. Their baseline hash is `a76fed9f3125e6107aca407478bfa4f7406befbb2896c6106041a9209d239ed8`. The guarded `restore.mjs` checks runtime identity/current hash, restores only category src/dist, and restarts the own Directus container with `--restart`; it never restores database data. Backup integrity and rollback script syntax were checked; rollback was not applied. Final merge/deployment identity and cleanup are supplied in the release HANDOFF.
