PHASE: Wave 2 implementation
STATUS: IN PROGRESS

CURRENT HEAD: 0f883b26e5003cb00bfad1ed7dc2586268182052 (two bounded fixes uncommitted)
BRANCH: feat/storefront-directus-acceptance

DONE:
- Required handoff/contracts/ADR read; PR fetched and isolated worktree created.
- Runtime baseline recorded; timestamp and explicit-live config fixes pass first review.
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
