# Product editor extension

This Directus app module provides product create and edit routes at `/admin/product-editor/+` and `/admin/product-editor/:id`. It uses native field metadata, stages edits across tabs, and sends updates through the existing `/commerce/mutations/products/:id` compare-and-swap endpoint. Creates remain draft by default.

The editor uses the configured product schema and public asset folder. Document UUID arrays retain their existing storefront-compatible shape. Conflicts and failed saves preserve local input so the editor does not silently discard work. The extension does not add collections, database tables, credentials, or dependencies.

Run `npm test` in `directus/` for the 16 editor-state tests. Apply its presentation metadata to the isolated local instance with `npm run product-editor:setup -- --apply` after the standalone bootstrap has created the new instance's asset folders.

The extension package identifier is historical and is retained because Directus metadata and its registered route use it.
