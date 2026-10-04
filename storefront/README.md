# Universal Commerce Storefront

Responsive Next.js storefront prepared for the existing Universal Commerce CMS.

## What is implemented

- desktop and mobile layouts from one codebase;
- home page with search-first B2B UX;
- catalog with brand filtering and pagination;
- brand routes: `/brand/[brand]`;
- product routes: `/product/[slug]`;
- delivery, payment, about, contacts and request pages;
- local RFQ list stored in the browser;
- server-side Directus adapter with automatic mock fallback;
- `/commerce/search` integration;
- `/commerce/leads` proxy;
- `/commerce/orders` proxy prepared for later cart/account work;
- Directus asset proxy, so a private server token never reaches the browser;
- health endpoint.

The storefront does **not** change Directus schema, roles, permissions, Docker, database or deployment configuration.

## Run in mock mode

```powershell
Set-Location storefront
Copy-Item .env.example .env.local
npm install
npm run dev
```

`.env.example` defaults to `STOREFRONT_MOCK_MODE=true`, so Directus is not required.

Open `http://localhost:3000`.

## Connect Directus

Set:

```env
DIRECTUS_URL=http://127.0.0.1:18056
DIRECTUS_TOKEN=<server-side service token>
STOREFRONT_MOCK_MODE=false
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

The token is server-side only. Do not rename it to a `NEXT_PUBLIC_*` variable.

The current Directus baseline keeps anonymous access closed. The next integration step should create/review a least-privilege storefront service account or another approved server-to-server access mechanism instead of using an Administrator token in production.

## Existing CMS contracts used

- `GET /items/products`
- `GET /items/site_settings`
- `GET /commerce/search?q=...`
- `POST /commerce/leads`
- `POST /commerce/orders`
- `GET /assets/:id`

The storefront intentionally preserves the CMS product fields already defined in `directus/schema/blueprint.mjs`.

## Checks for the next agent

Run at minimum:

```powershell
Set-Location storefront
npm install
npm run typecheck
npm run build
```

Then verify the main routes at desktop, tablet and 390px mobile widths. See `INTEGRATION-HANDOFF.md` for the remaining CMS/infra work.
