# Approved A4-UX-FIX proposal

The paired actual Before and separately rendered After images in this folder were shown directly in the preceding user-visible response. The owner explicitly approved implementation with “Реализуй” on 2026-10-25. This is approval of the shown A4 variant and the local target below; it does not approve A5 or unrelated changes.

## Visual references

- Main/date, native material editor, products/categories, single search surface and additional details: before/after-{main,material,relations,seo,other}-{1536,390}.png.
- Additional proposed states: after-{error,comparison,scheduled}-{1536,390}.png. No actual conflict/scheduled Before was fabricated: the installed article collection was empty during preparation.
- Native dialog Before images demonstrate existing Russian controls, without replacement/editor/vendor changes.
- `proposal.html` is a throwaway reference; no prototype framework/editor is shipped. SHA256 de95156b01bbfdf3f72a800b388abc7919908a70a2733d6ff8c81f23a0b70daf.

## Approved behavior

1. Form recovers after SEO consistency validation without a write or stuck saving state. Correction permits successful save; protection against contradictory projections remains.
2. Selected products/categories resolve independently from the current bounded search. Names and allowed unlink persist; unknown/deleted/inaccessible values stay intact with “Товар недоступен” / “Категория недоступна”, without identifiers or unauthorized unlink. The second unavailable chip in the proposal illustrates this state rather than a real saved article.
3. Rename relation/search tabs to “Товары и категории” / “Поиск и ссылки”. One primary search title/description/image input; no duplicate native SEO panel. Preserve hook projections, JSON-first fallback, unknown keys and trusted-edit guards.
4. Show required date, time and actual browser timezone, explain separate publication. Display scheduled state only as already enforced by the backend publication filter. Keep ordinary save separate from status transition; no new worker/backend rewrite.
5. Keep native rich HTML editor and writing mode. Cover/alt/relations/search-only saves, hydration, tabs and mere dialog visits retain exact saved HTML. Explicit typing/paste/keyboard formatting works. File unlink does not delete bytes or other references.
6. Hide raw structural/translation data and identifiers, preserve unknown values. Comparison shows relevant changed fields and safe text excerpts without rendering unchecked HTML or printing entire HTML/JSON; comparison/reconcile never saves implicitly.
7. Preserve current native Russian toolbar/link/image/source dialog behavior and inspect it in actual Directus. No table tool is configured; this task does not add one or claim a new translation pack was installed.

## Scope / target

Article src/dist, focused article tests and article documentation only; pure article helper exports may remain in articles.js. Native interfaces/vendor, backend/publication, schema/access/credentials, dependencies, shared A0, storefront, infrastructure/config and other sections protected.

Confirmed target approved in the same presentation: local Windows Directus12.1.1, http://127.0.0.1:18056, project universal-commerce-cms-dev; existing extension bind in storefront-directus-acceptance. Local storefront http://127.0.0.1:3000 may observe existing publication behavior. No production host is established. After required checks, standard backup/artifact rollback, commit/push/PR/merge/deploy and post-deploy verification are authorized without a second owner gate. Fixture writes only in this own test contour, exact journal IDs and cleanup.

Primary requirements remain GitHub issues #20/#22 and the user's task. The prototype shows intent; existing data/permissions/security contracts prevail over incidental static markup.
