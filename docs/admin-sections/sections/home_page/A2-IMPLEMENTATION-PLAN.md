# A2 implementation and acceptance plan

```markdown
BASE: c594fd9ac874cd38cfb71abeedf932cfd785de55 (fresh origin/main, 2026-10-18)
Branch: codex/a2-home-editor
Worktree: D:/codex/worktrees/ucc-a2-home-editor
Approved authority: a2-approved/START-HERE.md and unchanged HTML/TASK.

Requested behavior
- Edit the existing home_page singleton through five approved native Directus tabs.
- Reuse A0 and PageSectionEditor. Parent CAS, child CAS and versions stay separate.
- Status/source_page/system fields readonly; preview/version actions blocked absent proof.

Allowed files
- Extension src/sections/home_page.js and identical dist copy; focused controller tests.
- Small index registration in a separate integration commit owned by the lead.
- Extension verification/a2-home-runtime.mjs and documents in this home_page directory.
- A0/PageSectionEditor source/dist and focused behavioral regressions only for a
  concrete documented blocker, with preserved defaults and existing editor checks.

Protected
- Schema, permissions/access, credentials, API/hooks, storefront, products/categories,
  third-party code/dependencies, Docker/dev/deployment configuration, other worktrees.
- Deereshop and every unrelated instance/data set are read-only.

Outcomes and execution
1. Read-only scout: live own :18056 metadata, singleton shape/cardinality, effective
   and item permissions, native plugins, demo-data provenance and field consumers.
   STOP for incompatible schema or no safe owned runtime baseline.
2. One worker: native singleton adapter, CAS delta/refetch/reconcile, hero/SEO/media,
   five tabs, separate persisted children and route/unload guards. Add behavioral
   tests for meaningful permission/race/validation/conflict boundaries first.
3. Lead: inspect actual diff, integrate only home_page registry, run focused A0,
   child, product and category checks plus node scripts/verify-local.mjs.
4. Runtime probe: exact owned IDs and baseline journal, CAS save/restore of the
   neutral own singleton, separate child save, 409 and uncertain acknowledgements,
   native files/SEO, permissions/errors, paging/stale responses/dirty navigation.
   Browser-only bundle substitution preserves the installed container bundle.
5. Actual Directus screenshots at 1536x1024, 1024 and 390x844; unchanged HTML
   reference renders stored separately. Fresh independent reviewer compares both
   and records mismatch matrix. No unresolved significant UX or P0/P1/P2 findings.
6. Green exact candidate only: commit, push, reviewed PR, merge; verify main tree
   and ancestry and retained A2 materials; close PR #8 as superseded afterward.
   Synchronize local main, delete only own merged branch and clean worktree.

Verification
- node --test directus/extensions/deere-shop-product-editor/test/sections/home_page.test.mjs
- Relevant admin-state/page-sections/editor-state/categories tests for shared/index diff.
- node scripts/verify-local.mjs (single local release gate; no hosted CI).
- Opt-in own Directus runtime command and screenshot/cleanup evidence in final report.
- Source/dist byte equality, git diff --check and reviewed protected-file diff.

Deployment
No confirmed production target/update/rollback procedure: DEPLOY BLOCKED.
Mockup, test-browser candidate loading, installed bundle and production are distinct.

Continuation
One task/one temporary branch/one verified PR from fresh main; one implementation
owner and independent review. Only green functional AND actual visual acceptance
authorizes autonomous publication. Never delete another agent's work. Pass these
rules onward in a copyable HANDOFF. Stop after A2; do not start Pages.
```
