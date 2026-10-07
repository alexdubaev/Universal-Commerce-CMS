import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  directusFetch: vi.fn(),
}));

vi.mock("../lib/directus", () => ({
  allowMockFallback: () => false,
  isMockMode: () => false,
  directusFetch: mocks.directusFetch,
}));

import { getBrands, getProducts } from "../lib/catalog";

describe("live multibrand catalog adapter", () => {
  beforeEach(() => {
    mocks.directusFetch.mockReset();
  });

  it("discovers future brands from published Directus products", async () => {
    mocks.directusFetch.mockResolvedValueOnce({
      data: [
        { brand: "Caterpillar", count: "12" },
        { brand: "LiuGong", count: "7" },
      ],
    });

    const brands = await getBrands();

    expect(brands).toEqual(expect.arrayContaining([
      expect.objectContaining({ slug: "caterpillar", name: "Caterpillar" }),
      expect.objectContaining({ slug: "liugong", name: "LiuGong" }),
    ]));
  });

  it("resolves a dynamic brand slug back to its exact Directus brand label for filtering", async () => {
    mocks.directusFetch
      .mockResolvedValueOnce({
        data: [{ brand: "LiuGong", count: "7" }],
      })
      .mockResolvedValueOnce({
        data: [{
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          slug: "liugong-sp105334",
          title: "Деталь",
          sku: "SP105334",
          brand: "LiuGong",
          price_status: "on_request",
          availability_status: "on_request",
          currency: "RUB",
        }],
        meta: { filter_count: 1 },
      });

    const result = await getProducts({ brand: "liugong", limit: 12, sort: "title" });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].brand).toBe("LiuGong");

    const productRequest = String(mocks.directusFetch.mock.calls[1][0]);
    const url = new URL(productRequest, "https://store.test");
    const filter = JSON.parse(url.searchParams.get("filter") || "{}");
    expect(JSON.stringify(filter)).toContain('"brand":{"_eq":"LiuGong"}');
  });
});
