# A1 Categories — implementation and acceptance

Baseline: d5999f0dba8e7369a5b3c32b351a8792fbfe718e. Branch: codex/a1-categories-editor. One implementation owner; independent review only is delegated.

Requested behavior and allowed files: categories source/dist/test, minimal index source/dist registration in a separate integration commit, this directory's audit and verification/a1-categories-runtime.mjs. Protected: schema, permissions, API/hooks, storefront, dependencies, infrastructure, other editors and original dirty checkout.

1. Verify live schema, current effective collection/item permissions, native create and guarded updates on exact owned synthetic draft IDs. Parent stays readonly: no transactional server cycle guard exists. Deletion is absent.
2. Add bounded list query/controller with title/slug/h1 OR search, status/parent/home/index filters, stable sorting and 25-row pagination; add metadata-driven form/controller using A0 state, native field subsets, media library, SEO plugin, validation, explicit conflict comparison/reconciliation and uncertain-write recovery. Verify native draft creation before enabling it; unknown permission/contract means closed.
3. Register categories alone and add an entry from existing product list in a separate integration commit. Preserve product routes and code.
4. Focused behavioral tests, src/dist parity, root local command; actual Directus/PostgreSQL runtime/browser checks on owned fixtures, desktop 1536x1024/mobile 390x844, exact ID ledger and cleanup verification. Browser serves candidate module in-session because the approved running stack mounts an unrelated worktree. Do not mutate that checkout or restart it.
5. Fresh independent security/correctness review, bounded fixes and narrow closure verification. Fetch main, publish verified source by commit/push/PR/merge; verify ancestry/tree and synchronize local main without switching dirty checkout. Remove only own merged branch and clean worktree. Deploy only to confirmed safe own production target.

Stop conditions: protected-area change, schema/permissions mismatch affecting safe writes, failing required checks, unresolved significant review issue. Safe readonly portions remain available. Production target absence blocks deployment only.
