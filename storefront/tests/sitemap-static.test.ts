import { beforeEach, describe, expect, it, vi } from "vitest";

const cms = vi.hoisted(() => ({
  getCmsHome: vi.fn(), getCmsPage: vi.fn(), getIndexableCmsPages: vi.fn(),
}));
vi.mock("../lib/catalog", () => ({
  getBrands: async () => [], getCategories: async () => [], getProductsForSitemap: async () => [],
}));
vi.mock("../lib/content", () => cms);

import { GET } from "../app/sitemaps/[name]/route";

async function sitemapPaths() {
  const response = await GET(new Request("https://test.example/sitemaps/static.xml"), {
    params: Promise.resolve({ name: "static.xml" }),
  });
  const xml = await response.text();
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
}

describe("static sitemap CMS indexability", () => {
  beforeEach(() => {
    cms.getCmsHome.mockReset().mockResolvedValue(null);
    cms.getCmsPage.mockReset().mockResolvedValue(null);
    cms.getIndexableCmsPages.mockReset().mockResolvedValue([]);
  });

  it("excludes a noindex home and fixed CMS overrides", async () => {
    cms.getCmsHome.mockResolvedValue({ is_indexable: false });
    cms.getCmsPage.mockResolvedValue({ is_indexable: false });
    expect(await sitemapPaths()).toEqual(["/catalog", "/brands"]);
  });

  it("preserves fallback routes when no published CMS override exists", async () => {
    expect(await sitemapPaths()).toEqual(["/", "/catalog", "/brands", "/delivery", "/payment", "/about", "/contacts"]);
  });

  it("keeps indexable overrides once and includes future indexable CMS pages", async () => {
    cms.getCmsHome.mockResolvedValue({ is_indexable: true });
    cms.getCmsPage.mockImplementation(async (slug) => ({ slug, is_indexable: slug !== "payment" }));
    cms.getIndexableCmsPages.mockResolvedValue([{ slug: "about" }, { slug: "warranty" }]);
    const paths = await sitemapPaths();
    expect(paths).not.toContain("/payment");
    expect(paths.filter((path) => path === "/about")).toHaveLength(1);
    expect(paths).toContain("/warranty");
  });
});
