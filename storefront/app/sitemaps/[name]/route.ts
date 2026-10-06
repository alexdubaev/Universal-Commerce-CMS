import { getBrands, getCategories, getProductsForSitemap } from "@/lib/catalog";
import { getIndexableCmsPages } from "@/lib/content";
import { absoluteUrl, escapeXml } from "@/lib/seo";

const PRODUCT_CHUNK = 1000;

function urlNode(path: string, lastmod?: string | null) {
  return `<url><loc>${escapeXml(absoluteUrl(path))}</loc>${lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ""}</url>`;
}

function xmlResponse(nodes: string[]) {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...nodes,
    "</urlset>",
  ].join("");
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}

export async function GET(_: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;

  if (name === "static.xml") {
    const [brandList, categories, cmsPages] = await Promise.all([getBrands(), getCategories(), getIndexableCmsPages()]);
    const staticRoutes = ["/", "/catalog", "/brands", "/delivery", "/payment", "/about", "/contacts"];
    const reserved = new Set(staticRoutes.map((path) => path.replace(/^\//, "")));
    return xmlResponse([
      ...staticRoutes.map((path) => urlNode(path)),
      ...brandList.map((brand) => urlNode(`/brand/${brand.slug}`)),
      ...categories.filter((category) => category.is_indexable !== false).map((category) => urlNode(`/category/${category.slug}`)),
      ...cmsPages.filter((page) => !reserved.has(page.slug)).map((page) => urlNode(`/${page.slug}`, page.updated_at)),
    ]);
  }

  const match = name.match(/^products-(\d+)\.xml$/);
  if (!match) return new Response("Not found", { status: 404 });

  const page = Number(match[1]);
  if (!Number.isSafeInteger(page) || page < 0) return new Response("Not found", { status: 404 });

  const products = await getProductsForSitemap(page * PRODUCT_CHUNK, PRODUCT_CHUNK);
  if (!products.length && page > 0) return new Response("Not found", { status: 404 });

  return xmlResponse(products.map((product) => urlNode(`/product/${product.slug}`, product.date_updated)));
}
