import { describe, expect, it } from "vitest";
import { brands, getCategories, getProductDetail, getProducts } from "../lib/catalog";
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

  it("applies category, availability, type and price sorting together", async () => {
    const result = await getProducts({
      category: "filters",
      availability: "in_stock",
      partType: "original",
      sort: "price_asc",
      limit: 24,
    });
    expect(result.items.length).toBeGreaterThan(1);
    expect(result.items.every((item) =>
      item.category?.slug === "filters"
      && item.availability_status === "in_stock"
      && item.part_type === "original"
    )).toBe(true);
    const prices = result.items.map((item) => item.price ?? Number.POSITIVE_INFINITY);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("exposes unique indexable category routes", async () => {
    const categories = await getCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(new Set(categories.map((category) => category.slug)).size).toBe(categories.length);
    expect(categories.every((category) => category.is_indexable !== false)).toBe(true);
  });

  it("product detail exposes codes and compatible relations without cloning the current product", async () => {
    const detail = await getProductDetail("jd-re568158");
    expect(detail).not.toBeNull();
    expect(detail?.codes.some((code) => code.code === "RE-568158")).toBe(true);
    expect(detail?.relations.every((relation) => relation.product.id !== detail.id)).toBe(true);
  });
});
