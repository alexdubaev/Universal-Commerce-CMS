# Repository instructions

This repository is a reusable Directus commerce administration baseline. Each website must use its own Directus instance, PostgreSQL database, uploads, accounts, roles, credentials, and integration settings.

Before changing code, state the requested behavior, allowed files, protected areas, and verification. Keep edits within the declared scope. Directus schema, permissions, credentials, Docker and deployment configuration are protected unless the task explicitly includes them.

The source Deereshop repository and its running instances, databases, volumes, media, catalogue, credentials, and frontend are read-only. Never copy their content or instance identifiers. Read [ADR-002](docs/architecture/ADR-002-scope-locked-changes-and-content-only-releases.md) before code, schema, access, or infrastructure changes.

Only `dev/compose.yml` belongs to this development stack. Keep its project name, loopback-only port, and named volumes isolated. Do not run Docker commands against other Compose projects. Generated `dev/.env` stays ignored and must not be printed or committed.

Preserve registered Directus extension identifiers and public route contracts. Do not claim or implement missing G1/G2 behavior. Preserve third-party manifests and license notices when shipping built bundles.
