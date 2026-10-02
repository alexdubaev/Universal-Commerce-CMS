# Standalone baseline

The reusable unit is versioned CMS code plus a site profile. Runtime state is never shared between websites. The local development stack uses project name `universal-commerce-cms-dev`, PostgreSQL 17, Directus 12.1.1, loopback-only port `18056`, and its own named volumes.

Setup order is schema/profile seed, Studio metadata, neutral project settings, workspace, native versioning, local asset folders, clean-database constraints, then product-editor metadata. The default Core bootstrap creates only local folders and uses the Administrator account; full business role/permission setup is an explicit opt-in for an instance entitled to custom permission rules. Instance folder and workspace identifiers are generated into ignored `dev/.env` and remain stable across repeated setup. Draft seed records are looked up by slug or singleton state and are not overwritten on later runs.

Live preview callbacks, public frontend credentials, notifications, revalidation, analytics, and production integrations remain per-site configuration. Set up each only in an explicitly scoped profile task.
