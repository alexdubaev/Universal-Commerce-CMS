# A4 FINAL — installed native evidence

Final product candidate `198e1904edbce83f433b7c4f4f03cf4a7a49d266`, Windows test project `universal-commerce-cms-dev`, Directus 12.1.1 / PostgreSQL 17.11. All captures below are the actual installed native extension. No extension/module source interception or offline mock was used. Only synthetic content appears in the captures.

## Provenance and bounded closures

| Private run | Scope and outcome |
| --- | --- |
| `032fe1fb-6ee6-47b1-919f-501915756467` | Broad native acceptance before the two review fixes. HTML typing/source dialog, tab retention, publication separation, unknown save, controlled readonly/error passed. Three private harness assertions required bounded closure. |
| `25ea0bbd-4bff-43ff-bb89-196733f0da86` | Final installed source after review fixes. Mobile list context, real CAS409, main/panels, filters, cover/HTML/M2A preservation, SEO JSON and uncertain native create passed. Relation/media helper assertions were closed below. |
| `2460d77a-dd93-4435-aabf-f6913ce44d16` | Four of four targeted scenarios passed: cover/unlink preservation, relations/SEO/additional, native draft UTC create/double-click, complete editor/public-gateway publication lifecycle. |

Together these close 16 logical scenarios, not a single uninterrupted green run. Earlier setup/selector failures were cleaned by exact journal ID. Readonly/list503 and lost acknowledgements are controlled responses; real 409 and successful writes use actual Directus. No new restricted role was created.

## Final native captures

- List: [1536](final-list-1536.png), [1024](final-list-1024.png), [390](final-list-390.png).
- Main: [1536](final-main-1536.png), [1024](final-main-1024.png), [390](final-main-390.png), [native right panel open](final-main-panel-open.png).
- Material: [1536](final-material-1536.png), [1024](final-material-1024.png), [390](final-material-390.png), [writing mode](final-writing-1536.png).
- Relations: [1536](final-relations-1536.png), [390](final-relations-390.png). SEO: [1536](final-seo-1536.png), [390](final-seo-390.png).
- Create: [1536](final-create-known-1536.png), [390](final-create-known-390.png). Filters: [1536](final-filters-1536.png), [390](final-filters-390.png).
- Conflict: [1536](final-cas409-1536.png), [390](final-cas409-390.png). Controlled [readonly mobile](final-readonly-controlled-390.png), [list error](final-error-controlled-1536.png).

Desktop is 1536×1024, intermediate 1024×1024, mobile 390×844. Material/readonly/error captures are from the successful portions of the broad installed run; these screens were unaffected by the two bounded fixes. Other captures use final installed source. Native viewport overflow checks passed. Approved offline references and previous accepted captures were compared by the [independent reviewer](A4-FINAL-REVIEW.md).

Final local product gate: [recorded output](final-installed-local-gate.txt), 263 backend/extension checks, 36 storefront checks, audit zero, build/type/token checks, two Chromium journeys. Documentation-only changes after this gate do not alter tested product bytes.

Final independent read-only audit: [sanitized cleanup](final-fixture-audit.json), 153 exact IDs across ten new journals, zero residual. Journals, requests, credentials and backup files remain private outside Git. Images, configuration, mounts and schema/roles remained unchanged; only the declared API files and two Articles source/distribution files were updated. Actual API rollback and exact UI restore copies were verified. Production deployment was not performed.

Known stock TinyMCE ru-RU script error remains nonblocking: actual HTML typing, source editing and saves passed. The legacy M2A discriminator projection is not repaired or used by A4; physical junction rows were preserved and audited.
