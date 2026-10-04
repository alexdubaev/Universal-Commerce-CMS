import { directusFetch, isMockMode } from "./directus";
import { brands, defaultSettings, findBrand, mockProducts } from "./mock";
import type { Product, ProductList, SiteSettings } from "./types";

type Query = { brand?: string; q?: string; page?: number; limit?: number };

function normalize(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9А-ЯЁ]+/g, "");
}

function mockQuery({ brand, q, page = 1, limit = 12 }: Query): ProductList {
  let items = [...mockProducts];
  if (brand) {
    const meta = findBrand(brand);
    if (meta) items = items.filter((item) => item.brand.toLowerCase() === meta.name.toLowerCase());
  }
  if (q) {
    const needle = normalize(q);
    items = items.filter((item) =>
      normalize(item.sku).includes(needle)
      || normalize(item.mpn ?? "").includes(needle)
      || normalize(item.title).includes(needle)
      || normalize(item.brand).includes(needle),
    );
  }
  const total = items.length;
  const start = (page - 1) * limit;
  return { items: items.slice(start, start + limit), total, page, limit, source: "mock" };
}

function mapProduct(item: Record<string, unknown>): Product {
  const category = item.category && typeof item.category === "object"
    ? item.category as Record<string, unknown>
    : null;

  return {
    id: String(item.id),
    slug: String(item.slug ?? ""),
    title: String(item.title ?? ""),
    sku: String(item.sku ?? ""),
    mpn: item.mpn ? String(item.mpn) : null,
    brand: String(item.brand ?? ""),
    short_description: item.short_description ? String(item.short_description) : null,
    full_description: item.full_description ? String(item.full_description) : null,
    price: item.price == null ? null : Number(item.price),
    currency: item.currency ? String(item.currency) : "RUB",
    price_status: (item.price_status as Product["price_status"]) ?? "on_request",
    availability_status: (item.availability_status as Product["availability_status"]) ?? "on_request",
    part_type: (item.part_type as Product["part_type"]) ?? null,
    main_image: item.main_image ? String(item.main_image) : null,
    category: category ? {
      id: category.id ? String(category.id) : undefined,
      slug: String(category.slug ?? ""),
      title: String(category.title ?? ""),
    } : null,
    specifications: item.specifications && typeof item.specifications === "object"
      ? item.specifications as Record<string, string | number>
      : null,
    delivery_status: item.delivery_status ? String(item.delivery_status) : null,
  };
}

const productFields = [
  "id","slug","title","sku","mpn","brand","short_description","full_description",
  "price","currency","price_status","availability_status","part_type","main_image",
  "specifications","delivery_status","category.id","category.slug","category.title",
].join(",");

export async function getProducts(query: Query = {}): Promise<ProductList> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(24, Math.max(1, query.limit ?? 12));
  if (isMockMode()) return mockQuery({ ...query, page, limit });

  try {
    let ids: string[] | null = null;
    if (query.q?.trim()) {
      const search = await directusFetch<{ data: Array<{ id: string }>; meta?: { total?: number } }>(
        `/commerce/search?q=${encodeURIComponent(query.q)}&page=${page}&limit=${Math.min(limit, 20)}`,
        { revalidate: 15 },
      );
      ids = search.data.map((item) => item.id);
      if (!ids.length) return { items: [], total: 0, page, limit, source: "directus" };
    }

    const filters: Record<string, unknown>[] = [{ status: { _eq: "published" } }];
    if (query.brand) {
      const meta = findBrand(query.brand);
      filters.push({ brand: { _eq: meta?.name ?? query.brand } });
    }
    if (ids) filters.push({ id: { _in: ids } });

    const params = new URLSearchParams({
      fields: productFields,
      limit: String(limit),
      page: String(ids ? 1 : page),
      sort: "-popularity_score,title",
      meta: "filter_count",
      filter: JSON.stringify({ _and: filters }),
    });

    const result = await directusFetch<{ data: Record<string, unknown>[]; meta?: { filter_count?: number } }>(
      `/items/products?${params.toString()}`,
      { revalidate: 30 },
    );

    const mapped = result.data.map(mapProduct);
    if (ids) {
      const order = new Map(ids.map((id, index) => [id, index]));
      mapped.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
    }

    return {
      items: mapped,
      total: ids ? mapped.length : Number(result.meta?.filter_count ?? mapped.length),
      page,
      limit,
      source: "directus",
    };
  } catch (error) {
    console.error("Storefront catalog fallback:", error);
    return mockQuery({ ...query, page, limit });
  }
}

export async function getProduct(slug: string): Promise<Product | null> {
  if (isMockMode()) return mockProducts.find((item) => item.slug === slug) ?? null;
  try {
    const params = new URLSearchParams({
      fields: productFields,
      limit: "1",
      filter: JSON.stringify({ _and: [{ status: { _eq: "published" } }, { slug: { _eq: slug } }] }),
    });
    const result = await directusFetch<{ data: Record<string, unknown>[] }>(
      `/items/products?${params.toString()}`,
      { revalidate: 30 },
    );
    return result.data[0] ? mapProduct(result.data[0]) : null;
  } catch (error) {
    console.error("Storefront product fallback:", error);
    return mockProducts.find((item) => item.slug === slug) ?? null;
  }
}

export async function getSiteSettings(): Promise<SiteSettings> {
  if (isMockMode()) return defaultSettings;
  try {
    const result = await directusFetch<{ data: Record<string, unknown>[] }>(
      "/items/site_settings?limit=1&fields=company_name,phone,email,primary_cta_text,primary_cta_url",
      { revalidate: 120 },
    );
    const row = result.data[0];
    if (!row) return defaultSettings;
    return {
      company_name: String(row.company_name ?? defaultSettings.company_name),
      phone: String(row.phone ?? defaultSettings.phone),
      email: String(row.email ?? defaultSettings.email),
      primary_cta_text: String(row.primary_cta_text ?? defaultSettings.primary_cta_text),
      primary_cta_url: String(row.primary_cta_url ?? defaultSettings.primary_cta_url),
    };
  } catch {
    return defaultSettings;
  }
}

export { brands, findBrand };
