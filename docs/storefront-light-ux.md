# Storefront light interface redesign

## Approved scope

The owner requested a usable white storefront, clearer category/brand navigation,
catalog filters, product information and RFQ presentation. The existing search,
catalog, CMS, API, URL and request contracts remain protected. Yandex guidance is
the primary SEO reference. This is a presentation change, not a catalogue migration.

Implementation starts from `4a0d5330b3d1e267bad3d641ccd080255fbc05f6` in
`feat/storefront-light-ux`. Allowed surfaces: theme and global CSS, presentation
components and page composition, static WebP assets, and selectors in existing UI
tests where the new presentation changes their assumptions.

## User journeys

- Find a known SKU/OEM from any page.
- Browse existing categories and brands with distinct labels and crawlable links.
- Understand and remove selected catalogue filters.
- Inspect a product's data, price/availability and related information.
- Add positions, edit quantities, import a list and send the existing RFQ.
- Find real company contacts and delivery/payment information.

The storefront category view model is flat. A real parent/child category tree
requires a separate data-contract change and is not simulated in presentation.
CMS copy, images, navigation and SEO continue to take precedence over fallbacks.

## Visual decisions

White and light-gray surfaces, graphite text, yellow actions, readable controls,
shared layout/typography across routes. Mobile navigation and search recompose
instead of shrinking desktop controls. Product imagery continues to come from
the catalogue; generated images are only illustrative marketing assets.

## Hero asset provenance

Generated with the built-in `image_gen` tool, then resized and encoded with Pillow
as explicitly requested for web delivery. Original remains in the local Codex
generated-images directory. Project assets:

- `storefront/public/images/hero-machinery.webp`: 1280 x 853, 163934 bytes.
- `storefront/public/images/hero-machinery-mobile.webp`: 768 x 512, 60542 bytes.

The owner subsequently supplied the actual logo. It is preserved, resized and
encoded as `storefront/public/images/sm-techno-logo.webp` (720 x 450, 24406
bytes). Header/footer cropping is CSS presentation of the original black padding;
the mark, lettering and colors were not regenerated.

Generation prompt:

> Use case: ads-marketing. Asset type: website hero photograph for a professional Russian multi-brand construction and agricultural spare parts supplier. Create a premium photorealistic editorial wide landscape image, approximately 3:2. Main subject: a yellow tracked excavator in three-quarter front-side view on a pale gravel equipment yard, with a smaller green agricultural tractor in the middle distance, a low quiet horizon and pale overcast sky. The excavator is the unmistakable sharp primary subject, bucket grounded, mechanically plausible tracks, hydraulic hoses and articulated arm; tractor subtly conveys agriculture. Balanced, elegant product-advertising composition with entire machinery visible, no cropped tracks or boom, camera at eye level, gentle natural daylight, real metal texture and muted earth tones, warm yellow accent, light gray background fitting a white website. Keep key machines in central 80% of image for responsive cropping. Not a busy construction scene. No people, no text, no letters or numbers, no brand marks, no logos, no watermark, no invented parts in foreground. This is illustrative brand-neutral marketing imagery, not a depiction of the shop's premises. High photographic quality, restrained lighting, believable scale.

## References

- [Yandex: useful navigation](https://www.yandex.com/support/metrica/ru/advisable/easy-navigation)
- [Yandex: effective website](https://yandex.ru/support/metrica/ru/recommendations/make-site-better)
- [Yandex: regional information](https://www.yandex.ru/support/webmaster/ru/site-geography/site-region)

## Verification plan

Typecheck/build, diff scope check, focused browser journeys and screenshots at
1440, 1024 and 390 px. Check long content, missing images and catalogue empty
state. Use mock mode for local preview: the existing local CMS was unavailable
at the start of this work. Mock results do not establish live-CMS acceptance.
Do not start or change Docker/deployment configuration for this redesign.

## Verification results (2026-10-07)

- `npm run typecheck`: passed.
- `npm run build -- --webpack`: passed after the review fix. A later one-line
  Russian pluralization fix passed `npm run typecheck`; the running production
  preview still uses the preceding build until it is rebuilt and restarted.
- `git diff --check`: passed.
- All three committed-intent image assets decode as WebP.
- No diff in data adapters, API routes, CMS, development infrastructure or dependency manifests.
- Browser screenshots were inspected at 1440, 1024 and 390 px in mock mode.
  Interim review led to fixes for header search sizing, catalogue menu
  overflow, mobile catalogue density, and request-page information order.
- Independent source review fixed a P2 inherited CSS rule that hid the brand
  filter on mobile. A second fresh source review found no confirmed P0/P1/P2.
- The owner started the production preview on `127.0.0.1:3002` after the
  tool-mediated start was rejected with `blocked by policy`. Browser checks
  confirmed home, catalog and RFQ page rendering, loaded assets, no horizontal
  overflow at the checked widths, visible mobile brand filters, and adding a
  catalog item to the RFQ with its counter and quantity controls. The
  1024-pixel check covered the home page. These checks used mock data; no live
  CMS or RFQ submission was exercised.
- The browser requested `/favicon.ico` and received a 404. This does not
  affect the checked shopping and RFQ flows but remains a small brand-detail
  improvement.
- Default Turbopack build cannot use this worktree's shared `node_modules`
  junction because it points outside the Turbopack root. Webpack build works;
  no application configuration or dependency version was changed to work around it.

The existing automated browser suite was not run. The focused manual browser
checks above cover the redesigned navigation and RFQ handoff. Screenshot files
are stored under `D:/codex/Universal Commerce CMS/output/playwright/`.

## Superseded visual direction

The earlier hero/layout described above was replaced by the user-approved industrial v3 design on 2026-10-07. Current scope, assets, reference provenance, screenshot evidence and runtime limitation are recorded in storefront-industrial-v3.md and storefront-motion-provenance.md. Earlier acceptance notes are historical and do not establish live acceptance of v3.
