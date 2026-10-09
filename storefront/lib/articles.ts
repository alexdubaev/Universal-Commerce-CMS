import { directusFetch, isMockMode } from "./directus";
import { isValidAssetId } from "./assets";

export type ArticleSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image: string | null;
  image_alt: string | null;
  published_at: string;
  author: string | null;
};
export type Article = ArticleSummary & {
  content: string;
  seo_title: string | null;
  seo_description: string | null;
  og_image: string | null;
  related_categories: string[];
  related_products: string[];
};

const summaryFields = "id,status,title,slug,excerpt,cover_image,image_alt,published_at,author";
const detailFields = `${summaryFields},content,seo_title,seo_description,og_image,related_categories,related_products`;
const text = (value: unknown, max: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
export function isArticleSlug(value: unknown): value is string {
  return typeof value === "string" && /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,159}$/u.test(value);
}

// Date.parse alone accepts impossible dates (for example 30 February).
function publicationDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, zone] = match;
  const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth() !== Number(month) - 1 || calendar.getUTCDate() !== Number(day)
    || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59
    || (zone !== "Z" && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59))) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now() ? new Date(timestamp).toISOString() : null;
}

function asset(value: unknown): string | null {
  return typeof value === "string" && isValidAssetId(value) ? value.toLowerCase() : null;
}
function mapSummary(row: Record<string, unknown>): ArticleSummary | null {
  const published_at = publicationDate(row.published_at);
  const title = text(row.title, 500);
  if (row.status !== "published" || !published_at || !title || !isArticleSlug(row.slug)) return null;
  const id = text(row.id, 160);
  if (!id) return null;
  return { id, title, slug: row.slug, published_at, excerpt: text(row.excerpt, 1200), author: text(row.author, 200), cover_image: asset(row.cover_image), image_alt: text(row.image_alt, 500) };
}
function identifiers(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,159}$/u.test(item)))].slice(0, 8) : [];
}
function mapArticle(row: Record<string, unknown>): Article | null {
  const summary = mapSummary(row);
  return summary ? { ...summary, content: typeof row.content === "string" ? row.content : "", seo_title: text(row.seo_title, 500), seo_description: text(row.seo_description, 1200), og_image: asset(row.og_image), related_categories: identifiers(row.related_categories), related_products: identifiers(row.related_products) } : null;
}
function filter(slug?: string) {
  return { _and: [{ status: { _eq: "published" } }, { published_at: { _lte: new Date().toISOString() } }, ...(slug ? [{ slug: { _eq: slug } }] : [])] };
}
function positive(value: unknown, fallback: number, max: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? Math.min(value, max) : fallback;
}
export const ARTICLE_LIST_LIMIT = 12;
export function normalizeArticlePagination({ page: inputPage = 1, limit: inputLimit = ARTICLE_LIST_LIMIT }: { page?: number; limit?: number } = {}) {
  const limit = positive(inputLimit, ARTICLE_LIST_LIMIT, 24);
  // Match the article-only gateway window; page boundaries depend on query size.
  const maxPage = Math.floor(1_000_000 / limit) + 1;
  return { page: positive(inputPage, 1, maxPage), limit, maxPage };
}
function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

// Explicit preview data, unrelated to the three company drafts. Never a live fallback.
const demonstration: Record<string, unknown>[] = [{
  id: "demonstration", status: "published", slug: "demonstration", title: "Демонстрационный материал", excerpt: "Пример оформления раздела статей. Этот материал не является рекомендацией или утверждённой публикацией компании.", published_at: "2020-01-01T12:00:00.000Z", author: null,
  content: '<p>Синтетический материал показывает оформление текста, списков и таблиц.</p><h2>Структура материала</h2><p>Краткое вступление помогает понять тему. Основной текст разделён на понятные части.</p><h2>Читаемые списки</h2><ul><li>Короткий пункт.</li><li>Пункт с пояснением.</li></ul><h2>Пример таблицы</h2><table><thead><tr><th>Поле</th><th>Пример</th></tr></thead><tbody><tr><td>Название</td><td>Демонстрационные данные</td></tr><tr><td>Количество</td><td>1</td></tr></tbody></table><h2>Завершение</h2><p>Материал подготовлен только для проверки интерфейса. Здесь нет сведений об услугах, опыте или технических рекомендаций компании.</p>',
}, { id: "draft", status: "draft", slug: "demonstration-draft", title: "Синтетический черновик", published_at: "2020-01-01T12:00:00.000Z" }, { id: "future", status: "published", slug: "demonstration-future", title: "Синтетическая будущая публикация", published_at: "2999-01-01T12:00:00.000Z" }];
function mockRows() { return process.env.STOREFRONT_MOCK_MODE === "true" ? demonstration : []; }

export async function getPublishedArticles(query: { page?: number; limit?: number } = {}): Promise<{ items: ArticleSummary[]; total: number; page: number; limit: number }> {
  const { page, limit } = normalizeArticlePagination(query);
  const empty = { items: [] as ArticleSummary[], total: 0, page, limit };
  if (isMockMode()) {
    const all = mockRows().map(mapSummary).filter((row): row is ArticleSummary => Boolean(row));
    return { items: all.slice((page - 1) * limit, page * limit), total: all.length, page, limit };
  }
  try {
    const params = new URLSearchParams({ fields: summaryFields, sort: "-published_at,slug", page: String(page), limit: String(limit), meta: "filter_count", filter: JSON.stringify(filter()) });
    const result = await directusFetch<{ data: unknown; meta?: { filter_count?: unknown } }>(`/items/articles?${params}`, { revalidate: 0 });
    if (!Array.isArray(result.data) || result.data.length > limit) return empty;
    const items = records(result.data).slice(0, limit).map(mapSummary).filter((row): row is ArticleSummary => Boolean(row));
    const count = result.meta?.filter_count;
    const total = items.length === result.data.length && typeof count === "number" && Number.isSafeInteger(count) && count >= 0 ? count : items.length;
    return { items, total, page, limit };
  } catch { return empty; }
}

export async function getPublishedArticle(slug: string): Promise<Article | null> {
  if (!isArticleSlug(slug)) return null;
  if (isMockMode()) return mockRows().filter(row => row.slug === slug).map(mapArticle).find(Boolean) ?? null;
  try {
    const params = new URLSearchParams({ fields: detailFields, sort: "slug", limit: "1", filter: JSON.stringify(filter(slug)) });
    const result = await directusFetch<{ data: unknown }>(`/items/articles?${params}`, { revalidate: 0 });
    const row = records(result.data).find(item => item.slug === slug);
    return row ? mapArticle(row) : null;
  } catch { return null; }
}

export async function getArticlesForSitemap(): Promise<Array<{ slug: string; published_at: string }>> {
  if (isMockMode()) return mockRows().map(mapSummary).filter((row): row is ArticleSummary => Boolean(row)).map(({ slug, published_at }) => ({ slug, published_at }));
  try {
    // 500 is the query bound, not a collection bound. Leave room for the existing
    // static URLs under the sitemap protocol's 50,000-URL limit. A larger collection
    // needs dedicated article sitemap chunks; fail closed rather than emit partial XML.
    const entries = new Map<string, { slug: string; published_at: string }>();
    const publicationFilter = JSON.stringify(filter());
    for (let page = 1; page <= 100; page++) {
      // Keep status to validate publication even after an upstream regression.
      const params = new URLSearchParams({ fields: "status,slug,published_at", sort: "slug", limit: "500", page: String(page), filter: publicationFilter });
      const result = await directusFetch<{ data: unknown }>(`/items/articles?${params}`, { revalidate: 0 });
      if (!Array.isArray(result.data) || result.data.length > 500) return [];
      const pageRows = records(result.data);
      if (pageRows.length !== result.data.length) return [];
      const before = entries.size;
      for (const row of pageRows) {
        const published_at = publicationDate(row.published_at);
        if (row.status === "published" && isArticleSlug(row.slug) && published_at && !entries.has(row.slug)) entries.set(row.slug, { slug: row.slug, published_at });
      }
      if (entries.size > 48_000) return [];
      if (pageRows.length < 500) return [...entries.values()];
      if (entries.size === before) return []; // Repeated pages or wholly invalid upstream data.
    }
    return [];
  } catch { return []; }
}

export async function getArticleRelatedLinks(article: Article): Promise<Array<{ title: string; href: string }>> {
  if (isMockMode()) return [];
  const read = async (collection: "categories" | "products", identifier: string) => {
    try {
      const terms: Record<string, unknown>[] = [{ status: { _eq: "published" } }, { [isValidAssetId(identifier) ? "id" : "slug"]: { _eq: identifier } }];
      if (collection === "products") terms.push({ _or: [{ category: { _null: true } }, { category: { status: { _eq: "published" } } }] });
      const params = new URLSearchParams({ fields: "id,slug,title", limit: "1", sort: collection === "categories" ? "sort_order,title" : "title", filter: JSON.stringify({ _and: terms }) });
      const result = await directusFetch<{ data: unknown }>(`/items/${collection}?${params}`, { revalidate: 0 });
      const row = records(result.data)[0];
      const title = text(row?.title, 500);
      if (!row || !title || !isArticleSlug(row.slug) || (row.id !== identifier && row.slug !== identifier)) return null;
      return { title, href: `/${collection === "categories" ? "category" : "product"}/${encodeURIComponent(row.slug)}` };
    } catch { return null; }
  };
  const links = await Promise.all([...article.related_categories.map(id => read("categories", id)), ...article.related_products.map(id => read("products", id))]);
  return links.filter((link): link is { title: string; href: string } => link !== null).filter((link, index, all) => all.findIndex(other => other.href === link.href) === index);
}
