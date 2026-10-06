import { allowMockFallback, directusFetch, isMockMode } from "./directus";
import { brands, defaultSettings, findBrand, mockCategories, mockProducts } from "./mock";
import type {
  CatalogQuery,
  Category,
  Product,
  ProductCode,
  ProductDetail,
  ProductDocument,
  ProductImage,
  ProductList,
  ProductRelation,
  ProductSpecification,
  SiteSettings,
  SortOption,
} from "./types";

export function normalizeCatalogText(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9А-ЯЁ]+/g, "");
}

function sortMock(items: Product[], sort: SortOption = "popular") {
  const copy = [...items];
  if (sort === "price_asc") {
    return copy.sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY));
  }
  if (sort === "price_desc") {
    return copy.sort((a, b) => (b.price ?? Number.NEGATIVE_INFINITY) - (a.price ?? Number.NEGATIVE_INFINITY));
  }
  if (sort === "title") return copy.sort((a, b) => a.title.localeCompare(b.title, "ru"));
  return copy;
}

function mockQuery({
  brand,
  category,
  q,
  availability,
  partType,
  sort = "popular",
  page = 1,
  limit = 12,
}: CatalogQuery): ProductList {
  let items = [...mockProducts];

  if (brand) {
    const meta = findBrand(brand);
    if (meta) items = items.filter((item) => item.brand.toLowerCase() === meta.name.toLowerCase());
  }
  if (category) items = items.filter((item) => item.category?.slug === category);
  if (availability) items = items.filter((item) => item.availability_status === availability);
  if (partType) items = items.filter((item) => item.part_type === partType);

  if (q) {
    const needle = normalizeCatalogText(q);
    items = items.filter((item) =>
      normalizeCatalogText(item.sku).includes(needle)
      || normalizeCatalogText(item.mpn ?? "").includes(needle)
      || normalizeCatalogText(item.title).includes(needle)
      || normalizeCatalogText(item.brand).includes(needle),
    );
  }

  items = sortMock(items, sort);
  const total = items.length;
  const start = (page - 1) * limit;
  return { items: items.slice(start, start + limit), total, page, limit, source: "mock" };
}

function mapCategory(item: Record<string, unknown>): Category {
  return {
    id: item.id ? String(item.id) : undefined,
    slug: String(item.slug ?? ""),
    title: String(item.title ?? ""),
    description: item.description ? String(item.description) : null,
    h1: item.h1 ? String(item.h1) : null,
    intro: item.intro ? String(item.intro) : null,
    image: item.image ? String(item.image) : null,
    seo_title: item.seo_title ? String(item.seo_title) : null,
    seo_description: item.seo_description ? String(item.seo_description) : null,
    is_indexable: item.is_indexable !== false,
  };
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
    category: category ? mapCategory(category) : null,
    specifications: item.specifications && typeof item.specifications === "object" && !Array.isArray(item.specifications)
      ? item.specifications as Record<string, string | number>
      : null,
    delivery_status: item.delivery_status ? String(item.delivery_status) : null,
    seo_title: item.seo_title ? String(item.seo_title) : null,
    seo_description: item.seo_description ? String(item.seo_description) : null,
    date_updated: item.date_updated ? String(item.date_updated) : null,
  };
}

const productFields = [
  "id","slug","title","sku","mpn","brand","short_description","full_description",
  "price","currency","price_status","availability_status","part_type","main_image",
  "specifications","delivery_status","seo_title","seo_description","date_updated",
  "category.id","category.slug","category.title","category.description","category.h1",
  "category.intro","category.image","category.seo_title","category.seo_description","category.is_indexable",
].join(",");

const relationProductFields = [
  "id","status","slug","title","sku","mpn","brand","price","currency",
  "price_status","availability_status","part_type","main_image",
  "category.id","category.slug","category.title",
].join(",");

function directusSort(sort: SortOption = "popular") {
  if (sort === "price_asc") return "price,title";
  if (sort === "price_desc") return "-price,title";
  if (sort === "title") return "title";
  return "-popularity_score,title";
}

export async function getProducts(query: CatalogQuery = {}): Promise<ProductList> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(24, Math.max(1, query.limit ?? 12));
  if (isMockMode()) return mockQuery({ ...query, page, limit });

  try {
    let ids: string[] | null = null;
    let searchTotal: number | null = null;

    if (query.q?.trim()) {
      const search = await directusFetch<{ data: Array<{ id: string }>; meta?: { total?: number } }>(
        `/commerce/search?q=${encodeURIComponent(query.q)}&page=${page}&limit=${Math.min(limit, 20)}`,
        { revalidate: 15 },
      );
      ids = search.data.map((item) => item.id);
      searchTotal = Number(search.meta?.total ?? ids.length);
      if (!ids.length) return { items: [], total: 0, page, limit, source: "directus" };
    }

    const filters: Record<string, unknown>[] = [{ status: { _eq: "published" } }];
    if (query.brand) {
      const meta = findBrand(query.brand);
      filters.push({ brand: { _eq: meta?.name ?? query.brand } });
    }
    if (query.category) filters.push({ category: { slug: { _eq: query.category } } });
    if (query.availability) filters.push({ availability_status: { _eq: query.availability } });
    if (query.partType) filters.push({ part_type: { _eq: query.partType } });
    if (ids) filters.push({ id: { _in: ids } });

    const params = new URLSearchParams({
      fields: productFields,
      limit: String(limit),
      page: String(ids ? 1 : page),
      sort: directusSort(query.sort),
      meta: "filter_count",
      filter: JSON.stringify({ _and: filters }),
    });

    const result = await directusFetch<{ data: Record<string, unknown>[]; meta?: { filter_count?: number } }>(
      `/items/products?${params.toString()}`,
      { revalidate: 30 },
    );

    const mapped = result.data.map(mapProduct);
    if (ids && !query.sort) {
      const order = new Map(ids.map((id, index) => [id, index]));
      mapped.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
    }

    const hasPostSearchFilters = Boolean(query.brand || query.category || query.availability || query.partType);
    return {
      items: mapped,
      total: ids
        ? (hasPostSearchFilters ? mapped.length : searchTotal ?? mapped.length)
        : Number(result.meta?.filter_count ?? mapped.length),
      page,
      limit,
      source: "directus",
    };
  } catch (error) {
    console.error("Storefront catalog error:", error);
    if (allowMockFallback()) return mockQuery({ ...query, page, limit });
    return { items: [], total: 0, page, limit, source: "directus" };
  }
}

export async function getCategories(): Promise<Category[]> {
  if (isMockMode()) return mockCategories;
  try {
    const params = new URLSearchParams({
      fields: "id,slug,title,description,h1,intro,image,seo_title,seo_description,is_indexable",
      limit: "200",
      sort: "sort_order,title",
      filter: JSON.stringify({ status: { _eq: "published" } }),
    });
    const result = await directusFetch<{ data: Record<string, unknown>[] }>(
      `/items/categories?${params.toString()}`,
      { revalidate: 300 },
    );
    return result.data.map(mapCategory);
  } catch (error) {
    console.error("Storefront categories error:", error);
    return allowMockFallback() ? mockCategories : [];
  }
}

export async function getCategory(slug: string): Promise<Category | null> {
  const categories = await getCategories();
  return categories.find((category) => category.slug === slug) ?? null;
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
    console.error("Storefront product error:", error);
    return allowMockFallback() ? mockProducts.find((item) => item.slug === slug) ?? null : null;
  }
}

function mockDetail(product: Product): ProductDetail {
  const compatible = mockProducts
    .filter((candidate) => candidate.id !== product.id && candidate.category?.slug === product.category?.slug)
    .slice(0, 3)
    .map((candidate): ProductRelation => ({ relation_type: "compatible", product: candidate }));

  const codes: ProductCode[] = [
    { code: normalizeCatalogText(product.sku), code_type: "external", source_name: "normalized" },
    ...(product.mpn ? [{ code: product.mpn, code_type: "mpn" as const, source_name: "demo" }] : []),
  ];

  if (product.sku === "RE568158") {
    codes.push({ code: "RE-568158", code_type: "previous", source_name: "demo" });
  }

  return {
    ...product,
    codes,
    images: [],
    documents: [],
    specification_items: Object.entries(product.specifications ?? {}).map(([name, value]) => ({
      name,
      value: String(value),
      group_name: "Основные",
    })),
    relations: compatible,
  };
}

export async function getProductDetail(slug: string): Promise<ProductDetail | null> {
  const product = await getProduct(slug);
  if (!product) return null;
  if (isMockMode()) return mockDetail(product);

  try {
    const [codesResult, imagesResult, documentsResult, specsResult, relationsResult] = await Promise.all([
      directusFetch<{ data: Record<string, unknown>[] }>(
        `/items/product_codes?limit=100&sort=code_type,code&fields=code,code_type,source_name&filter=${encodeURIComponent(JSON.stringify({ _and: [{ product: { _eq: product.id } }, { is_active: { _eq: true } }] }))}`,
        { revalidate: 60 },
      ).catch(() => ({ data: [] })),
      directusFetch<{ data: Record<string, unknown>[] }>(
        `/items/product_images?limit=50&sort=sort_order&fields=image,alt_text&filter=${encodeURIComponent(JSON.stringify({ _and: [{ product: { _eq: product.id } }, { status: { _eq: "published" } }] }))}`,
        { revalidate: 60 },
      ).catch(() => ({ data: [] })),
      directusFetch<{ data: Record<string, unknown>[] }>(
        `/items/product_documents?limit=50&sort=sort_order&fields=file,title&filter=${encodeURIComponent(JSON.stringify({ _and: [{ product: { _eq: product.id } }, { status: { _eq: "published" } }] }))}`,
        { revalidate: 60 },
      ).catch(() => ({ data: [] })),
      directusFetch<{ data: Record<string, unknown>[] }>(
        `/items/product_specifications?limit=200&sort=sort_order&fields=group_name,name,value,unit&filter=${encodeURIComponent(JSON.stringify({ _and: [{ product: { _eq: product.id } }, { status: { _eq: "published" } }] }))}`,
        { revalidate: 60 },
      ).catch(() => ({ data: [] })),
      directusFetch<{ data: Record<string, unknown>[] }>(
        `/items/products_analogs?limit=100&fields=relation_type,product_from.${relationProductFields.split(",").join(",product_from.")},product_to.${relationProductFields.split(",").join(",product_to.")}&filter=${encodeURIComponent(JSON.stringify({ _or: [{ product_from: { _eq: product.id } }, { product_to: { _eq: product.id } }] }))}`,
        { revalidate: 60 },
      ).catch(() => ({ data: [] })),
    ]);

    const relations: ProductRelation[] = [];
    for (const edge of relationsResult.data) {
      const from = edge.product_from && typeof edge.product_from === "object" ? edge.product_from as Record<string, unknown> : null;
      const to = edge.product_to && typeof edge.product_to === "object" ? edge.product_to as Record<string, unknown> : null;
      const opposite = String(from?.id ?? "") === product.id ? to : from;
      if (!opposite || opposite.status === "draft" || opposite.status === "archived") continue;
      relations.push({
        relation_type: edge.relation_type as ProductRelation["relation_type"],
        product: mapProduct(opposite),
      });
    }

    return {
      ...product,
      codes: codesResult.data.map((item) => ({
        code: String(item.code ?? ""),
        code_type: item.code_type as ProductCode["code_type"],
        source_name: item.source_name ? String(item.source_name) : null,
      })).filter((item) => item.code),
      images: imagesResult.data.map((item): ProductImage => ({
        image: String(item.image ?? ""),
        alt_text: item.alt_text ? String(item.alt_text) : null,
      })).filter((item) => item.image),
      documents: documentsResult.data.map((item): ProductDocument => ({
        file: String(item.file ?? ""),
        title: item.title ? String(item.title) : null,
      })).filter((item) => item.file),
      specification_items: specsResult.data.map((item): ProductSpecification => ({
        group_name: item.group_name ? String(item.group_name) : null,
        name: String(item.name ?? ""),
        value: String(item.value ?? ""),
        unit: item.unit ? String(item.unit) : null,
      })).filter((item) => item.name),
      relations,
    };
  } catch (error) {
    console.error("Storefront product detail error:", error);
    if (allowMockFallback()) return mockDetail(product);
    return { ...product, codes: [], images: [], documents: [], specification_items: [], relations: [] };
  }
}

export async function getRelatedProducts(product: Product, limit = 4) {
  const result = await getProducts({ category: product.category?.slug, brand: undefined, limit: Math.min(limit + 1, 12) });
  return result.items.filter((item) => item.id !== product.id).slice(0, limit);
}

export async function getProductCount() {
  if (isMockMode()) return mockProducts.length;
  try {
    const params = new URLSearchParams({
      limit: "1",
      fields: "id",
      meta: "filter_count",
      filter: JSON.stringify({ status: { _eq: "published" } }),
    });
    const result = await directusFetch<{ data: unknown[]; meta?: { filter_count?: number } }>(
      `/items/products?${params.toString()}`,
      { revalidate: 300 },
    );
    return Number(result.meta?.filter_count ?? result.data.length);
  } catch {
    return 0;
  }
}

export async function getProductsForSitemap(offset: number, limit: number) {
  if (isMockMode()) {
    return mockProducts.slice(offset, offset + limit).map(({ slug, date_updated }) => ({ slug, date_updated }));
  }
  const params = new URLSearchParams({
    fields: "slug,date_updated",
    limit: String(limit),
    offset: String(offset),
    sort: "id",
    filter: JSON.stringify({ status: { _eq: "published" } }),
  });
  const result = await directusFetch<{ data: Array<{ slug: string; date_updated?: string | null }> }>(
    `/items/products?${params.toString()}`,
    { revalidate: 300 },
  );
  return result.data;
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
  } catch (error) {
    if (allowMockFallback()) return defaultSettings;
    throw error;
  }
}

export { brands, findBrand };
