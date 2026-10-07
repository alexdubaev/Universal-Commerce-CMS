# Repository instructions

This repository is a reusable Directus commerce administration baseline. Each website must use its own Directus instance, PostgreSQL database, uploads, accounts, roles, credentials, and integration settings.

Before changing code, state the requested behavior, allowed files, protected areas, and verification. Keep edits within the declared scope. Directus schema, permissions, credentials, Docker and deployment configuration are protected unless the task explicitly includes them.

The source Deereshop repository and its running instances, databases, volumes, media, catalogue, credentials, and frontend are read-only. Never copy their content or instance identifiers. Read [ADR-002](docs/architecture/ADR-002-scope-locked-changes-and-content-only-releases.md) before code, schema, access, or infrastructure changes.

Only `dev/compose.yml` belongs to this development stack. Keep its project name, loopback-only port, and named volumes isolated. Do not run Docker commands against other Compose projects. Generated `dev/.env` stays ignored and must not be printed or committed.

Preserve registered Directus extension identifiers and public route contracts. Do not claim or implement missing G1/G2 behavior. Preserve third-party manifests and license notices when shipping built bundles.

## Branch workflow

`main` is the integration baseline. For each new repository-changing task:

1. Fetch the remote and create a temporary task branch from the latest `origin/main`. Use the platform's existing isolated workspace when available. Do not start a new task from an old task/integration branch; reuse a branch only when continuing that same unfinished task.
2. Make only the agreed changes, commit them, run the applicable tests and checks, and resolve blocking review findings.
3. When the work is finished and verification passes, push the temporary branch and merge its reviewed pull request into `main`. Completing an authorized task includes this integration by default; do not ask for repeated merge permission unless the user explicitly requested a draft, an unmerged branch, or another stopping point.
4. If `main` advances, incorporate its latest changes and verify the resulting candidate before merging. Do not merge with unresolved failures, unknown changes or merge conflicts. Do not force-push or discard another person's work.
5. After the merge, fetch and synchronize the local `main`, verify the merge result, and report the commit/PR and checks. Remove only the temporary branch created for this task after confirming it is merged and no longer needed; preserve other branches and active worktrees.

A merge into `main` is not a production deployment. Production deployment and changes to protected schema, access, secrets and infrastructure still require their own explicit scope. Historical handoffs describe the authorization and results of their original tasks; an explicit newer user instruction takes precedence.
