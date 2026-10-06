# Integration handoff (in progress)

Current phase and open findings are in [00-STATUS](00-STATUS.md) and [09-FINDINGS](09-FINDINGS.md). Decisions are in [10-DECISIONS](10-DECISIONS.md); implementation ownership in [12-IMPLEMENTATION-PLAN](12-IMPLEMENTATION-PLAN.md); guarded transport contract in [13-GATEWAY-CONTRACT](13-GATEWAY-CONTRACT.md).

Verified original PR head: `0f883b26e5003cb00bfad1ed7dc2586268182052`. Integration branch: `feat/storefront-directus-acceptance`. Preparation commits: `f203169` timestamp mapping, `644ec9c` explicit live-mode guard, `c728306` baseline/audits/plan.

Wave 1 complete; backend gateway, frontend readiness/transport and bounded API guard implementation are running in isolated managed worktrees. Fixtures, identity and live tests have not been provisioned yet. Existing local stack is the only permitted runtime; no schema/version changes. Synthetic test records are explicitly authorized; true catalog and production acceptance are deferred.

Do not treat this in-progress document as completion. PR #1 stays Draft; no merge/deploy approval. Final tests, final SHA, commits, security/runtime/performance evidence and remaining work will replace this section after integration/review.
