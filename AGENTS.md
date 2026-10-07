# Repository instructions

This repository is a reusable Directus commerce administration baseline. Each website must use its own Directus instance, PostgreSQL database, uploads, accounts, roles, credentials, and integration settings.

Before changing code, state the requested behavior, allowed files, protected areas, and verification. Keep edits within the declared scope. Directus schema, permissions, credentials, Docker and deployment configuration are protected unless the task explicitly includes them.

The source Deereshop repository and its running instances, databases, volumes, media, catalogue, credentials, and frontend are read-only. Never copy their content or instance identifiers. Read [ADR-002](docs/architecture/ADR-002-scope-locked-changes-and-content-only-releases.md) before code, schema, access, or infrastructure changes.

Only `dev/compose.yml` belongs to this development stack. Keep its project name, loopback-only port, and named volumes isolated. Do not run Docker commands against other Compose projects. Generated `dev/.env` stays ignored and must not be printed or committed.

Preserve registered Directus extension identifiers and public route contracts. Do not claim or implement missing G1/G2 behavior. Preserve third-party manifests and license notices when shipping built bundles.

## Branch workflow

`main` is the integration baseline. For each new repository-changing task:

1. Fetch the remote and create a temporary task branch from the latest `origin/main`. Use the platform's existing isolated workspace when available. Do not start a new task from an old task/integration branch; reuse a branch only when continuing that same unfinished task.
2. Make only the agreed changes, run `node scripts/verify-local.mjs` locally on the final candidate, resolve blocking review findings, and commit the checked changes. Re-run affected checks if the candidate changes.
3. Before every push or PR merge into `main` (called master in conversation), complete the local verification gate for the exact candidate. Push the temporary branch and merge its reviewed pull request into `main`; GitHub Actions is not a gate. Completing an authorized task includes this integration by default; do not ask for repeated merge permission unless the user explicitly requested a draft, an unmerged branch, or another stopping point.
4. If `main` advances, incorporate its latest changes and verify the resulting candidate before merging. Do not merge with unresolved failures, unknown changes or merge conflicts. Do not force-push or discard another person's work.
5. After the merge, fetch and synchronize the local `main`, verify the merge result, and report the commit/PR and checks. Remove only the temporary branch created for this task after confirming it is merged and no longer needed; preserve other branches and active worktrees.

A merge into `main` is not a production deployment. Production deployment and changes to protected schema, access, secrets and infrastructure still require their own explicit scope. Historical handoffs describe the authorization and results of their original tasks; an explicit newer user instruction takes precedence.

## Local verification and test policy

All automated checks run locally. Do not create or restore GitHub Actions workflows, hosted CI/CD, remote test jobs or automatic deployments unless the user explicitly changes this policy. Historical CI reports are records, not instructions to use remote runners.

Run `node scripts/verify-local.mjs` from the repository root before every push to `main` and before integrating a temporary branch. It runs backend and storefront integration tests, the small domain-unit set, TypeScript, one dependency audit, a mock production build, deployment-artifact and client-secret checks, and two short critical Chromium E2E scenarios. After merging, verify ancestry and that the resulting tree matches the locally checked candidate; do not run remote CI.

Prefer backend handler/service integration tests that exercise externally meaningful behavior: authorization, publication, idempotency, concurrent writes, CAS conflicts and asset lifecycles. Retain only a few unit tests for critical domain rules that integrations cannot cheaply isolate. E2E must stay short and simple, covering only critical user journeys in one browser; add other browsers or runtime checks only when a specific change requires them.

Do not add source-text/JSX/CSS snapshots, exact helper-call counts, tests of constant configuration, repeated browser matrices or tests that merely mirror an implementation. Remove obsolete tests and their helpers rather than skipping or quarantining them. Keep checks for concrete regressions and do not replace useful safety coverage with a smaller count alone.

The opt-in live probe is for explicitly authorized changes to an own runtime. It may write owned fixtures or restart the storefront and is not part of the routine local gate. See [local verification and test review](docs/development/testing.md) for commands and scope.
