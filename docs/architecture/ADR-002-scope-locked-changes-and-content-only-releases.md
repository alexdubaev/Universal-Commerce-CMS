# ADR-002: Scope-locked changes and content-only releases

## Status

Accepted for the standalone commerce CMS baseline.

## Decision

Content edits belong to the site's own Directus instance and should not require code deployment. A code or schema change must declare its requested behavior, allowed files, protected areas, and verification before editing. Stop if an undeclared file or protected area enters the diff.

Each website owns a separate Directus instance, database, uploads, roles, users, credentials, and integration settings. The shared CMS repository contains reusable code and neutral demonstration content only. Site-specific domains, branding, catalogue data, leads/orders, public frontend settings, and external callbacks belong to a selected site profile or that site's runtime environment.

Security settings, Directus roles/permissions, credentials, schema, dependencies, Compose, and deployment configuration remain read-only unless the task explicitly authorizes that exact surface. Do not point standalone tooling at another repository or instance. The development stack is limited to the `universal-commerce-cms-dev` project, loopback port `18056`, and its named database/uploads volumes.

The default Directus Core bootstrap creates only instance-local asset folders and uses the existing Administrator account. It does not install business roles or public/API permissions. Directus 12.1.1 Core rejects the folder-scoped custom permission rules required by the strict access blueprint. The full `access:apply` command is an explicit opt-in for instances entitled to custom permission rules; it must preserve the blueprint's validation and folder presets. If Directus rejects an apply, inspect its partial-state report before any cleanup or retry.

## Consequences

Changes remain reviewable and site data cannot silently enter shared releases. Deployments and site-specific integrations require their own scoped work and verification. A clean local bootstrap is not production deployment acceptance.
