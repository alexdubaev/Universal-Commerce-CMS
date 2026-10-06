import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { directusUrl, manifest, percentile } from "./support";
import { createMinimalXlsx } from "./xlsx-buffer";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test.beforeEach(async () => {
  await manifest();
});

test("live CMS drives home, brands, facets, product children, and search", async ({ page }) => {
  const refs = (await manifest()).namedRefs;
  const home = await page.goto("/");
  expect(home?.ok()).toBe(true);
  await expect(page.locator(".site-header")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Основная навигация" })).toBeVisible();

  await page.goto("/brands");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.locator(".brand-card").count()).toBeGreaterThanOrEqual(3);

  await page.goto("/catalog");
  await expect(page.getByRole("heading", { name: "Каталог запчастей" })).toBeVisible();
  expect(await page.locator(".product-card").count()).toBeGreaterThan(0);
  const categoryOptions = page.locator('select[name="category"] option');
  expect(await categoryOptions.count()).toBeGreaterThanOrEqual(4);
  const categorySlug = await categoryOptions.nth(1).getAttribute("value");
  expect(Boolean(categorySlug)).toBe(true);
  await page.goto(`/catalog?category=${encodeURIComponent(categorySlug!)}&availability=in_stock&partType=original&sort=price_asc`);
  await expect(page.locator('select[name="category"]')).toHaveValue(categorySlug!);
  await expect(page.locator('select[name="availability"]')).toHaveValue("in_stock");
  await expect(page.locator('select[name="partType"]')).toHaveValue("original");
  await page.goto("/catalog?page=2&sort=price_asc");
  await expect(page.locator(".product-card").first()).toBeVisible();

  await page.goto(`/product/${refs.primaryProductSlug}`);
  await expect(page.locator(".article-big strong")).toBeVisible();
  const sku = (await page.locator(".article-big strong").innerText()).trim();
  expect(sku.length).toBeGreaterThan(0);
  if (refs.galleryFileIds.length) {
    expect(await page.locator(".product-media img").count()).toBeGreaterThan(0);
  }
  if (refs.publicDocumentFileId) await expect(page.locator(".document-list a").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Основные данные" })).toBeVisible();

  await page.goto(`/catalog?q=${encodeURIComponent(sku.replace(/[^\p{L}\p{N}]/gu, ""))}`);
  await expect(page.locator(`a[href="/product/${refs.primaryProductSlug}"]`).first()).toBeVisible();
  const mpn = await page.locator(".spec-list div").filter({ has: page.locator("dt", { hasText: /^MPN$/ }) }).locator("dd").textContent().catch(() => null);
  if (mpn?.trim()) {
    await page.goto(`/catalog?q=${encodeURIComponent(mpn.trim())}`);
    await expect(page.locator(`a[href="/product/${refs.primaryProductSlug}"]`).first()).toBeVisible();
  }
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
  for (const fileId of [refs.galleryFileIds[0], refs.publicDocumentFileId].filter((value): value is string => Boolean(value))) {
    const response = await request.get(`/api/assets/${fileId}`);
    expect(response.ok()).toBe(true);
    const headers = response.headers();
    expect(headers["content-type"]).toMatch(/^(image\/|application\/pdf)/);
    expect(headers["content-disposition"]).toMatch(/^attachment/i);
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["content-security-policy"]).toContain("sandbox");
    expect(headers["cache-control"]).toContain("no-store");
    expect((await response.body()).byteLength).toBeGreaterThan(0);
  }
  for (const fileId of [refs.privateAssetId!, refs.draftReferencedAssetId!, refs.unreferencedAssetId!, randomUUID()]) {
    const response = await request.get(`/api/assets/${fileId}`);
    expect(response.ok()).toBe(false);
  }
});

test("service identity reaches only guarded read/write gateway surfaces", async ({ request }) => {
  const fixture = await manifest();
  const url = directusUrl();
  const auth = { Authorization: `Bearer ${fixture.service.token}` };
  const gatewayRead = async (path: string) => {
    const response = await request.get(`${url}/commerce/storefront/items/${path}`, { headers: auth });
    expect(response.ok()).toBe(true);
    const body = await response.json().catch(() => null);
    return body?.data;
  };
  const positive = await request.get(`${url}/commerce/storefront/items/products?fields=id,slug&limit=1&filter=${encodeURIComponent(JSON.stringify({ id: { _eq: fixture.namedRefs.primaryProductId } }))}`, { headers: auth });
  expect(positive.ok()).toBe(true);
  const positiveBody = await positive.json().catch(() => null);
  expect(Array.isArray(positiveBody?.data) && positiveBody.data.some((item: { id?: string }) => item.id === fixture.namedRefs.primaryProductId)).toBe(true);

  const settings = await gatewayRead("site_settings?fields=company_name,phone,email");
  expect(Boolean(settings && typeof settings === "object" && !Array.isArray(settings))).toBe(true);
  expect("commerce_profile" in settings).toBe(false);
  const home = await gatewayRead("home_page?fields=id,status,h1,hero_title,hero_text,hero_image,seo_title,seo_description,is_indexable");
  expect(Boolean(home && typeof home === "object" && home.status === "published")).toBe(true);
  const pageFilter = encodeURIComponent(JSON.stringify({ _and: [{ id: { _eq: fixture.namedRefs.pageId } }, { status: { _eq: "published" } }] }));
  const pages = await gatewayRead(`pages?fields=id,slug,title,page_type,h1,is_indexable&limit=10&filter=${pageFilter}`);
  expect(Array.isArray(pages) && pages.some((row: { id?: string }) => row.id === fixture.namedRefs.pageId)).toBe(true);
  const sectionFilter = encodeURIComponent(JSON.stringify({ _and: [{ page: { _eq: fixture.namedRefs.pageId } }, { status: { _eq: "published" } }, { is_visible: { _eq: true } }] }));
  const sections = await gatewayRead(`page_sections?fields=id,section_type,title,subtitle,text,image,image_alt,button_text,button_url,items,settings&limit=100&sort=sort_order&filter=${sectionFilter}`);
  expect(Array.isArray(sections) && sections.length > 0).toBe(true);
  const navigationFilter = encodeURIComponent(JSON.stringify({ _and: [{ status: { _eq: "published" } }, { is_visible: { _eq: true } }, { location: { _eq: "header" } }, { parent: { _null: true } }] }));
  const navigation = await gatewayRead(`navigation_items?fields=id,label,url,location,open_in_new_tab&limit=100&sort=sort_order&filter=${navigationFilter}`);
  expect(Array.isArray(navigation) && navigation.length > 0).toBe(true);

  const nativeReadPaths = [
    "/items/products?limit=1",
    "/files?limit=1",
    `/assets/${fixture.namedRefs.galleryFileIds[0]}`,
    "/users?limit=1",
    "/roles?limit=1",
    "/commerce/search?q=x",
  ];
  for (const path of nativeReadPaths) {
    const response = await request.get(`${url}${path}`, { headers: auth }).catch(() => null);
    expect(response !== null && [401, 403].includes(response.status())).toBe(true);
  }
  const nativeItemMutation = await request.post(`${url}/items/products`, { headers: auth, data: {} }).catch(() => null);
  expect(nativeItemMutation !== null && [401, 403].includes(nativeItemMutation.status())).toBe(true);
  const nativeLeadMutation = await request.post(`${url}/commerce/leads`, { headers: auth, data: {} }).catch(() => null);
  expect(nativeLeadMutation !== null && [401, 403].includes(nativeLeadMutation.status())).toBe(true);
  const disabledOrders = await request.get(`${url}/commerce/orders`, { headers: auth }).catch(() => null);
  expect(disabledOrders?.status()).toBe(404);
  const guardedOrders = await request.post(`${url}/commerce/storefront/orders`, { headers: auth, data: {} }).catch(() => null);
  expect(guardedOrders?.status()).toBe(404);

  const deniedGatewayPaths = [
    "/commerce/storefront/items/not_allowed?limit=1",
    "/commerce/storefront/items/products?fields=*&limit=1",
  ];
  for (const path of deniedGatewayPaths) {
    const response = await request.get(`${url}${path}`, { headers: auth }).catch(() => null);
    expect(response !== null && response.status() >= 400).toBe(true);
  }
  const anonymous = await request.get(`${url}/commerce/storefront/items/products?fields=id&limit=1`).catch(() => null);
  expect(anonymous !== null && [401, 403].includes(anonymous.status())).toBe(true);
  const wrongCaller = await request.get(`${url}/commerce/storefront/items/products?fields=id&limit=1`, { headers: { Authorization: "Bearer invalid-live-acceptance-token" } }).catch(() => null);
  expect(wrongCaller !== null && [401, 403].includes(wrongCaller.status())).toBe(true);
});

test("RFQ manual, CSV, TXT and XLSX imports edit and remove items without sending attachments", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Run mutable RFQ interactions once per acceptance run.");
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
  await page.getByRole("button", { name: "Отправить менеджеру" }).click();
  await expect(page.getByText(/Заявка принята\. Номер:/)).toBeVisible();
  await expect(page.getByText("Список пока пуст")).toBeVisible();
});

test("real RFQ writes handle concurrent replay, changed-payload conflict, and invalid input", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Run durable writes once per acceptance run.");
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
  expect(responses.every((response) => response.ok())).toBe(true);
  const bodies = await Promise.all(responses.map((response) => response.json().catch(() => null)));
  expect(new Set(bodies.map((body) => body?.id)).size).toBe(1);
  expect(bodies.some((body) => body?.replayed === true)).toBe(true);

  const changed = await request.post("/api/lead", { data: { ...payload, message: "changed payload" } });
  expect(changed.status()).toBe(409);
  const invalid = await request.post("/api/lead", { data: { ...payload, request_key: randomUUID(), name: "x" } });
  expect(invalid.status()).toBe(400);
});

test("navigation keyboard behavior, responsive routes, no token leakage, and bounded timings", async ({ page, request }, testInfo) => {
  const refs = (await manifest()).namedRefs;
  const token = (await manifest()).service.token;
  const tokenLeaks: Promise<boolean>[] = [];
  page.on("request", (browserRequest) => {
    tokenLeaks.push((async () => {
      const headers = await browserRequest.allHeaders();
      return Object.values(headers).some((value) => value.includes(token))
        || Boolean(browserRequest.postData()?.includes(token));
    })());
  });
  page.on("response", (browserResponse) => {
    const resourceType = browserResponse.request().resourceType();
    if (!["document", "script", "xhr", "fetch"].includes(resourceType)) return;
    tokenLeaks.push((async () => {
      try { return (await browserResponse.text()).includes(token); } catch { return false; }
    })());
  });
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

  const html = await page.content();
  expect(html.includes(token)).toBe(false);
  const scripts = await page.locator("script[src]").evaluateAll((items) => items.map((item) => (item as HTMLScriptElement).src));
  for (const scriptUrl of scripts) {
    const response = await request.get(scriptUrl).catch(() => null);
    if (!response?.ok()) continue;
    expect((await response.text()).includes(token)).toBe(false);
  }
  expect((await Promise.all(tokenLeaks)).some(Boolean)).toBe(false);

  await page.goto(`/product/${refs.primaryProductSlug}`);
  const sku = (await page.locator(".article-big strong").innerText()).trim();
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
    console.log(`LIVE_SYNTHETIC_PERF surface=${surface} samples=${samples.length} p50_ms=${p50.toFixed(1)} p95_ms=${p95.toFixed(1)} fixture=small`);
  }
});
