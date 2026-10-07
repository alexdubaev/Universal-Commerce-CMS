import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { directusUrl, manifest, percentile } from "./support";
import { createMinimalXlsx } from "./xlsx-buffer";
import { recordLiveLead } from "./live-journal.mjs";
import { slugifyBrand } from "../lib/brands";
// @ts-expect-error The fixture oracle is a Node ESM helper outside the storefront TS project.
import { createFixturePlan } from "../../dev/storefront-acceptance-fixtures.mjs";

type FixtureOracleProduct = {
  slug: string; sku: string; mpn: string; brand: string; category: string;
  availability_status: string; part_type: string; price: number | null; status: string;
  is_indexable: boolean;
};
type FixtureOracle = {
  brands: string[];
  categories: Array<{ id: string; slug: string; title: string }>;
  products: FixtureOracleProduct[];
};

async function fixtureOracle(runId: string): Promise<FixtureOracle> {
  let sequence = 0;
  return createFixturePlan({ runId, random: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}` }) as FixtureOracle;
}

function cardSlugs(page: import("@playwright/test").Page) {
  return page.locator(".product-card .product-title").evaluateAll((links) => links.map((link) => new URL((link as HTMLAnchorElement).href).pathname.split("/").at(-1) ?? ""));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test.beforeEach(async () => {
  await manifest();
});

test("live CMS drives home, brands, facets, product children, and search", async ({ page }, testInfo) => {
  const fixture = await manifest();
  const refs = fixture.namedRefs;
  const oracle = await fixtureOracle(fixture.runId);
  const ownedProducts = fixture.created.products.map((id) => fixture.ownership.products[id]).filter((row): row is NonNullable<typeof row> => Boolean(row));
  const ownedCategories = fixture.created.categories.map((id) => fixture.ownership.categories[id]).filter((row): row is NonNullable<typeof row> => Boolean(row));
  const ownedBySlug = new Map(ownedProducts.map((row) => [row.slug, row]));
  for (const expected of oracle.products) {
    const actual = ownedBySlug.get(expected.slug);
    expect(actual, `owned fixture product ${expected.sku}`).toBeTruthy();
    expect(actual).toMatchObject({ sku: expected.sku, mpn: expected.mpn, brand: expected.brand, status: expected.status });
  }
  expect(fixture.ownership.products[refs.primaryProductId]?.slug).toBe(refs.primaryProductSlug);
  expect(oracle.products[0]?.slug).toBe(refs.primaryProductSlug);
  const categoryBySlug = new Map(ownedCategories.map((row) => [row.slug, row]));
  const expectedCategories = oracle.categories.map((category) => {
    const actual = categoryBySlug.get(category.slug);
    expect(actual, `owned fixture category ${category.slug}`).toMatchObject({ slug: category.slug, title: category.title });
    return { ...category, id: actual!.id };
  });
  const home = await page.goto("/");
  expect(home?.ok()).toBe(true);
  await expect(page.locator(".site-header")).toBeVisible();
  const headerNav = page.getByRole("navigation", { name: "Основная навигация" });
  if (testInfo.project.name.startsWith("mobile-")) {
    await page.getByRole("button", { name: "Открыть меню" }).click();
  }
  await expect(headerNav).toBeVisible();

  await page.goto("/brands");
  await expect(page.getByRole("heading", { name: "Бренды техники" })).toBeVisible();
  for (const brand of oracle.brands) {
    const slug = slugifyBrand(brand);
    const brandCard = page.locator(`.brand-card[href="/brand/${slug}"]`);
    await expect(brandCard).toBeVisible();
    await brandCard.click();
    await expect(page.getByRole("heading", { level: 1, name: brand })).toBeVisible();
    const expectedSlugs = oracle.products.filter((product) => product.brand === brand).map((product) => product.slug);
    const displayed = await cardSlugs(page);
    for (const slug of expectedSlugs) expect(displayed).toContain(slug);
    await page.goto("/brands");
  }

  await page.goto("/catalog");
  await expect(page.getByRole("heading", { name: "Каталог запчастей" })).toBeVisible();
  expect(await page.locator(".product-card").count()).toBeGreaterThan(0);
  for (const category of expectedCategories) {
    await page.goto(`/category/${category.slug}`);
    await expect(page.getByRole("heading", { name: category.title })).toBeVisible();
    const expectedSlugs = oracle.products.filter((product) => product.category === oracle.categories.find((item) => item.slug === category.slug)?.id).map((product) => product.slug);
    const displayed = await cardSlugs(page);
    for (const slug of expectedSlugs) expect(displayed).toContain(slug);
    await page.goto("/catalog");
    await expect(page.locator(`select[name="category"] option[value="${category.slug}"]`)).toHaveCount(1);
  }

  const categoryZero = expectedCategories[0];
  const groupProducts = oracle.products.filter((product) => product.category === oracle.categories[0].id && product.status === "published");
  const facet = groupProducts[0];
  const filteredUrl = `/catalog?brand=${encodeURIComponent(slugifyBrand(facet.brand))}&category=${encodeURIComponent(categoryZero.slug)}&availability=${facet.availability_status}&partType=${facet.part_type}&sort=price_asc`;
  await page.goto(filteredUrl);
  await expect(page.locator('select[name="category"]')).toHaveValue(categoryZero.slug);
  await expect(page.locator('select[name="availability"]')).toHaveValue(facet.availability_status);
  await expect(page.locator('select[name="partType"]')).toHaveValue(facet.part_type);
  const sortedSlugs = await cardSlugs(page);
  const sortedExpected = groupProducts
    .filter((product) => product.brand === facet.brand && product.availability_status === facet.availability_status && product.part_type === facet.part_type)
    .sort((left, right) => (left.price ?? Number.POSITIVE_INFINITY) - (right.price ?? Number.POSITIVE_INFINITY))
    .map((product) => product.slug);
  expect(sortedSlugs).toEqual(sortedExpected);
  const normalizedSku = facet.sku.replace(/[^\p{L}\p{N}]/gu, "");
  await page.goto(`${filteredUrl}&q=${encodeURIComponent(normalizedSku)}`);
  await expect(page.locator(`a[href="/product/${facet.slug}"]`).first()).toBeVisible();
  await page.goto(`${filteredUrl}&q=${encodeURIComponent(facet.mpn)}`);
  await expect(page.locator(`a[href="/product/${facet.slug}"]`).first()).toBeVisible();
  await page.goto("/catalog?page=2&sort=price_asc");
  await expect(page.locator(".product-card").first()).toBeVisible();

  await page.goto(`/product/${refs.primaryProductSlug}`);
  await expect(page.locator(".article-big strong")).toBeVisible();
  const sku = (await page.locator(".article-big strong").innerText()).trim();
  expect(sku.length).toBeGreaterThan(0);
  expect(refs.galleryFileIds.length).toBeGreaterThan(0);
  expect(await page.locator(".product-media img").count()).toBeGreaterThan(0);
  const mainGalleryImage = page.locator(".product-main-image");
  const initialGallerySrc = await mainGalleryImage.getAttribute("src");
  const secondThumbnail = page.getByRole("button", { name: "Показать изображение 2" });
  await expect(secondThumbnail).toBeVisible();
  const selectedGallerySrc = await secondThumbnail.locator("img").getAttribute("src");
  await secondThumbnail.click();
  await expect(mainGalleryImage).toHaveAttribute("src", selectedGallerySrc!);
  expect(selectedGallerySrc).not.toBe(initialGallerySrc);
  await expect(page.locator(".document-list a").first()).toBeVisible();
  await expect(page.locator(".code-list")).toBeVisible();
  await expect(page.locator(".product-relations")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Основные данные" })).toBeVisible();
  const mpn = await page.locator(".spec-list div").filter({ has: page.locator("dt", { hasText: /^MPN$/ }) }).locator("dd").textContent();
  expect(mpn?.trim()).toBeTruthy();

  await page.goto(`/catalog?q=${encodeURIComponent(sku.replace(/[^\p{L}\p{N}]/gu, ""))}`);
  await expect(page.locator(`a[href="/product/${refs.primaryProductSlug}"]`).first()).toBeVisible();
  await page.goto(`/catalog?q=${encodeURIComponent(mpn!.trim())}`);
  await expect(page.locator(`a[href="/product/${refs.primaryProductSlug}"]`).first()).toBeVisible();
});

test("published and non-indexable product visibility matches sitemap and metadata", async ({ page, request }) => {
  const refs = (await manifest()).namedRefs;
  const index = await request.get("/sitemap.xml");
  expect(index.ok()).toBe(true);
  expect(await index.text()).toContain("/sitemaps/products-0.xml");
  const productMap = await request.get("/sitemaps/products-0.xml");
  expect(productMap.ok()).toBe(true);
  const xml = await productMap.text();
  expect(xml.includes(`/product/${refs.primaryProductSlug}`)).toBe(true);
  expect(xml.includes(`/product/${refs.nonIndexableProductSlug}`)).toBe(false);

  await page.goto(`/product/${refs.nonIndexableProductSlug}`);
  await expect(page.locator(".product-page h1")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("public assets return bytes with safe headers and reject private or unknown files", async ({ request }) => {
  const refs = (await manifest()).namedRefs;
  expect(refs.galleryFileIds.length).toBeGreaterThan(0);
  for (const [fileId, expectedType, disposition] of [
    [refs.galleryFileIds[0], /^image\//, /^inline/i],
    [refs.publicDocumentFileId, /^application\/pdf/, /^inline/i],
  ] as const) {
    const response = await request.get(`/api/assets/${fileId}`);
    expect(response.ok()).toBe(true);
    const headers = response.headers();
    expect(headers["content-type"]).toMatch(expectedType);
    expect(headers["content-disposition"]).toMatch(disposition);
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["content-security-policy"]).toContain("sandbox");
    expect(headers["cache-control"]).toContain("no-store");
    expect((await response.body()).byteLength).toBeGreaterThan(0);
  }
  const activeHtml = await request.get(`/api/assets/${refs.htmlFileId}`);
  expect(activeHtml.ok()).toBe(true);
  expect(activeHtml.headers()["content-type"]).toMatch(/^application\/octet-stream/);
  expect(activeHtml.headers()["content-disposition"]).toMatch(/^attachment/i);
  expect(activeHtml.headers()["x-content-type-options"]).toBe("nosniff");
  expect(activeHtml.headers()["content-security-policy"]).toContain("sandbox");
  expect(activeHtml.headers()["cache-control"]).toContain("no-store");
  expect((await activeHtml.body()).byteLength).toBeGreaterThan(0);
  for (const fileId of [refs.privateAssetId!, refs.draftReferencedAssetId!, refs.unreferencedAssetId!, randomUUID()]) {
    const response = await request.get(`/api/assets/${fileId}`);
    expect(response.ok()).toBe(false);
  }
});

test("service identity reaches only guarded read/write gateway surfaces", async ({ request }) => {
  const fixture = await manifest();
  const oracle = await fixtureOracle(fixture.runId);
  const url = directusUrl();
  const auth = { Authorization: `Bearer ${fixture.service.token}` };
  const directusFetch = async (path: string, init: RequestInit = {}) => fetch(`${url}${path}`, { ...init, headers: { ...auth, ...init.headers } });
  const gatewayRead = async (path: string) => {
    const response = await directusFetch(`/commerce/storefront/items/${path}`);
    expect(response.ok, `Guarded gateway ${path} returned HTTP ${response.status}.`).toBe(true);
    const body = await response.json().catch(() => null);
    return body?.data;
  };
  const positive = await directusFetch(`/commerce/storefront/items/products?fields=id,slug,sku&limit=1&filter=${encodeURIComponent(JSON.stringify({ id: { _eq: fixture.namedRefs.primaryProductId } }))}`);
  expect(positive.ok).toBe(true);
  const positiveBody = await positive.json().catch(() => null);
  const primary = Array.isArray(positiveBody?.data) ? positiveBody.data.find((item: { id?: string }) => item.id === fixture.namedRefs.primaryProductId) : null;
  expect(typeof primary?.sku).toBe("string");

  const aggregateQuery = new URLSearchParams({
    "aggregate[count]": "*",
    "groupBy[]": "brand",
    limit: "500",
    filter: JSON.stringify({ _and: [{ status: { _eq: "published" } }, { brand: { _nnull: true } }] }),
  });
  const aggregateResponse = await directusFetch(`/commerce/storefront/items/products?${aggregateQuery}`);
  expect(aggregateResponse.ok, `Guarded brand aggregate returned HTTP ${aggregateResponse.status}.`).toBe(true);
  const aggregateBody = await aggregateResponse.json().catch(() => null);
  expect(Array.isArray(aggregateBody?.data)).toBe(true);
  const aggregateRows = aggregateBody.data as Array<{ brand?: unknown; count?: unknown }>;
  for (const brand of oracle.brands) {
    const row = aggregateRows.find((candidate) => candidate.brand === brand);
    expect(row, `brand aggregate row for ${brand}`).toBeTruthy();
    const countValue = row?.count;
    const numericCount = typeof countValue === "number" || typeof countValue === "string"
      ? Number(countValue)
      : countValue && typeof countValue === "object"
        ? Number(Object.values(countValue as Record<string, unknown>)[0])
        : Number.NaN;
    expect(Number.isFinite(numericCount) && numericCount >= 5, `brand aggregate count for ${brand}`).toBe(true);
  }

  const settings = await gatewayRead("site_settings?fields=company_name,phone,email");
  expect(Boolean(settings && typeof settings === "object" && !Array.isArray(settings))).toBe(true);
  expect("commerce_profile" in settings).toBe(false);
  const home = await gatewayRead("home_page?fields=id,status,h1,hero_title,hero_text,hero_image,seo_title,seo_description,is_indexable");
  expect(Boolean(home && typeof home === "object" && home.status === "published")).toBe(true);
  const pageFilter = encodeURIComponent(JSON.stringify({ _and: [{ id: { _eq: fixture.namedRefs.pageId } }, { status: { _eq: "published" } }] }));
  const pages = await gatewayRead(`pages?fields=id,slug,title,page_type,h1,is_indexable&limit=1&filter=${pageFilter}`);
  expect(Array.isArray(pages) && pages.some((row: { id?: string }) => row.id === fixture.namedRefs.pageId)).toBe(true);
  const sectionFilter = encodeURIComponent(JSON.stringify({ _and: [{ page: { _eq: fixture.namedRefs.pageId } }, { status: { _eq: "published" } }, { is_visible: { _eq: true } }] }));
  const sections = await gatewayRead(`page_sections?fields=id,section_type,title,subtitle,text,image,image_alt,button_text,button_url,items,settings&limit=1&sort=sort_order&filter=${sectionFilter}`);
  expect(Array.isArray(sections) && sections.length > 0).toBe(true);
  const navigationFilter = encodeURIComponent(JSON.stringify({ _and: [{ status: { _eq: "published" } }, { is_visible: { _eq: true } }, { location: { _eq: "header" } }, { parent: { _null: true } }] }));
  const navigation = await gatewayRead(`navigation_items?fields=id,label,url,location,open_in_new_tab&limit=1&sort=sort_order&filter=${navigationFilter}`);
  expect(Array.isArray(navigation) && navigation.length > 0).toBe(true);

  const nativeReadPaths = [
    "/items/products?limit=1",
    "/files?limit=1",
    `/assets/${fixture.namedRefs.galleryFileIds[0]}`,
    "/users?limit=1",
    "/roles?limit=1",
    `/commerce/search?q=${encodeURIComponent(primary.sku)}`,
  ];
  for (const path of nativeReadPaths) {
    const response = await directusFetch(path).catch(() => null);
    expect(response !== null && response.status === 403, `Native service-token read ${path} expected permission denial; received HTTP ${response?.status ?? "network-error"}.`).toBe(true);
  }
  const nativeLeadKey = randomUUID();
  const nativeLeadMutation = await directusFetch("/commerce/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ request_key: nativeLeadKey, lead: { name: "Synthetic native denial", phone: "+79990000004", email: "native-denial@example.invalid", product: fixture.namedRefs.primaryProductId, request_items: [{ article: "LIVE-NATIVE-DENIAL", quantity: 1 }], page_url: "http://127.0.0.1:3001/request" } }) }).catch(() => null);
  if (nativeLeadMutation?.ok) {
    const body = await nativeLeadMutation.json().catch(() => null);
    if (typeof body?.data?.id === "string") await recordLiveLead(fixture.runId, nativeLeadKey, body.data.id, "native-denial-regression");
  }
  expect(nativeLeadMutation?.status, `Native lead write expected permission denial; received HTTP ${nativeLeadMutation?.status ?? "network-error"}.`).toBe(403);
  const disabledOrders = await directusFetch("/commerce/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ request_key: randomUUID(), order: { customer_name: "Synthetic native denial", phone: "+79990000004", page_url: "http://127.0.0.1:3001/request", currency: "RUB" }, items: [{ product: fixture.namedRefs.primaryProductId, quantity: 1, unit_price: 1 }] }) }).catch(() => null);
  expect(disabledOrders?.status, `Native order write expected permission denial; received HTTP ${disabledOrders?.status ?? "network-error"}.`).toBe(403);
  const guardedOrders = await directusFetch("/commerce/storefront/orders", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => null);
  expect(guardedOrders?.status).toBe(404);

  const deniedGatewayPaths = [
    "/commerce/storefront/items/not_allowed?limit=1",
    "/commerce/storefront/items/products?fields=*&limit=1",
  ];
  for (const path of deniedGatewayPaths) {
    const response = await directusFetch(path).catch(() => null);
    expect(response !== null && !response.ok).toBe(true);
  }
  const anonymous = await fetch(`${url}/commerce/storefront/items/products?fields=id&limit=1`).catch(() => null);
  expect(anonymous !== null && !anonymous.ok).toBe(true);
  const wrongCaller = await fetch(`${url}/commerce/storefront/items/products?fields=id&limit=1`, { headers: { Authorization: "Bearer invalid-live-acceptance-token" } }).catch(() => null);
  expect(wrongCaller !== null && !wrongCaller.ok).toBe(true);
});

test("RFQ manual, CSV, TXT and XLSX imports edit and remove items without sending attachments", async ({ page }) => {
  await page.goto("/request");
  await page.getByLabel("Артикулы").fill("LIVE-MANUAL-A 2\nLIVE-MANUAL-B 1");
  await page.getByRole("button", { name: "Добавить список" }).click();
  await expect(page.getByText(/Список: добавлено 2/)).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "live-list.csv", mimeType: "text/csv", buffer: Buffer.from("article;quantity\nLIVE-CSV-A;3\n") });
  await expect(page.getByText(/CSV\/TXT: добавлено 1/)).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "live-list.txt", mimeType: "text/plain", buffer: Buffer.from("LIVE-TXT-A 4\n") });
  await expect(page.getByText(/CSV\/TXT: добавлено 1/)).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "live-list.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: createMinimalXlsx() });
  await expect(page.getByText(/XLSX: добавлено 1/)).toBeVisible();
  const manual = page.locator(".request-line").filter({ hasText: "LIVE-MANUAL-A" });
  await manual.getByRole("button", { name: /Увеличить количество/ }).click();
  await expect(manual.locator(".qty b")).toHaveText("3");
  await manual.getByRole("button", { name: /Удалить/ }).click();
  await expect(manual).toHaveCount(0);
  await expect(page.locator(".request-line")).toHaveCount(4);
  await page.getByLabel("Компания").fill("Synthetic Live UI");
  await page.getByLabel("Контактное лицо").fill("Live UI Acceptance");
  await page.getByLabel("Телефон").fill("+79990000002");
  await page.getByLabel("Email").fill("live-ui@example.invalid");
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/lead") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Отправить менеджеру" }).click();
  const leadResponse = await responsePromise;
  const payload = leadResponse.request().postDataJSON() as { request_key?: string };
  const acknowledgement = await leadResponse.json().catch(() => null);
  if (typeof payload.request_key === "string" && typeof acknowledgement?.id === "string") {
    await recordLiveLead((await manifest()).runId, payload.request_key, acknowledgement.id, "browser-rfq");
  }
  expect(leadResponse.ok()).toBe(true);
  expect(typeof acknowledgement?.id).toBe("string");
  await expect(page.getByText(/Заявка принята\. Номер:/)).toBeVisible();
  await expect(page.getByText("Список пока пуст")).toBeVisible();
});

test("real RFQ writes handle concurrent replay, changed-payload conflict, and invalid input", async ({ request }) => {
  const key = randomUUID();
  const payload = {
    request_key: key,
    company: "Synthetic Live Acceptance",
    name: "Live Acceptance",
    phone: "+79990000001",
    email: "live-acceptance@example.invalid",
    message: "synthetic persistence probe",
    request_items: [{ article: "LIVE-ACCEPTANCE", quantity: 2 }],
    page_url: "http://127.0.0.1:3001/request",
  };
  const responses = await Promise.all(Array.from({ length: 8 }, () => request.post("/api/lead", { data: payload })));
  const bodies = await Promise.all(responses.map((response) => response.json().catch(() => null)));
  for (const body of bodies) {
    if (typeof body?.id === "string") await recordLiveLead((await manifest()).runId, key, body.id, "browser-api", responses.length);
  }
  expect(responses.every((response) => response.ok())).toBe(true);
  expect(new Set(bodies.map((body) => body?.id)).size).toBe(1);
  expect(bodies.some((body) => body?.replayed === true)).toBe(true);

  const changed = await request.post("/api/lead", { data: { ...payload, message: "changed payload" } });
  const changedBody = await changed.json().catch(() => null);
  if (typeof changedBody?.id === "string") await recordLiveLead((await manifest()).runId, key, changedBody.id, "browser-conflict", 1);
  expect(changed.status()).toBe(409);
  const invalidKey = randomUUID();
  const invalid = await request.post("/api/lead", { data: { ...payload, request_key: invalidKey, name: "x" } });
  const invalidBody = await invalid.json().catch(() => null);
  if (typeof invalidBody?.id === "string") await recordLiveLead((await manifest()).runId, invalidKey, invalidBody.id, "browser-invalid", 1);
  expect(invalid.status()).toBe(400);
});

test("navigation keyboard behavior, responsive routes, no token leakage, and bounded timings", async ({ page, request }, testInfo) => {
  const refs = (await manifest()).namedRefs;
  const token = (await manifest()).service.token;
  const requestTokenLeaks: boolean[] = [];
  let responseBodyContainsToken = false;
  page.on("request", (browserRequest) => {
    const headers = browserRequest.headers();
    requestTokenLeaks.push(Object.values(headers).some((value) => value.includes(token))
      || Boolean(browserRequest.postData()?.includes(token)));
  });
  const inspectResponse = async (route: import("@playwright/test").Route) => {
    const resourceType = route.request().resourceType();
    if (!["document", "script", "xhr", "fetch"].includes(resourceType)) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const body = await response.body();
    if (body.includes(Buffer.from(token))) responseBodyContainsToken = true;
    await route.fulfill({ response, body });
  };
  await page.route("**/*", inspectResponse);
  try {
    await page.goto("/");
    if (testInfo.project.name.startsWith("mobile-")) {
      const toggle = page.getByRole("button", { name: "Открыть меню" });
      await toggle.click();
      await expect(page.getByRole("navigation", { name: "Основная навигация" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("navigation", { name: "Основная навигация" })).toBeHidden();
      await expect(toggle).toBeFocused();
    } else {
      await page.keyboard.press("Tab");
      await expect(page.locator(".skip-link")).toBeFocused();
    }
    for (const route of ["/", "/catalog", "/brands", `/product/${refs.primaryProductSlug}`, "/request"]) {
      const response = await page.goto(route);
      expect(response?.ok()).toBe(true);
      const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      expect(dimensions.width <= dimensions.viewport + 1).toBe(true);
    }
    const missing = await page.goto(`/live-acceptance-missing-${randomUUID()}`);
    expect(missing?.status()).toBe(404);
  } finally {
    await page.unroute("**/*", inspectResponse);
  }

  const html = await page.content();
  expect(html.includes(token)).toBe(false);
  const scripts = await page.locator("script[src]").evaluateAll((items) => items.map((item) => (item as HTMLScriptElement).src));
  for (const scriptUrl of scripts) {
    const response = await request.get(scriptUrl).catch(() => null);
    if (!response?.ok()) continue;
    expect((await response.text()).includes(token)).toBe(false);
  }
  expect([...requestTokenLeaks, responseBodyContainsToken].some(Boolean)).toBe(false);

  await page.goto(`/product/${refs.primaryProductSlug}`);
  const sku = (await page.locator(".article-big strong").innerText()).trim();
  const capturedMpn = (await page.locator(".spec-list div").filter({ has: page.locator("dt", { hasText: /^MPN$/ }) }).locator("dd").textContent())?.trim();
  expect(capturedMpn).toBeTruthy();
  await page.goto("/brands");
  const brandPath = await page.locator(".brand-card").first().getAttribute("href");
  expect(Boolean(brandPath)).toBe(true);
  const probes: Array<[string, string]> = [
    ["catalog", "/catalog"],
    ["search", `/api/search?q=${encodeURIComponent(sku)}`],
    ["brand", brandPath!],
    ["product", `/product/${refs.primaryProductSlug}`],
    ["sitemap", "/sitemap.xml"],
    ["asset", `/api/assets/${refs.galleryFileIds[0]}`],
  ];
  for (const [surface, route] of probes) {
    const samples: number[] = [];
    for (let index = 0; index < 5; index++) {
      const start = performance.now();
      const response = await request.get(route);
      expect(response.ok()).toBe(true);
      samples.push(performance.now() - start);
    }
    const p50 = percentile(samples, 0.5);
    const p95 = percentile(samples, 0.95);
    console.log(`LIVE_SYNTHETIC_PERF surface=${surface} cache=warm samples=${samples.length} p50_ms=${p50.toFixed(1)} p95_ms=${p95.toFixed(1)} fixture=small`);
  }
  const fixture = await manifest();
  const gatewayToken = fixture.service.token;
  for (const [surface, query] of [["sku", sku], ["mpn", capturedMpn!]] as const) {
    const samples: number[] = [];
    for (let index = 0; index < 5; index++) {
      const started = performance.now();
      const response = await fetch(`${directusUrl()}/commerce/storefront/search?q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${gatewayToken}` } });
      expect(response.ok, `Direct gateway ${surface} returned HTTP ${response.status}.`).toBe(true);
      samples.push(performance.now() - started);
    }
    console.log(`LIVE_SYNTHETIC_PERF surface=gateway-${surface} cache=direct samples=${samples.length} p50_ms=${percentile(samples, 0.5).toFixed(1)} p95_ms=${percentile(samples, 0.95).toFixed(1)} fixture=small`);
  }
  const brandSamples: number[] = [];
  const brandAggregateQuery = new URLSearchParams({
    "aggregate[count]": "*",
    "groupBy[]": "brand",
    limit: "500",
    filter: JSON.stringify({ _and: [{ status: { _eq: "published" } }, { brand: { _nnull: true } }] }),
  });
  for (let index = 0; index < 5; index++) {
    const started = performance.now();
    const response = await fetch(`${directusUrl()}/commerce/storefront/items/products?${brandAggregateQuery}`, { headers: { Authorization: `Bearer ${gatewayToken}` } });
    expect(response.ok, `Direct gateway brand aggregate returned HTTP ${response.status}.`).toBe(true);
    brandSamples.push(performance.now() - started);
  }
  console.log(`LIVE_SYNTHETIC_PERF surface=gateway-brand cache=direct samples=${brandSamples.length} p50_ms=${percentile(brandSamples, 0.5).toFixed(1)} p95_ms=${percentile(brandSamples, 0.95).toFixed(1)} fixture=small`);
});
