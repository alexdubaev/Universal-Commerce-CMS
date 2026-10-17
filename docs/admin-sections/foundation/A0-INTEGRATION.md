# A0 integration audit — 2026-10-17

## Scope and baseline

Requested behavior: finish and integrate the existing reusable A0 foundation, preserving the current product editor and leaving all specialized section editors inactive.

Fresh GitHub baseline: `main` at `dc32325873f43a1bc34c86e563dd74fe7df17717`. Historical A0: `codex/a0-editor-foundation` at `e5a9bd70d54fd74ed02769205028ffc7757f9f2f`, two own commits (`5683ec5`, `e5a9bd7`) and 92 commits behind main. Merge base: `933f8a6b257202a51697a6821f9d128ba074d019`.

Work is isolated on `codex/a0-foundation-integration`, created from fresh `origin/main`. The original checkout's unrelated dirty work is untouched. Historical A0 files are reused selectively, with only the minimal module export/route addition applied to current main; the historical branch is not the project baseline.

Allowed files: this extension's A0 source/dist modules, directly related tests, minimal `src/index.js`/`dist/index.js` registration, and A0 contract/audit documentation. Schema, access policies, credentials, other modules, storefront, dependencies, deployment configuration and independent environments are protected.

## Execution plan

1. Read-only discovery maps historical A0, current product editor and current API contracts.
2. One implementation owner transfers existing foundation files, reproduces and fixes concrete A0 defects with relevant behavioral tests, and keeps source/dist identical.
3. Lead inspects actual changes and runs the root local gate. Independent runtime verification exercises Directus 12.1.1 with synthetic owned fixtures and short desktop/mobile browser checks. No production acceptance is inferred from mocks or component harnesses.
4. One fresh independent review examines the final active change; confirmed blocking findings receive one bounded fix pass and affected closure checks.
5. Only a verified candidate may be committed, pushed and merged. Verify final main ancestry and tree against the checked candidate. Production deployment requires a positively identified target and existing safe update/rollback procedure; otherwise report DEPLOY BLOCKED.

## Verification record

Initial `node scripts/verify-local.mjs`: PASS on the fresh-main baseline (109 backend cases). Final candidate: PASS, 169 backend cases, 36 storefront cases, zero dependency vulnerabilities, successful production build/client-token canary check and two Chromium journeys. No GitHub Actions are introduced.

Focused product/A0 command: `node --test directus/extensions/deere-shop-product-editor/test/editor-state.test.mjs directus/extensions/deere-shop-product-editor/test/admin-state.test.mjs directus/extensions/deere-shop-product-editor/test/page-sections.test.mjs`: 65 PASS / 0 FAIL (five existing product cases plus 60 A0 cases). No skipped cases.

Opt-in runtime command, run from the repository root with the approved own development credentials loaded privately:

```sh
node --env-file='<approved-dev-env>' directus/extensions/deere-shop-product-editor/verification/a0-runtime.mjs --synthetic-probe
```

Real Directus 12.1.1/PostgreSQL 17 acceptance on `http://127.0.0.1:18056`: 27 PASS / 0 FAIL, including six fixture cleanups. It verifies actual native product draft creation and edit-route transition, cross-tab edits, save, cancelled dirty navigation, visible browser 409, server CAS conflict/reconciliation, concurrent writers, late HTTP responses, anonymous denial, forbidden system-field updates, child reparent conflict with retained edits, native file-library selection/removal of an own PNG, A0 exports and the inactive section route. Product and A0 desktop 1536x1024/mobile 390x844 checks pass without document overflow. No uncaught exceptions or unresolved-component/invalid-prop warnings.

Generic A0 components are mounted through an isolated browser-only harness using the real Directus Vue/app/native components; this does not register a specialized editor. Authenticated smoke uses the existing Administrator. Anonymous denial is real; field-permission denial in the harness is a controlled UI check, not acceptance of an unprovisioned restricted role. No users, roles, permissions or schema are changed.

The lead inspected screenshots and the runtime results, confirmed container/local dist SHA-256 identity, and independently confirmed zero remaining owned products/pages/page_sections/files and authenticated health HTTP 200. Artifacts are outside Git in the system temp `universal-cms-a0` directory. The script is outside `test/`, requires an explicit flag and is not discovered by the ordinary `node --test` gate.

`git diff --check` passes. All five source/dist pairs match byte-for-byte. One fresh independent final review found no P0/P1/P2 findings; the final runtime-script additions received a narrow closure review. No second whole-change review was required by the owner's policy.

## Component readiness matrix

| Component | Final status | Evidence / contract |
| --- | --- | --- |
| AdminShell / scoped tokens | Ready | Native private-view, responsive shell, local 40px controls, explicit dirty/saving input |
| DirtyGuard (embedded) | Ready | Route/update/unload guards, cancelled navigation retains edits, saving blocks departure |
| SectionTabs | Ready | Controlled tabs, keyboard behavior, retained edits across native forms |
| EditorToolbar | Ready | Permission/read-only/save/conflict gates; publication off by default |
| ConflictNotice (embedded) | Ready | 409 retains local data; explicit comparison/reconciliation before retry |
| NativeFieldGroup | Ready | Explicit field subset, native metadata/interfaces, labels, delta/reset, current field permissions |
| CollectionList / buildCollectionQuery | Ready | Bounded explicit fields, pagination, controlled selection/search/sort/filter/retry |
| MediaPicker | Ready | Native file library selects/unlinks own PNG; reset restores original asset; no file deletion on unlink |
| ReadonlyDetails | Ready | Explicit read-only fields; mounted in actual Vue context |
| createEditorState / mergeTabValues | Ready | Detached baseline, changed-field CAS, nullable initial version, stale-response and conflict protection; imperative Vue bridge documented |
| PageSectionEditor / controller | Ready | Separate child baseline/save, both owner checks and expected fields, reparent409 retains local values; parent snapshot isolation is not claimed |
| Exports / registry / routes | Ready | Frozen empty registry; unavailable section route; existing list/+/:id product routes preserved |

## Audit findings and integration decisions

- Restoring a native file-field delta to its baseline previously emitted `null`, potentially unlinking an existing asset. MediaPicker now distinguishes omission from an explicit removal and restores the original relation ID.
- Live Directus 12.1.1 creates records with `updated_at: null`. Historical A0 rejected them before their first edit. A0 now requires the version property to be present while accepting its legitimate null value, matching the existing guarded API and product editor.
- Child-section writes now recheck read permission for both owner fields after loading. The original `page` and `home_page` are included in the child's guarded expected snapshot. No server permission or schema changes were required.
- Raw native field metadata initially produced empty labels. The field adapter now preserves an enriched translated name and otherwise uses the field name. Scoped A0 button/tab/pager styles account for Directus' HTML resets without changing product or native-field styles.
- The latest main's `navigation_items` guarded API support is acknowledged in CONTRACTS. The A0 registry remains empty; this does not activate a navigation editor or claim completion of G1/G2.
- Current main retains five product-state tests following the owner's earlier test consolidation. Historical references to sixteen tests do not justify restoring deleted markup snapshots. The five current cases are preserved unchanged. A0 retains behavioral permission/race/event coverage and removes incidental fake-VNode/export/style assertions.

The existing product editor remains in place with its original routes and product-specific helpers. A0 reuses the historical shared foundation rather than introducing a second product editor. The generic complete-value state and the product editor's existing delta/media state have different consumer contracts; no product-wide migration is attempted.

## Production deployment evidence

Read-only GitHub inspection returned no repository environments and no deployments. The only tracked deployment-like stack is the loopback development `dev/compose.yml`; README explicitly distinguishes main integration from production acceptance. No production host, directory, domain, credentials or update/rollback procedure has been positively identified. Production deploy is therefore **DEPLOY BLOCKED**, independently of safe source integration. No infrastructure is created for A0.

## Continuation rules

A0 is ready as a foundation for a separately authorized Categories task; no Categories implementation is included here. Follow CONTRACTS for API adapters, current permissions, nullable versions, native deltas and child dirty/saving propagation. Every future specialized editor must verify its own live schema, permissions and guarded API before activation. G1/G2 remain separate scopes.

User rule to pass to the next agent: all following specifications, agent prompts and final handoffs must be in copyable blocks. Each next assignment covers one concrete task. Independent checks may run in parallel. One task uses one temporary branch and one verified PR from fresh origin/main. When checks are green, the agent performs commit, push, review, merge and a safe deploy only when the target is confirmed, without asking for repeated permission. After verifying main, synchronize the local main and remove only the task's own merged remote/local branch and clean temporary worktree. Never delete another task's branch, worktree or unfinished work.
