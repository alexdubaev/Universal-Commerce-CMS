import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ directusFetch: vi.fn() }));
vi.mock("../lib/directus", () => ({
  allowMockFallback: () => false, isMockMode: () => false, directusFetch: mocks.directusFetch,
}));
import { getProducts } from "../lib/catalog";

const rows = Array.from({ length: 9 }, (_, i) => ({
  id: `id-${i}`, slug: `part-${i}`, title: `Part ${i}`, sku: `SKU${i}`, brand: "Test",
  main_image: i < 4 ? `image-${i}` : null,
}));

describe("global image-first live catalog pagination", () => {
  beforeEach(() => {
    mocks.directusFetch.mockReset();
    mocks.directusFetch.mockImplementation(async (path: string) => {
      const params = new URL(path, "https://test.local").searchParams;
      const filter = JSON.parse(params.get("filter") || "{}");
      const term = filter._and?.find((item: Record<string, unknown>) => item.main_image)?.main_image;
      const group = term?._nnull ? rows.slice(0, 4) : term?._null ? rows.slice(4) : rows;
      const offset = Number(params.get("offset") || 0);
      return { data: group.slice(offset, offset + Number(params.get("limit"))), meta: { filter_count: group.length } };
    });
  });

  it("reads bounded first, boundary and late pages without omissions or duplicates", async () => {
    const pages = [];
    for (let page = 1; page <= 3; page++) {
      mocks.directusFetch.mockClear();
      const result = await getProducts({ page, limit: 3 });
      expect(result.total).toBe(9);
      pages.push(...result.items);
      expect(mocks.directusFetch.mock.calls.length).toBeLessThanOrEqual(4);
      const requests = mocks.directusFetch.mock.calls.map(([path]) => new URL(String(path), "https://test.local").searchParams);
      expect(requests.filter(params => params.get("fields") === "id")).toHaveLength(2);
      for (const params of requests) {
        expect(Number(params.get("limit"))).toBeLessThanOrEqual(3);
        if (params.get("fields") !== "id") expect(params.get("sort")).toBe("-popularity_score,title,id");
      }
    }
    expect(pages.map(row => row.id)).toEqual(rows.map(row => row.id));
  });

  it("carries catalog filters through both counts and slices", async () => {
    await getProducts({ category: "parts", availability: "in_stock", partType: "original", page: 2, limit: 3, sort: "popular" });
    for (const [path] of mocks.directusFetch.mock.calls) {
      const terms = JSON.parse(new URL(String(path), "https://test.local").searchParams.get("filter") || "{}")._and;
      expect(terms).toContainEqual({ category: { slug: { _eq: "parts" } } });
      expect(terms).toContainEqual({ availability_status: { _eq: "in_stock" } });
      expect(terms).toContainEqual({ part_type: { _eq: "original" } });
    }
  });

  it.each(["price_asc", "price_desc", "title"] as const)("preserves explicit %s ordering with one request", async sort => {
    await getProducts({ sort });
    expect(mocks.directusFetch).toHaveBeenCalledTimes(1);
    const params = new URL(String(mocks.directusFetch.mock.calls[0][0]), "https://test.local").searchParams;
    expect(params.get("sort")).toBe({ price_asc: "price,title", price_desc: "-price,title", title: "title" }[sort]);
    expect(JSON.parse(params.get("filter") || "{}")._and).not.toContainEqual(expect.objectContaining({ main_image: expect.anything() }));
  });

  it.each([undefined, -1, 1.5, Number.NaN, "4"])("rejects an invalid partition count (%s)", async count => {
    mocks.directusFetch.mockReset();
    mocks.directusFetch.mockResolvedValue({ data: [], meta: { filter_count: count } });
    const silence = vi.spyOn(console, "error").mockImplementation(() => {});
    try { await expect(getProducts()).rejects.toThrow("Catalog partition count"); }
    finally { silence.mockRestore(); }
    expect(mocks.directusFetch).toHaveBeenCalledTimes(2);
  });

  it("returns an empty out-of-range page without requesting slices", async () => {
    const result = await getProducts({ page: 10, limit: 3 });
    expect(result.items).toEqual([]); expect(result.total).toBe(9);
    expect(mocks.directusFetch).toHaveBeenCalledTimes(2);
  });

  it("does not partition unfiltered search or change relevance", async () => {
    mocks.directusFetch.mockReset();
    mocks.directusFetch.mockResolvedValueOnce({ data: [{ id: "id-5" }, { id: "id-0" }], meta: { total: 2 } })
      .mockResolvedValueOnce({ data: [rows[0], rows[5]], meta: { filter_count: 2 } });
    const result = await getProducts({ q: "SKU" });
    expect(result.items.map(row => row.id)).toEqual(["id-5", "id-0"]);
    expect(mocks.directusFetch).toHaveBeenCalledTimes(2);
  });
});
