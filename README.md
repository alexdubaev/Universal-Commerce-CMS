# Universal Commerce CMS

Standalone Directus administration and a headless Next.js storefront for commerce sites. Every website uses a separate Directus instance, PostgreSQL database, file storage, credentials, roles, and integrations. The shared project contains a neutral schema, Studio setup, access tooling, extension closure, synthetic draft content and the reusable storefront. Site catalogues and runtime credentials remain instance-local.

See [storefront setup and checks](storefront/README.md) and [the design contract](storefront/DESIGN-CONTRACT.md). The storefront can run in explicit mock mode or connect to a dedicated Directus instance using a server-only technical identity. The fixed storefront gateway is disabled by default. Merging code into `main` does not establish production acceptance or deploy a website.

## Requirements

- Node.js 20.9.0 or newer
- Docker Compose

## Local development

From the repository root, create fresh ignored credentials and instance IDs, then start only this project's isolated stack:

```powershell
node dev/generate-env.mjs
docker compose --project-name universal-commerce-cms-dev --env-file dev/.env -f dev/compose.yml up -d
$ready = $false
for ($attempt = 0; $attempt -lt 60 -and -not $ready; $attempt++) {
  try {
    Invoke-RestMethod -Uri 'http://127.0.0.1:18056/server/ping' -TimeoutSec 2 | Out-Null
    $ready = $true
  } catch {
    Start-Sleep -Seconds 2
  }
}
if (-not $ready) { throw 'Directus did not become ready at http://127.0.0.1:18056/server/ping.' }
Set-Location directus
npm run cms:bootstrap
npm test
```

Open `http://127.0.0.1:18056/admin`. The initial admin email is `admin@example.com`; its generated password is stored only in ignored `dev/.env`. Do not display or commit that file. The environment generator refuses to overwrite an existing file.

The default bootstrap creates only the instance-local asset folders; it uses the existing Directus Administrator account and does not install business roles or permissions. Directus 12.1.1 Core restricts the folder-scoped permission rules required by this blueprint. Public access stays closed. To install the full role and permission blueprint, use `npm run access:apply` only on an instance whose edition is entitled to custom permission rules. The command remains strict and can leave a reported partial state if the instance rejects those rules. Do not remove its folder filters or presets to make it pass.

Stop only this stack with:

```powershell
docker compose --project-name universal-commerce-cms-dev --env-file dev/.env -f dev/compose.yml down
```

Removing this stack's named volumes is a separate destructive operation; back up its database and uploads first.

## Development commands

Run from `directus/`:

| Command | Purpose |
| --- | --- |
| `npm test` | Backend handler, concurrent-write and tooling integration tests |
| `npm run schema:check` | Core collection limit and schema-application checks |
| `npm run schema:apply` | Idempotently install schema and neutral draft content |
| `npm run schema:studio` | Idempotently apply collection and field metadata |
| `npm run studio:workspace` | Install the local workspace, dashboard, panels, and bookmarks |
| `npm run studio:versioning` | Enable native versions without configuring a site preview URL |
| `npm run access:folders` | Idempotently create only the two local asset folders; safe for Core |
| `npm run access:apply` | Apply the full strict business role and permission blueprint on an entitled instance |
| `npm run project:settings` | Apply neutral project name/color, the commerce profile locale, and a product-editor module-bar link while preserving existing entries |
| `npm run cms:bootstrap` | Run schema, Studio, project settings, workspace, versioning, local folders, constraints, and product-editor metadata |

The bootstrap uses the credentials loaded from `dev/.env`; it never prints them. It applies clean-database SQL constraints and product-editor metadata after creating local access folders. Existing seed keys are checked before insertion, so re-running setup preserves edited records.

## Local verification before pushing

GitHub Actions CI/CD is removed. Run all checks locally before every push or PR merge into `main`:

```powershell
# Install once, and again when the lockfile changes:
npm ci --prefix storefront
npx --prefix storefront playwright install chromium
# Run from the repository root:
node scripts/verify-local.mjs
```

The gate runs backend/storefront integration tests, a small domain-unit set, TypeScript, a dependency audit, a mock production build, deployed-extension/client-secret checks and two critical Chromium E2E journeys. It starts only a disposable mock storefront, without using runtime credentials or mutating a CMS. See [test policy and review](docs/development/testing.md).

## Extension contracts

Custom interfaces referenced by Studio are mounted from `directus/extensions`, including the product gallery preview. The `/commerce` endpoint and product editor identifiers are retained for compatibility. A missing interface or unsupported database/schema assumption must be resolved before applying a profile. G1 guarded contracts and G2 analog identity behavior remain subject to their existing documented limits.

Third-party bundles retain their upstream package manifests and licenses. The Flexible Editor bundle is GPL-3.0 and the Directus Labs SEO plugin is MIT; review their notices and distribution conditions before redistributing this repository.

See [the Directus model and extension notes](docs/architecture/directus-model.md), [the commerce profile](profiles/commerce/profile.mjs), and [scope rules](docs/architecture/ADR-002-scope-locked-changes-and-content-only-releases.md).
