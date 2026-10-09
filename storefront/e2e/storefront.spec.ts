import { expect, test } from "@playwright/test";

test("search to product to request submission", async ({ page }) => {
  await page.route("**/api/lead", route => route.fulfill({ json: { id: "accepted-critical-journey" } }));
  await page.goto("/");
  const search = page.getByRole("search");
  await search.getByRole("textbox").fill("RE-568158");
  await search.getByRole("button", { name: "Найти" }).click();
  await page.locator(".product-card").filter({ hasText: "RE568158" })
    .getByRole("link", { name: "Фильтр масляный" }).first().click();
  await page.locator(".product-info").getByRole("button", { name: "Добавить в заявку", exact: true }).click();
  await page.goto("/request");
  const line = page.locator(".request-line").filter({ hasText: "RE568158" });
  await line.getByRole("button", { name: /Увеличить количество/ }).click();
  await expect(line.locator(".qty b")).toHaveText("2");
  await page.getByLabel("Контактное лицо").fill("Иван");
  await page.getByLabel("Телефон").fill("+79990000000");
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page.getByText(/Заявка принята\. Номер:/)).toBeVisible();
  await expect(page.getByText("Список пока пуст")).toBeVisible();
});

test("retry preserves its key and acknowledges only submitted quantities", async ({ page }) => {
  const payloads: Array<{ request_key: string; request_items: unknown[] }> = [];
  await page.route("**/api/lead", async route => {
    payloads.push(route.request().postDataJSON());
    if (payloads.length === 2) {
      // Another tab adds quantity while this submitted snapshot awaits acknowledgement.
      await page.evaluate(() => {
        const items = JSON.parse(localStorage.getItem("smtechno-request") ?? "[]");
        items[0].quantity = 5;
        localStorage.setItem("smtechno-request", JSON.stringify(items));
        window.dispatchEvent(new StorageEvent("storage", { key: "smtechno-request" }));
      });
    }
    await route.fulfill(payloads.length === 1
      ? { status: 503, json: { error: "Временная ошибка" } }
      : { json: { id: "accepted-retry" } });
  });
  await page.goto("/request");
  await page.getByText("Добавить позиции списком или из файла").click();
  await page.getByLabel("Артикул и количество, по одной позиции в строке").fill("RE568158 3");
  await page.getByRole("button", { name: "Добавить список" }).click();
  await page.getByLabel("Контактное лицо").fill("Иван");
  await page.getByLabel("Телефон").fill("+79990000000");
  const submit = page.getByRole("button", { name: "Отправить заявку" });
  await submit.click();
  await expect(page.locator(".lead-form").getByRole("alert")).toHaveText("Временная ошибка");
  await expect(page.locator(".request-line .qty b")).toHaveText("3");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("smtechno-request") ?? "[]")))
    .toEqual([expect.objectContaining({ article: "RE568158", quantity: 3 })]);
  await submit.click();
  await expect(page.getByText("Заявка принята. Номер: accepted-retry")).toBeVisible();
  expect(payloads[1].request_key).toBe(payloads[0].request_key);
  expect(payloads[1].request_items).toEqual(payloads[0].request_items);
  await expect(page.locator(".request-line .qty b")).toHaveText("2");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("smtechno-request") ?? "[]")))
    .toEqual([expect.objectContaining({ article: "RE568158", quantity: 2 })]);
});
