# Image-first default catalog ordering

BASE:9908e69086befbb3171a80174d0e9453b2d68f0d
Behavior: all non-search default/popular catalog listings place products with main_image before placeholders globally, before pagination. Preserve popularity/title within groups; add id tie-breaker. Explicit price/title order and SKU/OEM search relevance unchanged. Apply to catalog/brand/category consumers through shared adapter; mocks mirror semantics.
Allowed: storefront/lib/catalog.ts; directus/extensions/commerce-api/src/storefront.mjs and its exact generated dist/storefront.mjs copy; focused catalog/mock/query and gateway validation tests; this operational report.
Protected: schema, permissions/policies/identity/credentials, runtime catalog/media, Docker/deployment, dependencies, UI/theme/routes, RFQ/idempotency/search endpoints.
Plan: bounded native-compatible photo/nonphoto filtered queries with count-based page intersection and offsets; narrowly allow boolean-true null tests on products.main_image only plus exact deterministic sort. No full-catalog fetch or UUID image sorting. Worker implement/tests, lead inspect+verify, independent review, live extension restart within own existingCompose, fresh live build/start, actual first/boundary/late page+explicit-sort browser checks.
Acceptance: global image-first pages/counts/filters, stable tie order/no omissions/duplicates, unchanged explicit sorts and all search branches, no publication/access weakening, nativeDirectus+gateway support, bounded reads. Stop if protected schema/access/data surfaces required.


Result: implementation/review/local-runtime PASS. Catalog adapter uses two minimal filtered count probes and at most two page slices, each bounded by requested limit24; no full-catalog read. NativeDirectus-compatible queries use standard main_image null predicates and offsets; gateway permits only literaltrue null operators on products.main_image and exact deterministic popularity/title/id sort. Existing explicitsort and searchbranches remain unchanged.

Lead verification: storefront75/75, TypeScriptPASS; gateway16/16 including source/dist parityPASS; fullDirectus206PASS; freshLIVEproductionbuildPASS. Independent review: no unresolvedP0/P1/P2; P3only missing explicit all-image/no-image regression fixtures (mixed/boundary/out-of-range covered).

Live ownDirectus service reloaded without schema/access/config/data changes. Actualpublic HTML verified JohnDeere total12967: page1=12photos; page24=7photos then5placeholders; page25=12placeholders. Explicitprice_asc retains mixed photo/placeholder ordering. Gatewayphoto/nonphoto queries returnHTTP200. SitehealthHTTP200. Localruntimeupdated, no productiondeployment/mainmerge.

Targeted read-only Chromium browser PASS: defaultcatalog andJohnDeere brand/filter firstpage12/12photos; category supports photo-first grouping; explicittitle/price sorts permit placeholders and price order remains increasing; exactSKUsearch stillreturnsone matchingproduct. Boundary-page proof above is lead HTTP/HTML verification, not independently rerun browser proof. Browser checks did not mutate RFQ/catalog or rerun WebKit.
