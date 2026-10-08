# Storefront industrial redesign v3 — approved direction

User accepted the visual concept on 2026-10-07 and required equal multibrand positioning with no CAT emphasis.

Mockup: C:/Users/Alexandr/.codex/artifacts/storefront-light-ux/industrial-direction-v3.png
BASE/HEAD: 4a0d5330b3d1e267bad3d641ccd080255fbc05f6. Preserve all existing dirty UI work.

## Scope
Allowed: storefront/app/page.tsx, app/globals.css, app/theme.css, components/Header.tsx, components/MotionEnhancements.tsx, new UI-only components, public/images, public/fonts, docs for provenance and acceptance. Layout may only import UI/font components if needed. Shared CSS can improve all existing storefront pages but retain usable catalogue/request/product contracts.
Protected: lib/**, app/api/**, dependencies/manifests/lockfiles, Directus, schema, credentials, Docker/deploy, route/query contracts, request localStorage/data handling. Do not alter unrelated dirty files.

## Visual acceptance
- Rebuild homepage around the approved full-width photographic scene and large condensed Cyrillic heading; white background, graphite type, yellow accents, crisp rules and square-ish controls. No old side-by-side small cutout collage.
- Use original transparent logo as supplied; never redraw it or add a black backing.
- Neutral unbranded hero and category images. Do not fabricate manufacturer badges, numbers, promises or SKU images. Every brand from getBrands has equal visual weight, actual brand routes retained.
- CMS hero text/title/actions/images and category images retain precedence. Only fallback presentation changes.
- Header retains live search, catalogue categories/brands, phone, navigation, request badge and escape/outside-close. Mobile menu must not occupy blank space when closed; keyboard navigation accessible.
- Below hero, clear routes by article/category/brand then real multibrand strip, photographic category cards and product catalogue. Preserve service and CMS sections.
- Category sprite fallback: regular 4x2 photo grid, rows: filters/engine/cooling/hydraulics; attachments/undercarriage/fuel/transmission. Use CSS sprite coordinates; supplied CMS images always win.
- Mobile is designed independently: headline/actions then complete machinery photo, 2-column category cards, real compact product cards, no horizontal overflow at 390/600/820/1440 widths.

## Component sources
Refero DJI: https://refero.design/pages/b7b4a0f9-8d04-4c9c-9b19-099c28e46f6b
Refero research: https://refero.design/research/a70b654e-b382-4d54-9ae8-d48cccc6d431
Awwwards motion reference: https://www.awwwards.com/sites/lidar-drone-scanning / live https://drone.riotters.com/
21st Mega Menu: https://21st.dev/@ln-dev7/components/mega-menu — source read through free view. Treat as interaction/grouping inspiration only until a clear reuse license is documented (source link now redirects elsewhere).
21st ScrollExpandMedia: https://21st.dev/@arunachalam/components/scroll-expansion-hero — source read through free view, disclosed MIT. Adapt its normalized scrollProgress-to-image expansion approach without installing framer-motion. Preserve attribution/MIT notice in an appropriate source/provenance file.
The original uses preventDefault on wheel/touch and scrollTo(0,0); DO NOT copy scroll locking, hidden content gating or wheel interception into commerce. Use passive normal scroll + rAF/CSS transforms, reduced-motion and no-JS visible fallback, rerun route-aware observation. Never delay access to catalogue.

## Verification
Worker: npm run typecheck; git diff --check. Lead: mock-mode npm run build -- --webpack; desktop/mobile screenshot and overflow checks; narrow UI smoke including search/menu/request and reduced motion if runtime available. No new broad test suite. Local preview start currently rejected by tool policy, do not bypass through worker; compiled-static preview is an honest visual fallback, not hydrated-flow acceptance.
Fresh independent correctness review after implementation, lead verifies actual diff/evidence.

## STOP
Protected files/dependencies needed; unrelated dirty work; fabrication; unresolved asset/license issue. Report to lead, do not expand scope.

## Final acceptance — 2026-10-07

Implemented the user-approved v3 direction with explicit multibrand label and equal-weight brand links from the existing catalogue. Preserved original transparent user logo, CMS override precedence, existing routes, catalogue/request behavior and protected surfaces.

Current locally generated assets (all WebP):
- hero-industrial-v3.webp: 1920x640, 199948 bytes; unbranded complete excavator, panoramic desktop scene.
- hero-industrial-v3-mobile.webp: 900x675, 137496 bytes; independently recomposed complete mobile scene.
- category-components-v3.webp: 1600x800, 199430 bytes; eight neutral category illustrations in a 4x2 sprite, never substituted for a SKU photograph.
- Original transparent logo is sm-techno-logo-transparent.webp; font Oswald is self-hosted with OFL.txt.

Built-in image generation source files retained in C:/Users/Alexandr/.codex/generated_images/01a11698-f197-7901-944c-e5e848a12c1b:
- Desktop scene: exec-08181850-1a33-47ff-87d6-86d506c76dce.png
- Mobile scene: exec-973ba75f-976d-4ea4-bbf7-9b260e9c249c.png
- Category sprite: exec-8521d169-4ad5-40c4-ae6a-7f4297050232.png
- Approved visual mockup: exec-d7757085-203c-4499-beaa-f1669621f046.png (illustrative concept only; its generated logo/markings/claims were not transferred).

Verification:
- Final explicit mock-mode npm run build -- --webpack: exit 0, compilation and TypeScript succeeded.
- npm run typecheck and git diff --check: pass.
- Two fresh independent whole-change reviews: no confirmed P0/P1/P2; first identified a visual seam subsequently corrected and reviewed again.
- Compiled-static Chromium rendering at 390, 600, 820 and 1440 px: document overflow 0, no broken image, font loaded. Full desktop machine image ends exactly before quick links; mobile uses dedicated 4:3 scene without cropping.
- Request static layout at 390 px: document overflow 0.
- Final screenshot artifacts: D:/codex/Universal Commerce CMS/output/playwright/industrial-v3-final-1440.png and industrial-v3-final-390.png, plus full-page industrial-v3-home-1440.png / industrial-v3-home-390.png.

Limit: local server start on 127.0.0.1:3002 was rejected by exec_command with blocked by policy and no specific rule. The compiled-static screenshots are genuine rendered UI with hydration scripts removed; they validate presentation, not live API/search/RFQ submission or scroll effect runtime. Manual restart requested asynchronously. Do not claim deployment or live CMS acceptance. No commits, dependency changes or server-start workarounds.

## Impeccable Live — 2026-10-08

The user explicitly invoked `$impeccable live`. The previous launch limitation no longer applied: a normal `next dev --webpack --hostname 127.0.0.1 --port 3002` command succeeded after stopping the verified Next.js preview. Demo mode and disabled mock fallback remain explicit. The Live helper uses port 8400; it is separate from the app.

User-accepted presentation changes:
- Header logo alignment: `translateY(-9%)`, selected after comparing the white wordmark with the Catalog button. Logo asset and sizing were preserved.
- Desktop header logo breathing room: 12px above and below its image box; padding compensates for the accepted translation. At 1440px the measured gaps were 11.994/11.990px; at 1024px 11.997/11.988px. Padding rules apply only from 821px. Mobile layout and control dimensions remain unchanged.
- The Catalog radius series was discarded. No radius change was persisted. A helper discard removed an excessive source range; the full Header was restored and native keyboard open/Escape close were verified. Do not automatically wrap a native summary in a div for future previews.

Typecheck and diff-check passed. Header contains one set of existing hooks/refs and no variant markers. Fresh reviews found no P0/P1/P2 in the accepted alignment/spacing changes. Footer logo remains unaffected; no document overflow at 1440, 1024 or 390px.

PRODUCT.md, DESIGN.md and the Impeccable sidecar/config record existing confirmed context for this local session. The temporary localhost Live script in app/layout.tsx must be removed using `impeccable live-server stop` when the user exits Live; do not ship it. Server launch success is not production Directus/API or deployment acceptance. Live polling remains active until the user exits.

User chat follow-up: preserve the original Catalog button shape and remove rounding from search fields and Find buttons. Six existing search radius declarations in globals.css now use 0. Computed form/input/button radius is 0px on home and catalog at 1440, 1024 and 390px; Catalog remains 1px, with no document overflow. Diff-check and two fresh scoped reviews passed. Search behavior, menu markup and other controls were unchanged.

The user subsequently requested stopping Live. The foreground poll was terminated, `impeccable live-server stop` succeeded, and the temporary layout script was removed. Final status: liveServer null, activeSessions empty; no variant/carbonize markers in Header, layout or globals.css. Diff-check passed. The app dev preview remains listening on 127.0.0.1:3002; helper port 8400 is stopped.

Post-Live screenshot follow-up: the user confirmed centering the main white 'СМ ТЕХНО' wordmark against Catalog, allowing the gear/boom to protrude. Only the header logo rule changed: translateY(-7.5%) and object-position center 57.5%, accounting for contained-image letterboxing. The asset wordmark bbox y126..196 has center161 on a280px image. DOM checks at1440/1024/820/390px showed center delta below0.001px; existing logo dimensions, header height and button center stayed identical. No overflow; footer transform remains none. Screenshot: C:/Users/Alexandr/.codex/artifacts/storefront-light-ux/logo-center/header-wordmark-centered.jpg. Live remains stopped.

The user rejected that interpretation and supplied a Photoshop reference: align the entire right text block, including yellow caption and bottom strip, with the Catalog button's height band. This supersedes the main-wordmark-only alignment above. Current header logo uses translateY(-19.107143%) and object-position center69.107143%, from foreground bounds126..261 on the280px asset. At1440px foreground edges differ from the42px button by+0.375/-0.375px without resizing the logo. At<=820px a transform of-16.428571% preserves the visible boom tip; the smaller text block stays within the40px button band. Verified820/600/390px: no overflow, unchangedheaderheight137px, footer unaffected. Header padding and control positions were preserved. Current desktop screenshot: C:/Users/Alexandr/.codex/artifacts/storefront-light-ux/logo-center/header-text-block-aligned.jpg.

The user then requested removing rounding throughout the entire storefront. All73 border-radius declarations in globals.css and both radius tokens in theme.css are now0. The standalone global-error panel and retry button use inlineborderRadius0. Only radius values changed in production styles; previous logo positioning, spacing, colors and behavior were preserved. DESIGN.md and the Impeccable component snippets record the new square-corner policy.

Live DOM verification covered13 route/states at1440/1024/390px (39 checks): home, catalog, filtered/empty catalog, brands, category, brand, product, request, delivery, payment, about and contacts. All four computed corner radii were0 on every storefront body element; no document overflow. The development portal was excluded. Error-route inline styles were checked in source without inducing a server failure. Evidence: C:/Users/Alexandr/.codex/artifacts/storefront-light-ux/square-ui/route-radius-check.json and catalog-square.jpg. Diff-check passed; no tests, build, commerce/API or infrastructure changes were needed for numeric presentation values.

Shared-shell follow-up: removed catalog-only header/search styling and the catalog body search. The shared header search preserves the catalog q input through a Suspense-wrapped URL-aware presentation child; SearchBox logic is unchanged. Footer and RootLayout were already shared and remain unchanged. Catalog controls now precede a shared desktop grid row containing filters and results; cards and the filter panel have identical top coordinates at1440/1024px. Mobile follows document order with collapsed filters.

Typecheck, explicit mock-mode webpack build, diff-check and two fresh independent reviews passed. Browser checks across8 routes/states at1440/1024/390px (24 checks) confirmed one search, identical header/search-slot geometry to home, identical footer content/links/logo/dimensions, and no overflow. Native search1R-1808 returned one product; category filtering and price sorting retained q/category/sort. Clearing a query chip cleared the header input; Back restored it. Mobile filter disclosure and Catalog open/Escape close worked. Evidence: C:/Users/Alexandr/.codex/artifacts/storefront-light-ux/consistent-shell/shell-checks.json and catalog-shared-header.jpg. No commerce/API/CMS/dependency or deployment changes.
