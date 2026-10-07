import { expect, test } from "@playwright/test";

const brands = [
  ["caterpillar", "Caterpillar"],
  ["komatsu", "Komatsu"],
  ["volvo", "Volvo"],
  ["hitachi", "Hitachi"],
  ["jcb", "JCB"],
  ["doosan", "Doosan"],
  ["john-deere", "John Deere"],
  ["cnh", "CNH"],
  ["claas", "CLAAS"],
  ["perkins", "Perkins"],
  ["sany", "SANY"],
] as const;

test("home, catalog, categories and every brand route render", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Движение вашего бизнеса");
  await expect(page.locator(".site-header")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Категории запчастей" })).toBeVisible();

  await page.goto("/catalog");
  await expect(page.getByRole("heading", { name: "Каталог запчастей" })).toBeVisible();

  const categoryResponse = await page.goto("/category/filters");
  expect(categoryResponse?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1, name: "Фильтры" })).toBeVisible();

  for (const [slug, name] of brands) {
    const response = await page.goto(`/brand/${slug}`);
    expect(response?.ok(), slug).toBe(true);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  }
});

test("article search shows suggestions, normalizes punctuation and reaches a product", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("search");
  await search.getByRole("textbox").fill("RE-56");
  await expect(page.locator(".suggestion-item").first()).toBeVisible();

  await search.getByRole("textbox").fill("RE-568158");
  await search.getByRole("button", { name: "Найти" }).click();

  await expect(page).toHaveURL(/\/catalog\?q=RE-568158/);
  const card = page.locator(".product-card").filter({ hasText: "RE568158" });
  await expect(card).toBeVisible();
  await card.getByRole("link", { name: "Фильтр масляный" }).click();
  await expect(page).toHaveURL(/\/product\/jd-re568158/);
  await expect(page.getByText("RE568158", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("RE-568158", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Аналоги и совместимые позиции" })).toBeVisible();
});

test("catalog facets and price sort affect results", async ({ page }) => {
  await page.goto("/catalog?category=filters&availability=in_stock&partType=original&sort=price_asc");
  const cards = page.locator(".product-card");
  await expect(cards.first()).toContainText("RE568158");
  await expect(cards.first()).toContainText("3");
  const count = await cards.count();
  expect(count).toBeGreaterThan(1);
  for (let index = 0; index < count; index++) {
    await expect(cards.nth(index)).toContainText("В наличии");
  }
});

test("bulk manual import updates the same RFQ list immediately", async ({ page }) => {
  await page.goto("/request");
  await page.getByLabel("Артикулы").fill("RE568158 2\n1R-1808 4");
  await page.getByRole("button", { name: "Добавить список" }).click();
  await expect(page.getByText(/Список: добавлено 2/)).toBeVisible();
  await expect(page.locator(".request-line").filter({ hasText: "RE568158" })).toContainText("2");
  await expect(page.locator(".request-line").filter({ hasText: "1R-1808" })).toContainText("4");
});

test("file import preserves CSV quantities and rejects oversized files", async ({ page }) => {
  await page.goto("/request");
  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toBeEnabled();
  await fileInput.setInputFiles({
    name: "parts.csv", mimeType: "text/csv",
    buffer: Buffer.from("Артикул;Количество\nRE568158;2\n1R-1808;4", "utf8"),
  });
  await expect(page.getByText(/CSV\/TXT: добавлено 2, всего 2/)).toBeVisible();
  await expect(page.locator(".request-line").filter({ hasText: "RE568158" }).locator(".qty b")).toHaveText("2");
  await expect(page.locator(".request-line").filter({ hasText: "1R-1808" }).locator(".qty b")).toHaveText("4");
  await expect(page.locator(".request-link b")).toHaveText("6");
  await fileInput.setInputFiles({
    name: "oversized.txt", mimeType: "text/plain", buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(page.getByText("Файл слишком большой. Для интерфейсной загрузки используйте файл до 5 МБ.")).toBeVisible();
  await expect(page.locator(".request-line")).toHaveCount(2);
});

test("bulk import warns when unique rows exceed the request limit", async ({ page }) => {
  await page.goto("/request");
  await page.getByLabel("Артикулы").fill(Array.from({ length: 101 }, (_, index) => `PART${index} 1`).join("\n"));
  await page.getByRole("button", { name: "Добавить список" }).click();
  await expect(page.locator(".request-line")).toHaveCount(100);
  await expect(page.locator(".import-message")).toContainText("Достигнут лимит 100 позиций.");
});

test("RFQ acknowledgement preserves additions and quantity increments while sending", async ({ page }) => {
  await page.goto("/request");
  await page.getByLabel("Артикулы").fill("PARTA 2");
  await page.getByRole("button", { name: "Добавить список" }).click();
  await page.getByLabel("Контактное лицо").fill("Иван");
  await page.getByLabel("Телефон").fill("+79990000000");
  let release!: () => void;
  const acknowledged = new Promise<void>((resolve) => { release = resolve; });
  let submitted: { request_items: unknown[] } | undefined;
  await page.route("**/api/lead", async (route) => {
    submitted = route.request().postDataJSON();
    await acknowledged;
    await route.fulfill({ json: { id: "snapshot-acknowledged" } });
  });
  await page.getByRole("button", { name: "Отправить менеджеру" }).click();
  await expect.poll(() => submitted?.request_items).toEqual([{ article: "PARTA", quantity: 2 }]);
  // Simulate another tab adding B and incrementing A during the pending request.
  await page.evaluate(() => {
    const items = JSON.parse(localStorage.getItem("smtechno-request") ?? "[]");
    items[0].quantity += 3;
    items.push({ article: "PARTB", title: "Новая деталь", brand: "Не указан", quantity: 4 });
    localStorage.setItem("smtechno-request", JSON.stringify(items));
    window.dispatchEvent(new StorageEvent("storage", { key: "smtechno-request" }));
  });
  await expect(page.locator(".request-line")).toHaveCount(2);
  release();
  await expect(page.getByText("Заявка принята. Номер: snapshot-acknowledged")).toBeVisible();
  await expect(page.locator(".request-line")).toHaveCount(2);
  await expect(page.locator(".request-line").filter({ hasText: "PARTA" }).locator(".qty b")).toHaveText("3");
  await expect(page.locator(".request-line").filter({ hasText: "PARTB" }).locator(".qty b")).toHaveText("4");
  await expect(page.locator(".request-link b")).toHaveText("7");
});

test("request flow survives add, quantity edit and mock submission", async ({ page }) => {
  await page.goto("/product/jd-re568158");
  await page.getByRole("button", { name: "Добавить в заявку" }).click();
  await expect(page.getByRole("button", { name: /Добавлено/ })).toBeVisible();

  await page.goto("/request");
  const line = page.locator(".request-line").filter({ hasText: "RE568158" });
  await expect(line).toBeVisible();
  await line.getByRole("button", { name: /Увеличить количество/ }).click();
  await expect(line.locator(".qty b")).toHaveText("2");

  await page.getByLabel("Компания").fill("ООО Тест");
  await page.getByLabel("Контактное лицо").fill("Иван");
  await page.getByLabel("Телефон").fill("+79990000000");
  await page.getByLabel("Email").fill("test@example.com");
  await page.getByLabel("Комментарий").fill("E2E acceptance");
  await page.getByRole("button", { name: "Отправить менеджеру" }).click();

  await expect(page.getByText(/Заявка принята\. Номер:/)).toBeVisible();
  await expect(page.getByText("Список пока пуст")).toBeVisible();
});

test("RFQ retries keep their key and preserve the list until successful submission", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("smtechno-request", JSON.stringify([
    { article: "RE568158", title: "Фильтр", brand: "John Deere", quantity: 3 },
  ])));
  const payloads: Array<{ request_key: string; request_items: unknown[]; message: string }> = [];
  await page.route("**/api/lead", async (route) => {
    payloads.push(route.request().postDataJSON());
    await route.fulfill({
      status: payloads.length >= 4 ? 200 : 503,
      json: payloads.length >= 4 ? { id: "accepted-rfq" } : { error: "Временная ошибка" },
    });
  });
  await page.goto("/request");
  await expect(page.locator(".request-line")).toHaveCount(1);
  await expect(page.locator(".request-link b")).toHaveText("3");
  await page.getByLabel("Контактное лицо").fill("Иван");
  await page.getByLabel("Телефон").fill("+79990000000");
  const submit = page.getByRole("button", { name: "Отправить менеджеру" });
  for (let attempt = 0; attempt < 2; attempt++) {
    await submit.click();
    await expect(page.locator(".lead-form").getByRole("alert")).toHaveText("Временная ошибка");
    await expect.poll(() => payloads.length).toBe(attempt + 1);
    await expect(page.locator(".request-line")).toHaveCount(1);
  }
  expect(payloads[1].request_key).toBe(payloads[0].request_key);
  expect(Object.keys(payloads[0])).toEqual([
    "request_key", "name", "phone", "email", "company", "message", "request_items", "page_url",
  ]);
  expect(payloads[0].request_items).toEqual([{ article: "RE568158", quantity: 3 }]);
  await page.getByLabel("Комментарий").fill("Изменённый запрос");
  await submit.click();
  await expect.poll(() => payloads.length).toBe(3);
  await expect(page.locator(".lead-form").getByRole("alert")).toHaveText("Временная ошибка");
  expect(payloads[2].request_key).not.toBe(payloads[1].request_key);
  await submit.click();
  await expect(page.getByText("Заявка принята. Номер: accepted-rfq")).toBeVisible();
  expect(payloads[3].request_key).toBe(payloads[2].request_key);
  await expect(page.locator(".request-line")).toHaveCount(0);
  await expect(page.locator(".request-link b")).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("smtechno-request") ?? "null"))).toEqual([]);
  await page.getByLabel("Артикулы").fill("RE568158 3");
  await page.getByRole("button", { name: "Добавить список" }).click();
  await page.getByLabel("Контактное лицо").fill("Иван");
  await page.getByLabel("Телефон").fill("+79990000000");
  await page.getByLabel("Комментарий").fill("Изменённый запрос");
  await submit.click();
  await expect.poll(() => payloads.length).toBe(5);
  expect(payloads[4].request_key).not.toBe(payloads[3].request_key);
  expect({ ...payloads[4], request_key: undefined }).toEqual({ ...payloads[3], request_key: undefined });
  await expect(page.locator(".request-line")).toHaveCount(0);
});

test("quick lead retries preserve the key and leave saved RFQ items intact", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("smtechno-request", JSON.stringify([
    { article: "RE568158", title: "Фильтр", brand: "John Deere", quantity: 2 },
  ])));
  const payloads: Array<{ request_key: string; request_items: unknown[] }> = [];
  await page.route("**/api/lead", async (route) => {
    payloads.push(route.request().postDataJSON());
    await route.fulfill({
      status: payloads.length === 1 ? 503 : 200,
      json: payloads.length === 1 ? { error: "Временная ошибка" } : { id: "accepted-contact" },
    });
  });
  await page.goto("/contacts");
  await page.getByLabel("Контактное лицо").fill("Иван");
  await page.getByLabel("Телефон").fill("+79990000000");
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(page.locator(".lead-form").getByRole("alert")).toHaveText("Временная ошибка");
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(page.getByText("Заявка принята: accepted-contact")).toBeVisible();
  expect(payloads[1].request_key).toBe(payloads[0].request_key);
  expect(Object.keys(payloads[0])).toEqual([
    "request_key", "company", "name", "phone", "email", "message", "request_items", "page_url",
  ]);
  expect(payloads[1].request_items).toEqual([]);
  await expect(page.getByLabel("Контактное лицо")).toHaveValue("");
  await expect(page.locator(".request-link b")).toHaveText("2");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("smtechno-request") ?? "[]").length)).toBe(1);
});

test("RFQ list and header count respond to storage updates and removal", async ({ page }) => {
  await page.goto("/request");
  await page.evaluate(() => {
    localStorage.setItem("smtechno-request", JSON.stringify([
      { article: "RE568158", title: "Фильтр", brand: "John Deere", quantity: 2 },
    ]));
    window.dispatchEvent(new StorageEvent("storage", { key: "smtechno-request" }));
  });
  const line = page.locator(".request-line");
  await expect(line).toHaveCount(1);
  await expect(page.locator(".request-link b")).toHaveText("2");
  await line.getByRole("button", { name: /Уменьшить количество/ }).click();
  await line.getByRole("button", { name: /Уменьшить количество/ }).click();
  await expect(line.locator(".qty b")).toHaveText("1");
  await expect(page.locator(".request-link b")).toHaveText("1");
  await line.getByRole("button", { name: /Удалить/ }).click();
  await expect(line).toHaveCount(0);
  await expect(page.locator(".request-link b")).toHaveCount(0);
});

test("search preserves trimmed queries and bounded recent history", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("smtechno-search-history")) {
      localStorage.setItem("smtechno-search-history", JSON.stringify([
        "re-568158", "Old", "Third", "Fourth", "Fifth", "Sixth",
      ]));
    }
  });
  await page.goto("/");
  const search = page.getByRole("search");
  await search.getByRole("textbox").fill("  RE-568158  ");
  await search.getByRole("button", { name: "Найти" }).click();
  await expect(page).toHaveURL(/\/catalog\?q=RE-568158$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("smtechno-search-history") ?? "[]")))
    .toEqual(["RE-568158", "Old", "Third", "Fourth", "Fifth", "Sixth"]);
  await page.getByRole("search").getByRole("textbox").fill("");
  await expect(page.locator(".history-item")).toHaveCount(6);
  await page.getByRole("button", { name: /Old/, exact: false }).click();
  await expect(page).toHaveURL(/\/catalog\?q=Old$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("smtechno-search-history") ?? "[]")[0])).toBe("Old");
});

test("search debounces changes and limits visible suggestions to six", async ({ page }) => {
  const queries: string[] = [];
  await page.route("**/api/search?*", async (route) => {
    queries.push(new URL(route.request().url()).searchParams.get("q") ?? "");
    await route.fulfill({ json: { data: Array.from({ length: 8 }, (_, index) => ({
      id: String(index), slug: `suggestion-${index}`, sku: `RE56-${index}`,
      title: `Деталь ${index}`, brand: "John Deere",
    })) } });
  });
  await page.goto("/");
  const input = page.getByRole("search").getByRole("textbox");
  await expect(input).toBeEnabled();
  await page.clock.install({ time: new Date("2026-10-07T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-07T12:00:01Z"));
  await input.fill("R");
  await page.clock.runFor(500);
  expect(queries).toEqual([]);
  await input.fill("RE");
  await page.clock.runFor(179);
  expect(queries).toEqual([]);
  await input.fill("RE56");
  await page.clock.runFor(179);
  expect(queries).toEqual([]);
  await page.clock.runFor(1);
  await expect.poll(() => queries).toEqual(["RE56"]);
  await expect(page.locator(".suggestion-item")).toHaveCount(6);
  await input.fill("");
  await expect(page.locator(".suggestion-item")).toHaveCount(0);
});

test("lead API is stable under concurrent retries with one request key in mock mode", async ({ request }) => {
  const requestKey = "11111111-1111-4111-8111-111111111111";
  const payload = {
    request_key: requestKey,
    company: "ООО Race",
    name: "Race Test",
    phone: "+79990000000",
    email: "race@example.com",
    message: "same payload",
    request_items: [{ article: "RE568158", quantity: 1 }],
    page_url: "http://127.0.0.1:3000/request",
  };

  const responses = await Promise.all(
    Array.from({ length: 12 }, () => request.post("/api/lead", { data: payload })),
  );
  expect(responses.every((response) => response.ok())).toBe(true);
  const bodies = await Promise.all(responses.map((response) => response.json()));
  expect(new Set(bodies.map((body) => body.id)).size).toBe(1);
});

test("robots and chunked sitemap expose catalog URLs", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain("/sitemap.xml");

  const index = await request.get("/sitemap.xml");
  expect(index.ok()).toBe(true);
  expect(await index.text()).toContain("/sitemaps/products-0.xml");

  const products = await request.get("/sitemaps/products-0.xml");
  expect(products.ok()).toBe(true);
  expect(await products.text()).toContain("/product/jd-re568158");

  const statics = await request.get("/sitemaps/static.xml");
  expect(statics.ok()).toBe(true);
  const staticXml = await statics.text();
  expect(staticXml).toContain("/brand/caterpillar");
  expect(staticXml).toContain("/category/filters");
});


test("API guard rails reject invalid public requests and keep order retries stable", async ({ request }) => {
  const longSearch = await request.get(`/api/search?q=${"X".repeat(80)}`);
  expect(longSearch.status()).toBe(400);

  const tooManyItems = await request.post("/api/lead", {
    data: {
      request_key: "33333333-3333-4333-8333-333333333333",
      name: "Limit Test",
      phone: "+79990000000",
      page_url: "http://127.0.0.1:3000/request",
      request_items: Array.from({ length: 101 }, (_, index) => ({ article: `P-${index}`, quantity: 1 })),
    },
  });
  expect(tooManyItems.status()).toBe(400);

  const asset = await request.get("/api/assets/not-a-uuid");
  expect(asset.status()).toBe(404);

  const requestKey = "44444444-4444-4444-8444-444444444444";
  const orderBody = {
    request_key: requestKey,
    order: {
      customer_name: "Order Test",
      phone: "+79990000000",
      page_url: "http://127.0.0.1:3000/catalog",
      currency: "RUB",
    },
    items: [{
      product: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      quantity: 1,
      unit_price: 100,
    }],
  };
  const [first, second] = await Promise.all([
    request.post("/api/order", { data: orderBody }),
    request.post("/api/order", { data: orderBody }),
  ]);
  expect(first.ok()).toBe(true);
  expect(second.ok()).toBe(true);
  expect((await first.json()).id).toBe((await second.json()).id);
});


test("keyboard skip link reaches the main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("mobile menu works and key routes never overflow horizontally", async ({ page }, testInfo) => {
  if (testInfo.project.name.startsWith("mobile-")) {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Открыть меню" });
    await toggle.click();
    await expect(page.getByRole("navigation", { name: "Основная навигация" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("navigation", { name: "Основная навигация" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Открыть меню" })).toBeFocused();
    await page.getByRole("button", { name: "Открыть меню" }).click();
    await page.getByRole("navigation", { name: "Основная навигация" }).getByRole("link", { name: "Каталог" }).click();
    await expect(page).toHaveURL(/\/catalog/);
  }

  for (const route of ["/", "/catalog", "/category/filters", "/brand/caterpillar", "/product/jd-re568158", "/request", "/delivery", "/payment", "/about", "/contacts"]) {
    await page.goto(route);
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(dimensions.scrollWidth, route).toBeLessThanOrEqual(dimensions.innerWidth + 1);
  }
});
