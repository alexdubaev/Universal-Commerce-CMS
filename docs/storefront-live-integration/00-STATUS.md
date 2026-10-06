PHASE: Wave 2 implementation
STATUS: IN PROGRESS

CURRENT HEAD: 4b3897f (latest implementation; subsequent documentation commits may follow)
BRANCH: feat/storefront-directus-acceptance

DONE:
- Required handoff/contracts/ADR read; PR fetched and isolated worktree created.
- Runtime baseline and all seven audit reports recorded; isolated implementation worktrees active.
- Timestamp, explicit-live mode, byte-bounded bodies, asset revocation, brand labels, transport and hydration fixes integrated.
- Storefront 57 unit tests, TypeScript and mock production build PASS; client canary absent.
- User selected synthetic acceptance records in the existing local CMS; real catalog later.

IN PROGRESS:
- Backend gateway, fixture/provisioning tooling and indexability correction in parallel.
- Unchanged three-browser mock regression running; live E2E follows reviewed gateway/fixtures.

BLOCKERS:
- Native filtered policy unsupported; guarded endpoint-only alternative selected, not yet verified.
- Synthetic fixtures and zero-grant identity not provisioned yet.

P0:
- None confirmed.
P1:
- None remaining in integrated adapter changes; whole-change review pending.
P2:
- Integrated fixes await browser/live acceptance and fresh whole-change review.
- Public-folder backend gate and sitemap indexability correction in progress.

NEXT:
- Integrate reviewed logical commits with targeted tests; provision only the existing local test stack.
- Verify native API denial, live synthetic E2E and bounded performance; retain Draft/no production approval.
