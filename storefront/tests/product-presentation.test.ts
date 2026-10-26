import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product, ProductDetail } from "../lib/types";
import { formatProductPrice } from "../lib/format";
import { getProductDetail, getRelatedProducts } from "../lib/catalog";
import ProductPage, { generateMetadata } from "../app/product/[slug]/page";

// Keep the real rendered page and components; isolate only its catalog reads.
vi.mock("../lib/catalog", async (importOriginal) => ({
  ...await importOriginal<typeof import("../lib/catalog")>(),
  getProductDetail: vi.fn(),
  getRelatedProducts: vi.fn(),
}));

function item(id: string): Product {
  return { id, slug: id, title: `Тестовая деталь ${id}`, brand: "Perkins", sku: id, price_status: "on_request", availability_status: "on_request" };
}

let product: ProductDetail;
const props = { params: Promise.resolve({ slug: "current" }) };
beforeEach(() => {
  vi.stubEnv("STOREFRONT_MOCK_MODE", "true");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://synthetic.example");
  product = { ...item("current"), title: "Фильтр", sku: "2654403", codes: [], images: [], documents: [], specification_items: [], relations: [] };
  vi.mocked(getProductDetail).mockImplementation(async () => product);
  vi.mocked(getRelatedProducts).mockResolvedValue([]);
});

describe("product price formatting", () => {
  it("preserves each currency's fractional minor units and keeps integer rubles compact", () => {
    expect(formatProductPrice(12.5, "RUB")).toBe("12,50\u00a0₽");
    expect(formatProductPrice(12.5, "USD")).toBe("12,50\u00a0$");
    expect(formatProductPrice(1.234, "KWD")).toBe("1,234\u00a0KWD");
    expect(formatProductPrice(12, "RUB")).toBe("12\u00a0₽");
  });

  it("uses the fallback currency for unknown codes and keeps unavailable prices on request", () => {
    expect(formatProductPrice(12.5, "invalid")).toBe("12,50\u00a0₽");
    expect(formatProductPrice(null, "RUB")).toBe("Цена по запросу");
  });
});

describe("rendered product identity and typed links", () => {
  it("keeps the real SKU when the title contains a different number with the same prefix", async () => {
    product.title = "Фильтр 26544030";
    const heading = "Фильтр 26544030 Perkins 2654403";
    expect(await generateMetadata(props)).toMatchObject({ title: heading, openGraph: { title: heading } });
    const html = renderToStaticMarkup(await ProductPage(props));
    expect(html).toContain(`<h1>${heading}</h1>`);
    expect(html).toContain(`"name":"${heading}"`);
    expect(html).not.toContain('"offers"');
  });

  it("recognizes the complete article with equivalent hyphen spelling without appending it twice", async () => {
    product.title = "Фильтр Perkins 1R1808";
    product.sku = "1R-1808";
    expect(await generateMetadata(props)).toMatchObject({ title: product.title });
    expect(renderToStaticMarkup(await ProductPage(props))).toContain(`<h1>${product.title}</h1>`);
  });

  it("shows every distinct relation meaning next to one card per position and excludes them from related", async () => {
    const analog = item("analog"), linked = item("linked"), other = item("other");
    product.relations = [
      { product: analog, relation_type: "superseded_by" },
      { product: analog, relation_type: "analog" },
      { product: analog, relation_type: "analog" },
      { product: linked, relation_type: "compatible" },
      { product: linked, relation_type: "oem_cross" },
      { product, relation_type: "analog" },
    ];
    vi.mocked(getRelatedProducts).mockResolvedValue([analog, linked, product, other, other]);
    const html = renderToStaticMarkup(await ProductPage(props));
    for (const label of ["Аналог", "Связь замены", "Связь применяемости", "Перекрёстная ссылка OEM"]) {
      expect(html).toContain(`>${label}</span>`);
    }
    for (const id of ["analog", "linked", "other"]) {
      expect(html.match(new RegExp(`class="product-title" href="/product/${id}"`, "g"))).toHaveLength(1);
    }
    expect(html).not.toContain('class="product-title" href="/product/current"');
  });
});
