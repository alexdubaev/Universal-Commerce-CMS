# Cart presentation and compact spacing

The existing `/request` page is presented as «Корзина». Product buttons add to the cart; the final form action remains «Отправить заявку». Header and footer use the cart label. The header action is yellow with a generated black raster cart icon.

Cart unit prices come from the existing `/api/search` endpoint without changing stored request items. Only a unique exact normalized SKU and matching brand from a complete search result can supply a price. Fixed published prices remain visible for products available on request. Unmatched, ambiguous, hidden and unpublished prices are displayed as «Цена по запросу». Lookup failures have a retry action. Quantities update line amounts and totals; currencies are totaled separately. Mixed carts explicitly identify totals for priced items and explain the excluded items.

The `smtechno-request` key, article/quantity lead payload, submission idempotency, API routes, CMS integration and data types are unchanged. Existing saved items remain compatible. Decorative eyebrow captions have been removed from all page/component markup, including CMS renderers. Shared page and section spacing is more compact; the logo alignment, angular corners and catalog alignment are preserved.

## Verification

- TypeScript passes; four focused pricing tests pass, including incomplete lookup results and fixed prices with on-request availability.
- Native browser actions confirmed adding products, changing quantity, importing an unknown article, removing positions and persistence after reload. No lead was submitted.
- 8,450 RUB + 98,500 RUB = 106,950 RUB; increasing the first quantity to two gives 115,400 RUB. An unknown imported item preserves that known subtotal with an exclusion note.
- Eleven routes checked at 1440, 1024 and 390 pixels: no decorative eyebrows or horizontal overflow; catalog filter/card tops remain aligned on desktop/tablet.
- Independent review found and fixed incomplete-search ambiguity; a fresh final review found no significant issues.
- `git diff --check` passes. Prior unrelated dirty work is preserved. Test cart entries were removed through the UI, restoring the initially empty browser cart.

Browser evidence: `C:/Users/Alexandr/.codex/artifacts/storefront-light-ux/cart-refresh/route-checks.json`, `cart-final.jpg`, `cart-mobile.jpg`.

## Generated icon

Built-in image generation was used with a transparent background. Prompt: “Create exactly one simple black shopping cart pictogram on a genuinely transparent background. Classic recognizable cart seen from side, short handle upper left, trapezoid basket, two circular wheels. Flat pure black, bold consistent clean strokes, no shading, gradient, texture, text, frame or logo. Centered compact silhouette, square composition; legible at 20px. Raster transparent image, not SVG.”

Saved asset: `storefront/public/images/cart-icon-black.webp` (80 × 80, lossless WebP, alpha, 1,416 bytes). The generated source is preserved under the Codex generated-images directory.
