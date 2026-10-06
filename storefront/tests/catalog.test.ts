import { describe, expect, it } from "vitest";
import { brands, getProducts } from "../lib/catalog";
import { mockProducts } from "../lib/mock";

const normalize = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9А-ЯЁ]+/g, "");

describe("mock catalog contract", () => {
  it("keeps product slugs unique", () => {
    const slugs = mockProducts.map((product) => product.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps brand + normalized SKU identities unique", () => {
    const identities = mockProducts.map((product) => `${product.brand.toLowerCase()}:${normalize(product.sku)}`);
    expect(new Set(identities).size).toBe(identities.length);
  });

  it("has at least one mock product for every advertised brand route", async () => {
    for (const brand of brands) {
      const result = await getProducts({ brand: brand.slug, limit: 24 });
      expect(result.total, brand.slug).toBeGreaterThan(0);
      expect(result.items.every((item) => item.brand === brand.name), brand.slug).toBe(true);
    }
  });

  it("search ignores common article punctuation", async () => {
    const johnDeere = await getProducts({ q: "RE-568158", limit: 20 });
    expect(johnDeere.items.some((item) => item.sku === "RE568158")).toBe(true);

    const jcb = await getProducts({ q: "320-04542", limit: 20 });
    expect(jcb.items.some((item) => item.sku === "320/04542")).toBe(true);
  });

  it("returns an empty result instead of unrelated products", async () => {
    const result = await getProducts({ q: "ZZZ-NOT-A-REAL-SKU-999", limit: 20 });
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });

  it("paginates deterministically in mock mode", async () => {
    const first = await getProducts({ page: 1, limit: 3 });
    const second = await getProducts({ page: 2, limit: 3 });
    expect(first.items).toHaveLength(3);
    expect(second.items).toHaveLength(3);
    expect(first.items.map((item) => item.id)).not.toEqual(second.items.map((item) => item.id));
    expect(first.total).toBe(second.total);
  });
});
