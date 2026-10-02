# Standalone Universal Commerce CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. The repository teamlead workflow supplies bounded workers and independent reviewers. Steps use checkbox syntax.

**Goal:** Extract the approved Directus administration into an independently runnable, neutral commerce CMS and push its reviewed baseline to the supplied GitHub repository.

**Architecture:** A new repository contains shared extensions and schema/Studio/access tooling, with a neutral commerce profile. Each website runs its own Directus, PostgreSQL, files, credentials and integrations. The first local stack uses entirely new volumes and no public frontend.

**Tech Stack:** Directus 12.1.1, PostgreSQL 17, Node.js >=20, native ES modules, Docker Compose.

**Spec:** ../specs/2026-10-02-standalone-cms-design.md (approved by the user's “Переноси” instruction).

## Global Constraints

- Destination: `D:/codex/Universal Commerce CMS`, branch `codex/bootstrap-standalone-cms`; source commit `4b241f0f6fb6c56002d18621af24cc10069c02f5` is read-only.
- Allowed destination files: `AGENTS.md`, `.gitignore`, `.gitattributes`, `README.md`, `SOURCE-ORIGIN.md`, `directus/package.json`, selected `directus/schema/*`, `directus/access/*`, `directus/studio/*`, `directus/extensions/*`, `directus/test/*`, selected SQL constraints under `directus/migrations/*`, `profiles/commerce/*`, `profiles/deereshop/README.md`, `dev/*`, `docs/architecture/*`, `docs/admin-sections/**`, and the present specification/plan. No files outside this list are changed.
- Git text files use LF line endings so the material manifest and source/dist checks remain portable on Windows clones. Binary assets retain their bytes.
- Extension closure: commerce-api, commerce-integrity, deere-shop-product-editor, deere-shop-search, deere-shop-product-gallery-preview, deere-shop-image-contain when referenced by metadata; required SEO and Flexible Editor bundles with original manifests/licenses.
- Preserve `/commerce`, collection names and registered interface/module IDs. Preserve CAS, permissions and existing editor behavior; do not invent missing G1/G2 contracts.
- Do not copy source `.env`, real content/assets, runtime fixtures, database dumps, snapshot data containing instance values, node_modules, importer, SEO worker, theme or frontend. Synthetic demonstration content is draft and resides in the commerce profile.
- New stack project `universal-commerce-cms-dev`, loopback port 18056, dedicated database/uploads volumes. Existing containers/volumes and all source files are protected.
- Local generated environment is ignored and never staged or printed. No admin token in browser code. External preview/revalidation/notification integrations stay disabled.
- Destination GitHub repository is public: inspect the full candidate tree and preserve third-party attribution before push. No forced Git operations.

## Review Focus

- Fresh empty database: schema, required singleton fields, hooks, relationships and plugins must install without source data or old UUIDs.
- Per-instance access: folder IDs and policy ownership resolve locally, repeated setup is safe, public access remains closed.
- Dependency closure: every non-native interface referenced by Studio has an installed matching extension; tests run without the frontend repository.
- Saving products: CAS conflicts and failed media reads preserve input; draft creation/save survives a fresh reload.
- Isolation: all commands/configuration target the new stack; no source credentials, data, absolute operational paths or existing volumes enter the new project.

## Runtime ruling — Directus edition compatibility

Directus 12.1.1 in the fresh instance rejects folder validation/presets in business-policy permissions with `RESOURCE_RESTRICTED: custom_permission_rules_enabled`. Primary evidence is the installed permission service and entitlement helper, plus the failed access setup request. Stripping restrictions would broaden file access.

Ruling: the default development bootstrap provisions local folders and uses the existing Administrator account, leaving business-policy installation as explicit opt-in for an entitled instance. The full access blueprint remains strict; anonymous access remains closed. This changes first-run role availability, not the intended business-policy permissions. Cost: role-specific manager workflows and a frontend API account require a later edition/configuration decision. Clean up only the unassigned partial API role/policy created by this fresh failed bootstrap, after verifying no users reference them. No licensing bypass or source-instance change is allowed.

Review ruling: scope Content Manager and SEO Manager file reads, and Content Manager file updates, to the instance's Public folder. The extracted unrestricted file permissions exposed private sales attachments despite these roles having no lead access. Restricting the destination blueprint implements the intended content/sales separation within the already approved new-instance access scope; it grants no new privileges. The source blueprint and existing instances remain read-only. Cost: editorial assets must reside in Public; this matches their existing upload preset and editor folder configuration. Regression tests must prove private attachments cannot be accessed or moved by those business policies.

UI acceptance ruling: adapt the product grid's existing narrow-layout breakpoint to the editor container width as well as the viewport. In the new native Studio, open sidebars reduce a 1280px desktop viewport to roughly 650px of editor content; the original viewport-only rule keeps the 390px media column and causes inputs to overlap. Keep the approved wide layout and existing mobile behavior, using container queries for narrow editor space. Cost: with both sidebars open, media moves below the form until enough editor width is available. No field, save, route or schema contract changes.

### Task A: Runnable neutral CMS baseline

**Files:** The allowed root files, selected `directus/**`, `profiles/**`, `dev/**`, and `docs/architecture/**`. No `docs/admin-sections/**` ownership.

**Interfaces:** Preserve `schemaBlueprint`, `DirectusAdminClient`, `applyBlueprint`, Studio/access entry points, product editor routes and API payloads `{expected, changes}`. Introduce `profiles/commerce/profile.mjs` and `demo-content.mjs`; schema tooling consumes neutral seed/configuration. Expose documented package scripts for tests and schema/Studio/access/bootstrap. The new Compose file consumes only `dev/.env`.

- [x] Inventory tracked source files and their import closure; record every extracted file in SOURCE-ORIGIN.md. Locate actual server tests rather than assuming extension-local filenames. Extract their bounded dependencies into standalone test paths.
- [x] Add meaningful tests for neutral profile required fields, installed interface closure, locally resolved asset folders, and Compose isolation. Verify failures against initial absent implementation where practicable.
- [x] Copy only selected tracked implementation and regression tests; remove source seed/default contacts/branding from executable configuration. Keep historical machine IDs only where compatibility requires them.
- [x] Provide idempotent fresh-instance schema/Studio/access setup. Preserve constraints needed by the existing contracts; use only applicable clean-database SQL, not old content migration jobs. Do not carry source instance UUIDs into access or dashboard configuration.
- [x] Implement isolated Compose, ignored local environment generation and bootstrap commands. Bind HTTP to `127.0.0.1:18056`; pin Directus 12.1.1/PostgreSQL 17; mount complete extension closure. Enable extension auto reload only for this new dev instance.
- [x] Run `node --test` from `directus`, including the 16 product editor state tests and extracted server regression tests. Run Compose config validation without printing resolved secrets. Return exact commands/results and unresolved runtime limitations; do not commit yet.

**Acceptance:** A self-contained testable project with neutral draft content and documented fresh-instance startup; no dependency on source paths or site data.

**STOP:** If a necessary source file is untracked, a third-party license is absent, protected source state must change, or a missing contract requires a behavior redesign, report the exact blocker to the lead.

### Task B: Portable section design/specification materials

**Files:** Only `docs/admin-sections/**`.

**Interfaces:** Consume the completed `directus-admin-plan-2026-10-02` artifact package. Future implementations remain under `directus/extensions/deere-shop-product-editor`; no new custom section implementation is part of this task.

- [x] Copy the 14 section specifications, launch briefs, field maps, mocks, supporting records, design system and reference visuals. Exclude runtime captures/secrets and obsolete nonportable generators.
- [x] Update operational paths to the destination repository and source/base instructions to the extracted baseline. Preserve factual historical provenance with a clear label. Make launch briefs require clean branch, current destination HEAD, A0 prerequisites and their individual scope before execution.
- [x] Update material manifest after adaptations. Verify all local Markdown links, 14 section packages and mockup rendering/data consistency using the existing meaningful verifier adapted to this directory.
- [x] Return changed file inventory and verification results; no commit or source edits.

**Acceptance:** Every section can be handed to an independent future worker with the same shared style and explicit dependencies; no requirement to access Deereshop or the artifact folder at runtime.

**STOP:** Do not change product behavior or promise G1/G2 contracts absent from the extracted core.

### Task C: Lead verification, runtime acceptance and publication

- [x] Inspect actual destination diff/tree and source unchanged status. Run the documented deterministic suite personally.
- [x] Generate new ignored credentials, confirm port 18056 free, launch only the new Compose project and bootstrap its schema/profile/Studio/access. Verify health, extensions, collection counts and draft seed. Keep tokens and passwords out of reports.
- [x] Use native browser at `http://127.0.0.1:18056/admin` for login, product list/detail, synthetic draft save/readback, native media picker, error/conflict preservation and mobile/desktop layout. Server regression tests supplement browser cases where concurrent-state simulation is needed.
- [x] Dispatch a fresh independent reviewer over the full uncommitted tree with the approved spec, isolation boundaries and verification commands. Reviewer fixes confirmed in-scope P0/P1/P2. Run checks after fixes and dispatch a different fresh whole-tree reviewer. Adjudicate a second significant round before a delegated fix and one final review.
- [x] Record measured acceptance and remaining known limitations; mark this plan/spec implemented only for verified scope. Inspect staged and unstaged file scope, license/provenance and secret/content scan.
- Publication gate: create one reviewed initial commit on `codex/bootstrap-standalone-cms`, ensure clean tracked state, then publish that commit to the verified empty remote `main` without force. Git history and the final handoff report record the completed commit/remote SHA; this source document cannot contain its own commit hash. No production deployment or Deereshop switch.

**Acceptance:** The supplied repository contains the reviewed standalone baseline; the new local CMS is running and the owner receives its folder, URL and concrete verification results.


Second-review adjudication: remove orders/order_items from the shared website/editorial collection list. Orders contain buyer contact and manager data and belong to Sales Manager. Preserve only frontend CREATE and an uploader-owned orders READ restricted to id/request_key/request_fingerprint for the inherited handler's idempotency lookup; order_items does not need frontend READ. No editorial order permission remains.

Restrict frontend directus_files READ to Public assets plus that API account's own private uploads as needed for the Directus upload response. Restrict UPDATE to the folder field on uploads owned by $CURRENT_USER, with destination validation to the local private folder; restrict compensating DELETE to private uploads owned by that account. Source evidence: frontend media consumers check Public; lead uploader POSTs then PATCHes folder and compensates with DELETE; the order handler reads id/request_fingerprint by request_key. Verify installed Directus upload-response and dynamic-user-filter semantics before deciding whether own-private READ is necessary. Default Administrator-only runtime remains unchanged. Allowed corrective files: directus/access/blueprint.mjs, blueprint.test.mjs and directly relevant access tests, SOURCE-ORIGIN.md and acceptance documentation. No source edits, live permission writes or endpoint redesign. Cost: business-policy integrations must use their own instance account; cross-account/private editorial access is rejected. One final fresh review follows this bounded corrective round.

Final verification: 166 tests pass; the final independent review has no significant findings. Task A/B and local acceptance are complete. Publication proceeds through the gate above.

