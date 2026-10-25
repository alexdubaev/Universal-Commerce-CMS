# Existing native language-asset limitation

This is a verified pre-A4 Directus 12.1.1 limitation, not a fixed item or a clean-browser-console claim.

On 2026-10-25 a read-only browser smoke opened a new unsaved article and its native material editor. TinyMCE requested `/admin/product-editor/sections/articles//langs/ru-RU.js`; Directus returned its HTML application shell with HTTP 200, causing `Unexpected token '<'`.

The lead then restored the exact pre-A4 article pair (SHA256 `b3ab18f653993ba80cb6a35f1727837005fcd0599801bec0a6de5b8268b20c30`), confirmed the original served aggregate (`d8a9f876785624c5d32b2805642c3240e5f8a1897c1f5341e93374b5a0f09d1c`), and reproduced the same URL, response type and error in the same unsaved-form smoke. The A4 artifact was subsequently restored. No article, schema, role, project-owner or license setting was written by that smoke; normal Directus authentication/page tracking occurred.

Read-only inspection of the installed native `input-rich-text-html-8d_Z3mGx.js` identifies TinyMCE's core locale fallback: a missing non-English pack loads `language_url` or the editor base URL plus `/langs/<language>.js`. The installed app has Directus UI locale data but no matching TinyMCE-format Russian pack at that path. `language_load:false` does not disable this core fallback. No supported available article-only option was found that removes the request while retaining the current Russian editor.

Verified Russian controls and dialogs, intentional HTML saves and exact byte preservation are recorded separately in acceptance evidence. No table tool is configured. These checks do not claim complete vendor translation or a successful language-pack load.

The known asset error is recorded separately from A4 scenario results. Any other browser exception remains a failure. Repairing or supplying the native translation asset would require separately approved vendor/interface/dependency scope; A4 does not change those protected areas or substitute a different editor.

Private evidence: `D:/codex/ucms-release-backups/a4-ux-20261025/{baseline-browser-errors.json,language-baseline-health.json,native-language-diagnosis.md}`. Backup/rollback receipts identify the exact baseline and restored candidate. No credentials are published here.
