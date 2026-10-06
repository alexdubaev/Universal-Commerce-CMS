# Findings ledger

Wave 1 complete. Initial evidence is preserved in the numbered audit reports; operational prerequisites are not automatically software severities.

| ID | Severity | Evidence | Surface/risk | Action | Dependency | Owner/status |
| --- | --- | --- | --- | --- | --- | --- |
| F001 | P1 | Live `date_updated` query returns 403; `updated_at` returns 200 | catalog/product/sitemap unavailable | Map CMS `updated_at` to stable frontend property | None | Adapter worker: fixed, first review PASS |
| F002 | P2 | Explicit mock=false/fallback=false without URL yielded mock=true | Fictional products on config mistake | Honor explicit live mode | None | Config worker: fixed, first review PASS |
| F003 | P2 | WebKit probe: enabled SSR controls accept input before React attaches, then lose it | Search/bulk user input lost | Disable affected controls until hydrated | None | Integrated; unchanged three-browser 30/30 PASS |
| F004 | P2 | Plain/app WebKit Tab ignores implicit anchors; explicit tabindex restores focus | Skip link cannot be reached by expected Tab sequence | Explicit tabIndex=0; retain original assertions | None | Integrated; unchanged three-browser 30/30 PASS |
| F005 | P2 | Known brand metadata replaces stored case variant, equality filter then misses data | Brand page advertised but empty | Preserve exact stored brand label | None | Integrated; focused regression PASS |
| F006 | P2 | Security stream consumed 600056 bytes before 512000 cap rejected | Unbounded per-request buffering | Byte-count/cancel stream before parse | None | Integrated; stream cancellation/API guards PASS |
| F007 | P2 | Folder omitted from proxy gate; 300s auth cache + 86400s stale success | Private references/revoked assets unsafe with privileged bridge | Backend public-folder+current published reference; fresh frontend auth; no stale success cache | Gateway | Backend/security streams: planned |
| F008 | P2 | Product sitemap ignores is_indexable | Nonindexable product included | Prove/fix inclusion and sitemap count consistently | Existing schema sufficient | Focused isolated SEO worker in progress |
| F009 | P2 conditional | Code flag off now; two 200-candidate sources can merge to400 when enabled | Cap contract/total mismatch on future rollout | Keep code flag off; bridge must preserve global200 ceiling | Search decision | Gateway/search stream: planned |
| B001 | Blocker | Installed Core custom-rule gate; prior access apply rejected | Required published-only/files policy cannot be provisioned as documented | Supported permission path or reviewed endpoint-only architecture | Security/access synthesis | Access stream: open |
| B002 | Data prerequisite | No published records/media | Live scenario coverage unavailable | Seed explicitly synthetic local acceptance fixture set | Safe provisioning design | Content stream: authorized |
| F010 | P1 | Initial gateway child filter overwrote requested product UUID | Product details mixed child windows | Preserve identity in forced publication conjunction | Gateway | Fixed before runtime; adapter-selector regression PASS |
| F011 | P2 | Initial gateway rejected actual asset selectors and 1000-row/indexability sitemap query | Media/sitemap integration unavailable | Fixed bounded selectors matching adapters; publication remains forced | Gateway | Fixed before runtime; targeted tests PASS |
| F012 | P2 | Initial fixture data lacked public PDF/MPN; cleanup used unsupported navigation/system paths | Incomplete acceptance and unsafe recovery gaps | Explicit owned variants, native system paths and ownership/CAS recovery | Fixture tooling | Integrated corrections; full runtime apply pending |
| F013 | P2 | Fresh independent reviewer found published-product children/assets exposed with unpublished category | Visibility differed from product adapter | Enforce category absence-or-publication on child/asset references | Gateway | Reviewer fix integrated, gateway/race checks PASS |
| B003 | Runtime prerequisite | Full fixture apply stopped at service-user creation; manifest retains exact partial ownership | Local activation cannot proceed yet | Diagnose supported user-create validation; preserve evidence and clean up/retry only exact owned records | Fixture tooling | In progress; gateway remains disabled |

No P0 confirmed. Broad-prefix relevance, category/group caps and tied sort stability are P3/readiness notes unless a fixture demonstrates incorrect required behavior. Real 100k load and production topology remain pending.
