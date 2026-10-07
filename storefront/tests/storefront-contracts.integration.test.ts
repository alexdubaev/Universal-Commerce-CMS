import { createServer } from "node:http";
import { once } from "node:events";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const token = "synthetic-server-secret-never-public";
const imageId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const pdfId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const htmlId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const privateId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const timestamp = "2026-10-07T12:00:00.000Z";
let rows: Record<string, Row[]>;
let unavailable = false;

// Synthetic HTTP data service, independent of the adapter's request order.
function matches(value: unknown, filter: unknown): boolean {
  if (!filter || typeof filter !== "object") return true;
  return Object.entries(filter).every(([key, expected]) => {
    const row = value && typeof value === "object" ? value as Row : {};
    const scalar = row.id ?? value;
    if (key === "_and") return (expected as unknown[]).every(term => matches(value, term));
    if (key === "_or") return (expected as unknown[]).some(term => matches(value, term));
    if (key === "_eq") return scalar === expected;
    if (key === "_in") return (expected as unknown[]).includes(scalar);
    if (key === "_null") return (value == null) === expected;
    if (key === "_nnull") return (value != null) === expected;
    return matches(row[key], expected);
  });
}

function sliceRows(items: Row[], params: URLSearchParams) {
  const offset = Number(params.get("offset") ?? (Number(params.get("page") ?? 1) - 1) * Number(params.get("limit") ?? 100));
  return items.slice(offset, offset + Number(params.get("limit") ?? 100));
}

const server = createServer((request, response) => {
  const json = (body: unknown, status = 200) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  };
  if (request.headers.authorization !== `Bearer ${token}`) return json({}, 403);
  if (unavailable) return json({ errors: [{ message: `upstream diagnostic ${token}` }] }, 503);
  const url = new URL(request.url!, "http://localhost");
  if (url.pathname.startsWith("/commerce/storefront/assets/")) {
    response.writeHead(200, { "content-type": url.pathname.endsWith(htmlId) ? "text/html" : url.pathname.endsWith(pdfId) ? "application/pdf" : "image/png" });
    return response.end("synthetic asset bytes");
  }
  if (url.pathname === "/commerce/storefront/search") {
    const query = url.searchParams.get("q")!.replace(/[^a-z0-9]/gi, "").toUpperCase();
    const products = rows.products.filter(row => row.status === "published" && String(row.sku).replace(/[^a-z0-9]/gi, "").includes(query));
    return json({ data: sliceRows(products, url.searchParams).map(({ id }) => ({ id })), meta: { total: products.length } });
  }
  const collection = /^\/commerce\/storefront\/items\/([a-z_]+)$/.exec(url.pathname)?.[1];
  if (!collection || !rows[collection]) return json({}, 404);
  const items = rows[collection].filter(row => matches(row, JSON.parse(url.searchParams.get("filter") ?? "{}")));
  if (url.searchParams.has("aggregate[count]")) {
    const brands = [...new Set(items.map(row => row.brand))];
    return json({ data: brands.map(brand => ({ brand, count: items.filter(row => row.brand === brand).length })) });
  }
  for (const field of (url.searchParams.get("sort") ?? "").split(",").reverse().filter(Boolean)) {
    const key = field.replace(/^-/, "");
    items.sort((a, b) => (typeof a[key] === "number" && typeof b[key] === "number"
      ? Number(a[key]) - Number(b[key]) : String(a[key] ?? "").localeCompare(String(b[key] ?? ""))) * (field.startsWith("-") ? -1 : 1));
  }
  const fields = [...new Set((url.searchParams.get("fields") ?? "").split(",").map(field => field.split(".")[0]))];
  const data = sliceRows(items, url.searchParams).map(row => Object.fromEntries(fields.filter(field => field in row).map(field => [field, row[field]])));
  json({ data: ["site_settings", "home_page"].includes(collection) ? data[0] ?? null : data, meta: { filter_count: items.length } });
});

let catalog: typeof import("../lib/catalog");
let content: typeof import("../lib/content");
let directus: typeof import("../lib/directus");
let sitemap: typeof import("../app/sitemaps/[name]/route");
let assets: typeof import("../app/api/assets/[id]/route");
let lead: typeof import("../app/api/lead/route");

beforeAll(async () => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing synthetic backend port");
  vi.stubEnv("DIRECTUS_URL", `http://127.0.0.1:${address.port}`);
  vi.stubEnv("DIRECTUS_TOKEN", token);
  vi.stubEnv("STOREFRONT_MOCK_MODE", "false");
  vi.stubEnv("STOREFRONT_ALLOW_MOCK_FALLBACK", "false");
  vi.stubEnv("STOREFRONT_DIRECTUS_GATEWAY", "true");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://synthetic.example");
  vi.resetModules();
  [catalog, content, directus, sitemap, assets, lead] = await Promise.all([
    import("../lib/catalog"), import("../lib/content"), import("../lib/directus"),
    import("../app/sitemaps/[name]/route"), import("../app/api/assets/[id]/route"), import("../app/api/lead/route"),
  ]);
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  vi.unstubAllEnvs();
  vi.resetModules();
});

beforeEach(() => {
  unavailable = false;
  const category = { id: "parts", slug: "parts", title: "Parts", status: "published" };
  const products = Array.from({ length: 32 }, (_, i) => ({
    id: `p${String(i).padStart(2, "0")}`, slug: `part-${i}`, sku: `PART-${i}`, title: `Part ${i}`,
    brand: i === 24 ? "caterpillar" : "LiuGong", category: i === 26 ? { ...category, slug: "other" } : category, status: "published", price: 100 - i,
    availability_status: i >= 20 ? "in_stock" : "on_request", part_type: i === 28 ? "aftermarket" : "original",
    popularity_score: 100 - i, main_image: i < 20 && i % 5 === 0 ? imageId : null,
    updated_at: i === 1 ? null : timestamp, is_indexable: i !== 31,
  }));
  rows = {
    products: [...products, { ...products[0], id: "draft", slug: "draft", status: "draft", main_image: privateId }],
    categories: [category],
    product_documents: [
      { id: "pdf", file: pdfId, title: "Synthetic PDF", status: "published", product: products[0] },
      { id: "html", file: htmlId, title: "Synthetic HTML", status: "published", product: products[0] },
    ],
    product_codes: [], product_images: [], product_specifications: [], products_analogs: [],
    site_settings: [{ company_name: "Synthetic Company", phone: "+79990000000", email: "sales@example.invalid" }],
    home_page: [{ id: "home", status: "published", hero_title: "Synthetic Home", is_indexable: false }],
    pages: [{ id: "payment", slug: "payment", title: "Payment", status: "published", is_indexable: false, canonical_url: "javascript:alert(1)" },
      { id: "warranty", slug: "warranty", title: "Warranty", status: "published", is_indexable: true, updated_at: timestamp }],
    page_sections: [],
    navigation_items: [
      { id: "safe", label: "Catalog", url: "/catalog", status: "published", is_visible: true, location: "header", parent: null },
      { id: "unsafe", label: "Unsafe", url: "javascript:alert(1)", status: "published", is_visible: true, location: "header", parent: null },
    ],
  };
});

const mapResponse = (name: string) => sitemap.GET(new Request(`https://synthetic.example/sitemaps/${name}`), { params: Promise.resolve({ name }) });
const assetResponse = (id: string) => assets.GET(new Request(`https://synthetic.example/api/assets/${id}`), { params: Promise.resolve({ id }) });

describe("storefront routes and adapters over HTTP", () => {
  it("maps CMS timestamps, future brand labels and published singleton content", async () => {
    expect(await catalog.getBrands()).toEqual(expect.arrayContaining([expect.objectContaining({ slug: "liugong", name: "LiuGong" }), expect.objectContaining({ slug: "caterpillar", name: "caterpillar" })]));
    expect((await catalog.getProducts({ brand: "liugong", sort: "title" })).items.every(row => row.brand === "LiuGong")).toBe(true);
    expect((await catalog.getProducts({ brand: "caterpillar", sort: "title" })).items.map(row => row.id)).toEqual(["p24"]);
    expect(await catalog.getProductDetail("part-0")).toMatchObject({ date_updated: timestamp, documents: [{ file: pdfId, title: "Synthetic PDF" }, { file: htmlId, title: "Synthetic HTML" }] });
    expect(await catalog.getProduct("part-1")).toMatchObject({ date_updated: null });
    expect(await catalog.getProduct("draft")).toBeNull();
    expect(await content.getCmsSiteSettings()).toMatchObject({ company_name: "Synthetic Company" });
    expect(await content.getCmsHome()).toMatchObject({ hero_title: "Synthetic Home" });
    rows.home_page[0].status = "draft";
    expect(await content.getCmsHome()).toBeNull();
  });

  it("paginates across the image boundary without missing or duplicating products", async () => {
    const first = await catalog.getProducts({ limit: 3 });
    const boundary = await catalog.getProducts({ limit: 3, page: 2 });
    const last = await catalog.getProducts({ limit: 3, page: 11 });
    expect(first.items.map(row => row.id)).toEqual(["p00", "p05", "p10"]);
    expect(boundary.items.map(row => row.id)).toEqual(["p15", "p01", "p02"]);
    expect(last.items.map(row => row.id)).toEqual(["p30", "p31"]);
    expect(boundary.total).toBe(32);
    expect((await catalog.getProducts({ page: 12, limit: 3 })).items).toEqual([]);
  });

  it("applies facets and sorting beyond the first search candidate page", async () => {
    const query = { q: "PART", brand: "liugong", category: "parts", availability: "in_stock", partType: "original", limit: 3 } as const;
    const filtered = await catalog.getProducts({ ...query, page: 2 });
    expect(filtered.total).toBe(9);
    expect(filtered.items.map(row => row.id)).toEqual(["p23", "p25", "p27"]);
    expect((await catalog.getProducts({ ...query, sort: "price_asc" })).items.map(row => row.id)).toEqual(["p31", "p30", "p29"]);
    expect((await catalog.getProducts({ q: "PART-31" })).items.map(row => row.id)).toEqual(["p31"]);
  });

  it("excludes drafts and noindex products/pages from sitemap and metadata", async () => {
    expect(await catalog.getSitemapProductCount()).toBe(31);
    const xml = await (await mapResponse("products-0.xml")).text();
    expect(xml).toContain("/product/part-0</loc>");
    expect(xml).toContain(`<lastmod>${timestamp}</lastmod>`);
    expect(xml).not.toContain("/product/part-31</loc>");
    expect(xml).not.toContain("/product/draft</loc>");
    const statics = await (await mapResponse("static.xml")).text();
    expect(statics).not.toContain("https://synthetic.example/</loc>");
    expect(statics).not.toContain("/payment</loc>");
    expect(statics).toContain("/delivery</loc>");
    expect(statics).toContain("/warranty</loc>");
    const { generateMetadata } = await import("../app/product/[slug]/page");
    expect(await generateMetadata({ params: Promise.resolve({ slug: "part-31" }) })).toMatchObject({ robots: { index: false } });
  });

  it("serves assets safely and rechecks visibility after publication revocation", async () => {
    const image = await assetResponse(imageId);
    expect(image.status).toBe(200);
    expect(await image.text()).toBe("synthetic asset bytes");
    expect(image.headers.get("content-type")).toBe("image/png");
    expect((await assetResponse(pdfId)).headers.get("content-disposition")).toBe("inline");
    const html = await assetResponse(htmlId);
    expect(html.headers.get("content-type")).toBe("application/octet-stream");
    expect(html.headers.get("content-disposition")).toBe("attachment");
    expect(html.headers.get("cache-control")).toBe("no-store");
    expect(html.headers.get("x-content-type-options")).toBe("nosniff");
    expect(html.headers.get("content-security-policy")).toContain("sandbox");
    expect((await assetResponse(privateId)).status).toBe(404);
    expect((await assetResponse("../../etc/passwd")).status).toBe(404);
    rows.product_documents[0].status = "draft";
    expect((await assetResponse(pdfId)).status).toBe(404);
  });

  it("drops unsafe CMS links and renders script-closing content safely", async () => {
    expect(await content.getNavigation("header")).toEqual([expect.objectContaining({ url: "/catalog" })]);
    const { generateMetadata } = await import("../app/payment/page");
    expect(await generateMetadata()).toMatchObject({ alternates: { canonical: "/payment" } });
    rows.products[0].title = "</script><script>alert(1)</script>";
    const { default: ProductPage } = await import("../app/product/[slug]/page");
    const html = renderToStaticMarkup(await ProductPage({ params: Promise.resolve({ slug: "part-0" }) }));
    expect(html).not.toContain("</script><script>alert(1)</script>");
    expect(html).toContain("\\u003c/script>");
    expect(html).not.toContain(token);
  });

  it("fails closed and keeps upstream diagnostics out of public failures", async () => {
    await expect(directus.directusFetch("/items/users")).rejects.toThrow("not allowlisted");
    unavailable = true;
    const silence = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(catalog.getProducts()).rejects.toMatchObject({ status: 503 });
      const response = await lead.POST(new Request("https://synthetic.example/api/lead", {
        method: "POST", body: JSON.stringify({ name: "Synthetic Lead", phone: "+79990000000" }),
      }) as never);
      expect(response.status).toBe(502);
      expect(await response.text()).toBe(JSON.stringify({ error: "Сервис заявок временно недоступен." }));
      expect((await assetResponse(imageId)).status).toBe(404);
    } finally { silence.mockRestore(); }
  });
});
