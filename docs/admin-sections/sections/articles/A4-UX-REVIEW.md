# A4 independent review and local verification

Date: 2026-10-25. Base: `6db7cb33f0ed240d0445ba7a90cfbc21a9fec382`.

The owner approved the displayed variant with “Реализуй”. The review covered the article source/distribution/test diff against issues #20/#22 and the approved proposal. One fresh independent reviewer examined permissions, relation resolution, unknown values, SEO projections, guarded writes, reconciliation, read-back and native edit authorization. The owner policy permits one bounded fix pass followed by narrow closure, without a second whole-change review.

## Confirmed findings and closure

- Readable product brands were omitted. Labels/search now request and use brand only when permitted. The allowed/denied permission regression passes.
- String coercion could match an unknown numeric relation to a valid string slug. A failing `[UUID, 123, "123"]` regression reproduced an unauthorized removal affordance. Only string references can now match or unlink readable records; unknown entries survive.
- Validation blocked unrelated saves with legacy JSON strings and rejected intentionally edited legacy string-array relations. Failing controller regressions reproduced the problem. Unchanged baseline JSON strings are preserved; changed strings are accepted only for the two relation fields when they parse as arrays. Creation and other changed JSON values remain strict. Coverage includes structural, translation and search data, unknown entries and rejection of a malformed intentional edit.

The lead adjudicated these fixes within A4 and inspected the resulting diff. No confirmed P0/P1/P2 code finding remains. Installed runtime and visual acceptance are separately documented; this review alone does not prove them.

## Deterministic evidence

Final article behavior tests: 38 passed. Shared A0 state tests: 37 passed. Final source/distribution bytes match, SHA256 `f2b358e72ec4ee2760d87c8df76aac4229353428f876921db3180994863cdda5`. `git diff --check` passed.

The documented local release command is `node scripts/verify-local.mjs`: backend tests, storefront tests, dependency audit, production build including TypeScript, deployment/client-secret checks and both critical Chromium journeys. Final evidence is recorded in the acceptance report; subsequent documentation-only changes do not change the checked product bytes.

An installed visual closure removed duplicate outer/native labels, retained native required labels, made relation cards full width, kept the mobile unlink button readable and corrected article-only text contrast. The independent reviewer compared the actual desktop material screen with the approved reference and found no blocker. Actual computed contrast for custom helper/status/tab/warning/disabled text is 5.54–5.81:1; badge color pairs are above 5.25:1. Native editor height differs from the static reference to retain its existing workspace. This is visual closure of the same review, not a second mandatory whole-change review.

Installed testing also reproduced an error presentation defect: the shared native form ignores generic article validation types, so a required-field failure disabled Save without an explanation. The scoped fix adds a local accessible summary with business labels and fixed Russian guidance, retaining the shared form and write guards. The reviewer inspected the safe text rendering and then the actual desktop/mobile error captures. The native scenario confirms no POST for the invalid value, editable input, visible required guidance and successful corrected save. A final mobile CSS closure removes a stale article-only `nowrap` override so all five tabs wrap as proposed.

Before-fix evidence is retained privately: the original busy-state regression failed, and a real installed Directus relation check showed the selected readable product title becoming its UUID after a different search. The latter used a new unsaved form with writes blocked. These are distinct from fixture/runtime acceptance and historical A4 reports.

## Release safeguards

Only the two article source/distribution files are installed. Eight isolated installer guard tests passed. The installer verifies target/container/mount/loopback identity, source bytes, expected installed hashes, unrelated extension inventory and backup integrity; receipts and write-ahead recovery data stay private.

A real artifact rollback was rehearsed from candidate 1 to the pre-A4 baseline. Authenticated health passed on Directus 12.1.1 and the served aggregate returned to SHA256 `d8a9f876785624c5d32b2805642c3240e5f8a1897c1f5341e93374b5a0f09d1c`. No database or uploads restore was performed. Candidate 2 was subsequently installed with authenticated health and served aggregate checks passing. Final release identity and installed screenshots belong to the release HANDOFF.
