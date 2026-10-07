import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  directusFetch: vi.fn(),
  mockMode: false,
}));

vi.mock("../lib/directus", () => ({
  allowMockFallback: () => false,
  isMockMode: () => mocks.mockMode,
  directusFetch: mocks.directusFetch,
}));

import { getProductDetail, getProducts, getProductsForSitemap, getSitemapProductCount } from "../lib/catalog";

const schemaBlueprintSource = readFileSync(new URL("../../directus/schema/blueprint.mjs", import.meta.url), "utf8");

function assertValidProductFieldQuery(request: string) {
  const url = new URL(request, "https://store.test");
  const requested = (url.searchParams.get("fields") ?? "").split(",");
  const invalid = requested.filter((field) =>
    field === "date_updated" && !schemaBlueprintSource.includes(`field("${field}"`),
  );
  if (invalid.length) throw new Error(`Unknown Directus products field: ${invalid.join(",")}`);
  return url;
}

function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "product-1",
    slug: "part-one",
    title: "Part One",
    sku: "SKU-1",
    brand: "Caterpillar",
    updated_at: "2026-10-05T12:00:00.000Z",
    ...overrides,
  };
}

describe("live product timestamp adapter", () => {
  beforeEach(() => {
    mocks.mockMode = false;
    mocks.directusFetch.mockReset();
    expect(schemaBlueprintSource).toContain('field("updated_at", "timestamp"');
    expect(schemaBlueprintSource).not.toContain('field("date_updated"');
    mocks.directusFetch.mockImplementation(async (request: string) => {
      if (!request.startsWith("/items/products?")) return { data: [] };
      const url = assertValidProductFieldQuery(request);
      if (url.searchParams.get("fields") === "id") {
        const hasImage = (url.searchParams.get("filter") ?? "").includes('"_nnull"');
        return { data: [], meta: { filter_count: hasImage ? 0 : 1 } };
      }
      if (url.searchParams.get("fields") === "slug,updated_at,is_indexable") {
        return { data: [{ slug: "part-one", updated_at: "2026-10-05T12:00:00.000Z" }] };
      }
      return { data: [productRow()], meta: { filter_count: 1 } };
    });
  });

  it("requests the blueprint timestamp and maps it to the stable list and detail property", async () => {
    const list = await getProducts();
    expect(list.items[0].date_updated).toBe("2026-10-05T12:00:00.000Z");
    const listRequest = mocks.directusFetch.mock.calls.find(([request]) =>
      new URL(String(request), "https://store.test").searchParams.get("fields")?.includes("updated_at"));
    const listUrl = assertValidProductFieldQuery(String(listRequest?.[0]));
    expect(listUrl.searchParams.get("fields")).toContain("updated_at");
    expect(listUrl.searchParams.get("fields")).not.toContain("date_updated");

    const detail = await getProductDetail("part-one");
    expect(detail?.date_updated).toBe("2026-10-05T12:00:00.000Z");
    expect(detail?.is_indexable).toBe(true);
    const detailUrl = assertValidProductFieldQuery(String(mocks.directusFetch.mock.calls[3][0]));
    expect(detailUrl.searchParams.get("fields")).toContain("updated_at");
  });

  it("maps updated_at in sitemap results and preserves absent or null timestamps as null", async () => {
    mocks.directusFetch.mockImplementation(async (request: string) => {
      if (!request.startsWith("/items/products?")) return { data: [] };
      const url = assertValidProductFieldQuery(request);
      if (url.searchParams.get("fields") === "id") {
        const hasImage = (url.searchParams.get("filter") ?? "").includes('"_nnull"');
        return { data: [], meta: { filter_count: hasImage ? 0 : 2 } };
      }
      if (url.searchParams.get("fields") === "slug,updated_at,is_indexable") {
        return { data: [
          { slug: "dated", updated_at: "2026-10-05T12:00:00.000Z" },
          { slug: "null-date", updated_at: null },
          { slug: "missing-date" },
        ] };
      }
      return { data: [productRow({ updated_at: null }), productRow({ updated_at: undefined })] };
    });

    const products = await getProducts();
    expect(products.items.map((item) => item.date_updated)).toEqual([null, null]);

    const sitemap = await getProductsForSitemap(0, 10);
    expect(sitemap).toEqual([
      { slug: "dated", date_updated: "2026-10-05T12:00:00.000Z" },
      { slug: "null-date", date_updated: null },
      { slug: "missing-date", date_updated: null },
    ]);
    const sitemapUrl = assertValidProductFieldQuery(String(mocks.directusFetch.mock.calls[3][0]));
    expect(sitemapUrl.searchParams.get("fields")).toBe("slug,updated_at,is_indexable");
    expect(JSON.parse(sitemapUrl.searchParams.get("filter") ?? "{}")).toEqual({
      _and: [
        { status: { _eq: "published" } },
        { _or: [{ is_indexable: { _eq: true } }, { is_indexable: { _null: true } }] },
      ],
    });
  });

  it("uses the same published and indexable filter for sitemap count and chunks", async () => {
    mocks.directusFetch.mockImplementation(async (request: string) => {
      const url = assertValidProductFieldQuery(request);
      return url.searchParams.has("meta")
        ? { data: [], meta: { filter_count: 2 } }
        : { data: [{ slug: "indexable" }, { slug: "legacy-null" }] };
    });

    expect(await getSitemapProductCount()).toBe(2);
    await getProductsForSitemap(0, 1000);
    const countFilter = JSON.parse(new URL(String(mocks.directusFetch.mock.calls[0][0]), "https://store.test").searchParams.get("filter") ?? "{}");
    const chunkUrl = assertValidProductFieldQuery(String(mocks.directusFetch.mock.calls[1][0]));
    expect(JSON.parse(chunkUrl.searchParams.get("filter") ?? "{}")).toEqual(countFilter);
  });

  it("maps false indexability for product metadata", async () => {
    mocks.directusFetch.mockImplementation(async () => ({ data: [productRow({ is_indexable: false })] }));
    const detail = await getProductDetail("part-one");
    expect(detail?.is_indexable).toBe(false);
  });

  it("keeps mock sitemap counts and chunks aligned when a product is noindex", async () => {
    const products = await import("../lib/mock");
    const target = products.mockProducts[0];
    const original = target.is_indexable;
    try {
      target.is_indexable = false;
      mocks.mockMode = true;
      expect(await getSitemapProductCount()).toBe(products.mockProducts.length - 1);
      const firstChunk = await getProductsForSitemap(0, 1);
      expect(firstChunk).toHaveLength(1);
      expect(firstChunk[0].slug).toBe(products.mockProducts[1].slug);
    } finally {
      target.is_indexable = original;
    }
  });
});
