import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ directusFetch: vi.fn() }));

vi.mock("../lib/directus", () => ({
  allowMockFallback: () => false,
  isMockMode: () => false,
  directusFetch: mocks.directusFetch,
}));

import { getBrands, getProducts } from "../lib/catalog";

describe("known brand metadata", () => {
  beforeEach(() => mocks.directusFetch.mockReset());

  it("preserves the stored brand label in metadata and exact catalog filters", async () => {
    mocks.directusFetch
      .mockResolvedValueOnce({ data: [{ brand: "caterpillar" }] })
      .mockResolvedValueOnce({ data: [{ brand: "caterpillar" }] })
      .mockResolvedValueOnce({ data: [], meta: { filter_count: 0 } })
      .mockResolvedValueOnce({ data: [], meta: { filter_count: 0 } });

    const brands = await getBrands();
    expect(brands.find((brand) => brand.slug === "caterpillar")?.name).toBe("caterpillar");

    await getProducts({ brand: "caterpillar" });
    const productRequest = String(mocks.directusFetch.mock.calls[2][0]);
    const params = new URL(productRequest, "https://store.test").searchParams;
    expect(JSON.parse(params.get("filter") ?? "{}")).toMatchObject({
      _and: expect.arrayContaining([{ brand: { _eq: "caterpillar" } }]),
    });
  });
});
