# Storefront Design Contract

## Goal

A complete storefront redesign should be possible without rebuilding the commerce application.

The user should be able to request a new visual direction, provide a screenshot/Figma/reference, and an agent should be able to replace the presentation layer while the dynamic catalog, search, brands, product pages, leads and orders continue working.

This document is the handoff contract for that workflow.

---

## Architecture

```text
Directus / Commerce API
        ↓
data adapters
        ↓
stable storefront types
        ↓
interaction hooks (search / request / submission state and actions)
        ↓
shared UI components
        ↓
page composition
        ↓
CSS design tokens / responsive layout
```

Shared UI markup, page composition and CSS are expected to change during a redesign.
Data adapters, stable types and interaction hooks should normally remain unchanged.

---

## Stable dynamic entities

A visual implementation must be able to render these entities without knowing their exact values in advance.

### Site

- company name
- phone
- email
- logo
- legal/contact content
- CTA labels
- page content

### Product

- id
- slug
- title
- sku
- mpn
- brand
- category
- short/full description
- price
- price_status
- availability_status
- part_type
- main image
- gallery
- specifications
- documents
- product codes
- analog/supersession relations

### Brand

A brand is a **dynamic catalog dimension**, not a separate storefront.

All brands must use one route/template:

`/brand/[brand]`

Do not create a separate application or copied page tree for Caterpillar, Komatsu, JCB, Volvo, Hitachi, Doosan, John Deere, CNH, CLAAS, Perkins, SANY, or future brands.

### Request / RFQ

Presentation may change, but adding/removing/changing quantity and lead submission behavior must remain intact.

---

## Visual tokens

All visual identity should be centralized.

Current implementation keeps tokens in `app/theme.css`, imported before `app/globals.css`.
All concrete presentation colors live in this canonical theme, including control,
media, decorative, status and standalone error colors. RGB tokens also feed
translucent borders, overlays and shadows. Transparent backgrounds/stops and black
mask coverage remain structural CSS values.

A redesign should start by replacing token values such as:

```css
:root {
  --bg: ...;
  --bg-soft: ...;
  --surface: ...;
  --surface-2: ...;
  --text: ...;
  --muted: ...;
  --accent: ...;
  --success: ...;
  --danger: ...;
  --radius: ...;
  --radius-sm: ...;
  --shadow: ...;
  --shell: ...;
}
```

Future agents may migrate tokens to CSS modules or another theme system, but there must remain **one canonical token source**.

Do not scatter brand colors, spacing values, radii and typography rules across dozens of page files.

---

## Interaction boundary

Search and RFQ components render markup and bind actions from `hooks/`:

| Hook | State and actions it owns |
| --- | --- |
| `useCatalogSearch(initial)` | Query, suggestions, recent history, hydration, focus/blur and catalog navigation |
| `useAddToRequest(product)` | Add/merge a product into the stored request and temporary added feedback |
| `useRequestItems()` | Stored request items, event synchronization, quantity changes and removal |
| `useRequestCount()` | Header count with its existing raw-storage quantity semantics |
| `useBulkRequestImport()` | Manual/file import, hydration, limits and import feedback |
| `useRequestForm(items?, persist?)` | Form payload and success cleanup; no arguments selects the quick contact form, supplying both arguments selects the RFQ form |
| `useLeadSubmission(successMessage)` | Sending/error/success state, API call and request-key reuse |

The hooks contain no JSX or visual tokens. A new layout may render their state
and bind the same actions without copying request/search logic. Keep form field
names (`company`, `name`, `phone`, `email`, `message`) and hook bindings intact.
`useRequestForm` preserves each form's payload property order and success message;
RFQ cleanup runs only after a successful response. Quick contact submissions do
not clear stored RFQ items.

Treat `hooks/**` as behavior code during a visual-only task. Preserve storage keys,
storage events, search timing and URLs, request payloads and idempotency behavior.
The existing `lib/**` and `app/api/**` remain the data/domain/server boundaries.

---

## Shared components

These are visual primitives and should be redesigned centrally, not reimplemented per page:

- Header
- Footer
- SearchBox
- ProductCard
- AddToRequest
- form controls
- buttons
- breadcrumbs
- badges
- pagination
- loading / empty / error states

If a new design requires a new ProductCard, change one ProductCard component and let all catalog surfaces inherit it.

---

## Page composition

Routes are stable; composition is flexible.

Required storefront routes currently include:

- `/`
- `/catalog`
- `/brands`
- `/brand/[brand]`
- `/product/[slug]`
- `/request`
- `/delivery`
- `/payment`
- `/about`
- `/contacts`

A redesign may reorder sections, remove decorative blocks, change navigation presentation, change card shapes, or radically change visual hierarchy.

It should not rename routes unless the user explicitly asks for an information-architecture change.

---

## Content-first sizing rules

Never design around one perfect demo product.

UI must tolerate:

| Field | Minimum design assumption |
| --- | --- |
| Brand | 2–30+ chars |
| SKU | 4–40+ chars |
| Product title | 20–160+ chars |
| Description | empty to several paragraphs |
| Specifications | 0–50+ rows |
| Price | hidden / request / large numeric value |
| Images | missing / portrait / landscape / square |
| Brand count | 1–100+ |
| Catalog | 100,000+ products |

Use wrapping, truncation with accessible full text when appropriate, responsive grids, and stable card heights only where useful.

---

## Responsive contract

A redesign is incomplete until both desktop and mobile are intentionally designed.

### Desktop

Target reference viewport: 1440px.

### Tablet

Check around 1024px.

### Mobile

Target reference viewport: 390px.

On mobile:

- header may collapse to a menu
- search should remain primary and touch-friendly
- filters may become drawer/sheet controls
- product layout becomes single-column
- request/form controls become full-width
- tap targets should be comfortable
- no horizontal scrolling of the document

Do not maintain a separate mobile codebase.

---

## Fast redesign workflow for Codex

When asked to create a new design:

### Phase A — visual target

1. Identify the exact visual reference.
2. List global tokens: color, typography, spacing, radii, shadow, container width.
3. Identify shared components that visually change.
4. Identify page-specific compositions.

### Phase B — implementation

1. Update tokens.
2. Update Header/Footer.
3. Update ProductCard/SearchBox/buttons/forms.
4. Update home composition.
5. Update catalog/brand/product pages.
6. Update content pages.
7. Update mobile breakpoints.

### Phase C — regression

Verify:

- all navigation links
- every brand route
- catalog query/search
- product route
- add to request
- quantity change/remove
- lead form
- mobile menu
- empty states
- mock mode
- Directus adapter types remain unchanged

---

## CMS/content rule

The final goal is that dynamic copy and commerce data come from Directus.

The design layer should therefore render props/data, not own business facts.

If a page text is still temporarily hard-coded during prototype development, mark it as provisional and keep its structure compatible with future Directus page/section data.

A redesign should not require copying content manually from the previous design.

---

## Theme swap principle

A future storefront may support named themes, for example:

```text
industrial-dark
minimal-light
cat-yellow
editorial
high-contrast-b2b
```

But themes should change presentation, not catalog/business code.

If named themes are implemented later, prefer a structure such as:

```text
storefront/
  themes/
    industrial-dark/
    minimal-light/
  components/
  lib/
  app/
```

or CSS token files imported by one canonical entry point.

Do not fork the whole storefront per theme.

---

## Acceptance checklist for a redesign

A design PR is ready only when:

- one coherent visual system is used everywhere
- all existing routes still work
- no commerce/API behavior was unintentionally changed
- dynamic content is not clipped or broken
- 1440px looks intentional
- 390px looks intentional
- no horizontal document overflow
- long product titles and SKUs are tested
- missing images have a valid fallback
- all brand pages use the same dynamic template
- the request/RFQ flow still works
- mock mode still works
- Directus credentials remain server-only

---

## User intent shorthand

If the user says:

> "Make a completely new design"

Interpret it as:

> Replace the presentation layer while preserving data, routes, CMS contracts, search, catalog behavior and RFQ/order logic.

If the user says:

> "Use this screenshot as the new design"

Interpret it as:

> Recreate the visual system from the screenshot across the entire storefront, using existing dynamic data contracts.

If the user says:

> "Change only the design"

Do **not** modify CMS, database, Docker, API contracts or commerce logic.
