import { getProductCount } from "@/lib/catalog";
import { absoluteUrl, escapeXml } from "@/lib/seo";

const PRODUCT_CHUNK = 1000;

export async function GET() {
  const count = await getProductCount();
  const chunks = Math.ceil(count / PRODUCT_CHUNK);
  const maps = [
    absoluteUrl("/sitemaps/static.xml"),
    ...Array.from({ length: chunks }, (_, index) => absoluteUrl(`/sitemaps/products-${index}.xml`)),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...maps.map((url) => `<sitemap><loc>${escapeXml(url)}</loc></sitemap>`),
    "</sitemapindex>",
  ].join("");

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
