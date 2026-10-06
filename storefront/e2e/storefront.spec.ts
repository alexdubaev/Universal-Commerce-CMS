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

test("home, catalog and every brand route render", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Движение вашего бизнеса");
  await expect(page.locator(".site-header")).toBeVisible();

  await page.goto("/catalog");
  await expect(page.getByRole("heading", { name: "Каталог запчастей" })).toBeVisible();

  for (const [slug, name] of brands) {
    const response = await page.goto(`/brand/${slug}`);
    expect(response?.ok(), slug).toBe(true);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  }
});

test("article search normalizes punctuation and reaches a product", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("search");
  await search.getByRole("textbox").fill("RE-568158");
  await search.getByRole("button", { name: "Найти" }).click();

  await expect(page).toHaveURL(/\/catalog\?q=RE-568158/);
  const card = page.locator(".product-card").filter({ hasText: "RE568158" });
  await expect(card).toBeVisible();
  await card.getByRole("link", { name: "Фильтр масляный" }).click();
  await expect(page).toHaveURL(/\/product\/jd-re568158/);
  await expect(page.getByText("RE568158", { exact: true }).first()).toBeVisible();
});

test("request flow survives add, quantity edit and mock submission", async ({ page }) => {
  await page.goto("/product/jd-re568158");
  await page.getByRole("button", { name: "Добавить в заявку" }).click();
  await expect(page.getByRole("button", { name: /Добавлено/ })).toBeVisible();

  await page.goto("/request");
  const line = page.locator(".request-line").filter({ hasText: "RE568158" });
  await expect(line).toBeVisible();
  await line.locator(".qty button").last().click();
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

test("mobile menu works and key routes never overflow horizontally", async ({ page }, testInfo) => {
  if (testInfo.project.name === "mobile-chromium") {
    await page.goto("/");
    await page.getByRole("button", { name: "Открыть меню" }).click();
    await expect(page.getByRole("navigation", { name: "Основная навигация" })).toBeVisible();
    await page.getByRole("navigation", { name: "Основная навигация" }).getByRole("link", { name: "Каталог" }).click();
    await expect(page).toHaveURL(/\/catalog/);
  }

  for (const route of ["/", "/catalog", "/brand/caterpillar", "/product/jd-re568158", "/request", "/delivery", "/payment", "/about", "/contacts"]) {
    await page.goto(route);
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(dimensions.scrollWidth, route).toBeLessThanOrEqual(dimensions.innerWidth + 1);
  }
});
