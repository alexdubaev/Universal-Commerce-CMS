PHASE: Wave 2 implementation
STATUS: IN PROGRESS

CURRENT HEAD: c728306b1e9ce67f638b8cfe783e36bf5cb36eb4
BRANCH: feat/storefront-directus-acceptance

DONE:
- Required handoff/contracts/ADR read; PR fetched and isolated worktree created.
- Runtime baseline and all seven audit reports recorded; two reviewed fixes committed.
- User selected synthetic acceptance records in the existing local CMS; real catalog later.

IN PROGRESS:
- Isolated backend gateway, frontend readiness/transport, and API guard streams.
- Local fixture/provisioning and live E2E follow as dependencies become available.

BLOCKERS:
- Native filtered policy unsupported; guarded endpoint-only alternative selected, not yet verified.
- Synthetic fixtures and zero-grant identity not provisioned yet.

P0:
- None confirmed.
P1:
- Timestamp mismatch fixed; pending final review/commit.
P2:
- Explicit-live silent mock fixed; pending final review/commit.
- Hydration readiness/explicit skip-link tabindex fixes required.
- Stream body cap, asset revocation/public-folder gate and brand-label correctness required.

NEXT:
- Integrate reviewed logical commits with targeted tests; provision only the existing local test stack.
- Verify native API denial, live synthetic E2E and bounded performance; retain Draft/no production approval.
