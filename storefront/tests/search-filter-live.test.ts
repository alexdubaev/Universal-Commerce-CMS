import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  directusFetch: vi.fn(),
}));

vi.mock("../lib/directus", () => ({
  allowMockFallback: () => false,
  isMockMode: () => false,
  directusFetch: mocks.directusFetch,
}));

import { getProducts } from "../lib/catalog";

function product(id: number) {
  return {
    id: `id-${id}`,
    slug: `part-${id}`,
    title: `Part ${id}`,
    sku: `SKU${id}`,
    brand: "Caterpillar",
    price_status: "on_request",
    availability_status: "in_stock",
    currency: "RUB",
  };
}

describe("live search with catalog filters", () => {
  beforeEach(() => {
    mocks.directusFetch.mockReset();
  });

  it("filters and paginates across the whole bounded search candidate set", async () => {
    const firstIds = Array.from({ length: 20 }, (_, index) => ({ id: `id-${index + 1}` }));
    const secondIds = Array.from({ length: 20 }, (_, index) => ({ id: `id-${index + 21}` }));
    const filteredRows = Array.from({ length: 25 }, (_, index) => product(index + 1));

    mocks.directusFetch
      .mockResolvedValueOnce({ data: firstIds, meta: { total: 40 } })
      .mockResolvedValueOnce({ data: secondIds, meta: { total: 40 } })
      .mockResolvedValueOnce({ data: filteredRows });

    const result = await getProducts({
      q: "SKU",
      availability: "in_stock",
      page: 2,
      limit: 12,
    });

    expect(result.total).toBe(25);
    expect(result.items).toHaveLength(12);
    expect(result.items[0].id).toBe("id-13");
    expect(result.items[11].id).toBe("id-24");

    const searchCalls = mocks.directusFetch.mock.calls
      .map(([url]) => String(url))
      .filter((url) => url.startsWith("/commerce/search"));
    expect(searchCalls).toHaveLength(2);

    const productRequest = String(mocks.directusFetch.mock.calls[2][0]);
    const url = new URL(productRequest, "https://store.test");
    const filter = JSON.parse(url.searchParams.get("filter") || "{}");
    const serialized = JSON.stringify(filter);
    expect(serialized).toContain('"availability_status":{"_eq":"in_stock"}');
    expect(serialized).toContain('"id":{"_in":[');
    expect(serialized).toContain('"id-40"');
  });
});
