import { createServer } from "node:http";
import { once } from "node:events";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const cover = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const privateImage = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let rows: Row[] = [];
let unavailable = false;
let ignoreFilter = false;
let ignorePaging = false;
let catalogRows: Record<string, Row[]> = {};
let useActualGateway = false;
let virtualArticleTotal = 0;
type GatewayResponse = { status: (code: number) => GatewayResponse; set: (headers: Record<string, string>) => GatewayResponse; json: (body: unknown) => GatewayResponse };
let actualGatewayHandler: (request: Row, response: GatewayResponse) => Promise<unknown>;
const requests: URL[] = [];
function matches(row: unknown, filter: unknown): boolean {
  if (!filter || typeof filter !== "object") return true;
  return Object.entries(filter).every(([key, term]) => {
    if (key === "_and") return (term as unknown[]).every(value => matches(row, value));
    if (key === "_or") return (term as unknown[]).some(value => matches(row, value));
    if (key === "_eq") return row === term;
    if (key === "_null") return (row == null) === term;
    if (key === "_nnull") return (row != null) === term;
    if (key === "_lte") return typeof row === "string" && Number.isFinite(Date.parse(row)) && new Date(row).toISOString() === row && Date.parse(row) <= Date.parse(String(term));
    return matches((row as Row)?.[key], term);
  });
}
const server = createServer((request, response) => {
  const url = new URL(request.url!, "http://synthetic.invalid");
  requests.push(url);
  response.setHeader("content-type", "application/json");
  if (unavailable) { response.statusCode = 503; return response.end(JSON.stringify({ errors: [{ message: "private upstream diagnostic" }] })); }
  const collection = /\/items\/([a-z_]+)$/.exec(url.pathname)?.[1];
  if (useActualGateway) {
    const reply: GatewayResponse = {
      status(code) { response.statusCode = code; return this; },
      set(headers) { for (const [key, value] of Object.entries(headers)) response.setHeader(key, value); return this; },
      json(body) { response.end(JSON.stringify(body)); return this; },
    };
    void actualGatewayHandler({ accountability: { user: "12345678-1234-1234-1234-123456789abc", admin: false }, params: { collection }, query: Object.fromEntries(url.searchParams) }, reply).catch(() => reply.status(500).json({ error: "Fixture gateway failure" }));
    return;
  }
  const source = collection === "articles" ? rows : catalogRows[collection ?? ""] ?? [];
  const filtered = ignoreFilter ? source : source.filter(row => matches(row, JSON.parse(url.searchParams.get("filter") ?? "{}")));
  const sorted = [...filtered].sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)) || String(a.slug).localeCompare(String(b.slug)));
  const limit = Number(url.searchParams.get("limit"));
  const start = ignorePaging ? 0 : (Number(url.searchParams.get("page") ?? 1) - 1) * limit;
  const fields = (url.searchParams.get("fields") ?? "").split(",");
  response.end(JSON.stringify({ data: sorted.slice(start, start + limit).map(row => Object.fromEntries(fields.filter(field => field in row).map(field => [field, row[field]]))), meta: { filter_count: filtered.length } }));
});
let articles: typeof import("../lib/articles");
let renderer: typeof import("../components/articles/ArticleContent");

beforeAll(async () => {
  // Exercise the real gateway request contract, with an in-memory virtual dataset
  // so the 1M offset boundary needs no database or million-row fixture allocation.
  const gatewaySource = new URL("../../directus/extensions/commerce-api/src/storefront.mjs", import.meta.url).href;
  const { registerStorefrontGateway } = await import(gatewaySource);
  class ItemsService {
    async readByQuery(query: { aggregate?: unknown; fields?: string[]; page?: number; limit: number; filter?: unknown }) {
      if (query.aggregate) return [{ count: { id: virtualArticleTotal } }];
      const start = ((query.page ?? 1) - 1) * query.limit;
      return Array.from({ length: Math.max(0, Math.min(query.limit, virtualArticleTotal - start)) }, (_, index) => ({ id: `article-${start + index}`, slug: `article-${start + index}`, status: "published", title: `Синтетическая статья ${start + index}`, published_at: "2020-01-01T12:00:00.000Z" })).filter(row => matches(row, query.filter)).map(row => Object.fromEntries((query.fields ?? []).filter(field => field in row).map(field => [field, (row as Row)[field]])));
    }
  }
  registerStorefrontGateway({ get(path: string, handler: typeof actualGatewayHandler) { if (path === "/storefront/items/:collection") actualGatewayHandler = handler; }, post() {} }, { env: { COMMERCE_STOREFRONT_ENABLED: "true", COMMERCE_STOREFRONT_USER_ID: "12345678-1234-1234-1234-123456789abc", COMMERCE_STOREFRONT_PUBLIC_FOLDER_ID: cover }, services: { ItemsService, AssetsService: class {} }, getSchema: async () => ({ collections: { articles: { primary: "id" } } }), database: {} });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); if (!address || typeof address === "string") throw new Error("No fixture port");
  vi.stubEnv("DIRECTUS_URL", `http://127.0.0.1:${address.port}`);
  vi.stubEnv("STOREFRONT_MOCK_MODE", "false"); vi.stubEnv("STOREFRONT_ALLOW_MOCK_FALLBACK", "true");
  vi.stubEnv("STOREFRONT_DIRECTUS_GATEWAY", "true"); vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://synthetic.example");
  vi.resetModules();
  [articles, renderer] = await Promise.all([import("../lib/articles"), import("../components/articles/ArticleContent")]);
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); vi.unstubAllEnvs(); vi.resetModules(); });
beforeEach(() => {
  unavailable = false; ignoreFilter = false; ignorePaging = false; requests.length = 0;
  catalogRows = {}; useActualGateway = false; virtualArticleTotal = 0;
  const published = { id: "one", status: "published", slug: "one", title: "Первый материал", excerpt: "Краткий анонс", content: "<h2>Один</h2><p>Текст</p>", published_at: "2020-01-02T12:00:00.000Z", cover_image: cover, image_alt: "Содержательная иллюстрация", author: "Указанный автор" };
  rows = [published, { ...published, id: "two", slug: "two", title: "Второй материал", published_at: "2020-01-01T12:00:00.000Z" }, { ...published, id: "draft", slug: "draft", status: "draft" }, { ...published, id: "future", slug: "future", published_at: "2999-01-01T12:00:00.000Z" }, { ...published, id: "invalid", slug: "invalid", published_at: "2020-02-30T12:00:00.000Z" }];
});

describe("published article routes over a synthetic HTTP service", () => {
  it("paginates published materials and uses explicit bounded queries", async () => {
    const first = await articles.getPublishedArticles({ limit: 1 });
    const next = await articles.getPublishedArticles({ page: 2, limit: 1 });
    expect(first.items.map(row => row.slug)).toEqual(["one"]);
    expect(next.items.map(row => row.slug)).toEqual(["two"]);
    const result = await articles.getPublishedArticles({ limit: 999 });
    expect(result.limit).toBe(24);
    expect(result.items.map(row => row.slug)).toEqual(["one", "two"]);
    expect(requests.every(url => !url.searchParams.get("fields")?.includes("*"))).toBe(true);
  });
  it("rejects private, malformed and future rows even if upstream ignores filters", async () => {
    ignoreFilter = true;
    const list = await articles.getPublishedArticles();
    expect(list.items.map(row => row.slug)).toEqual(["one", "two"]);
    expect(list.total).toBe(2);
    expect(await articles.getPublishedArticle("draft")).toBeNull();
    expect(await articles.getPublishedArticle("future")).toBeNull();
    expect(await articles.getPublishedArticle("../one")).toBeNull();
    expect((await articles.getArticlesForSitemap()).map(row => row.slug)).toEqual(["one", "two"]);
  });
  it("renders the list, safe detail metadata and published-only sitemap with persistent dates", async () => {
    const { default: List } = await import("../app/articles/page");
    const html = renderToStaticMarkup(await List({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('href="/articles/one"'); expect(html).not.toContain('/articles/draft');
    const { default: Detail, generateMetadata } = await import("../app/articles/[slug]/page");
    const props = { params: Promise.resolve({ slug: "one" }) };
    expect(await generateMetadata(props)).toMatchObject({ title: "Первый материал", description: "Краткий анонс", alternates: { canonical: "https://synthetic.example/articles/one" }, openGraph: { type: "article", publishedTime: "2020-01-02T12:00:00.000Z", url: "https://synthetic.example/articles/one" } });
    const detail = renderToStaticMarkup(await Detail(props));
    expect(detail.match(/<h1[ >]/g)).toHaveLength(1); expect(detail).toContain('"datePublished":"2020-01-02T12:00:00.000Z"'); expect(detail).not.toContain('dateModified');
    const { GET } = await import("../app/sitemaps/[name]/route");
    const map = await GET(new Request("https://synthetic.example/sitemaps/static.xml"), { params: Promise.resolve({ name: "static.xml" }) });
    const xml = await map.text(); expect(xml).toContain('/articles/one</loc>'); expect(xml).not.toContain('/articles/draft'); expect(xml).not.toContain('/articles/future');
    expect(map.headers.get("cache-control")).toBe("no-store");
  });
  it("fails closed on live errors even when catalog fallback is enabled and hides empty home section", async () => {
    unavailable = true;
    expect(await articles.getPublishedArticle("one")).toBeNull();
    expect((await articles.getPublishedArticles()).items).toEqual([]);
    expect(await articles.getArticlesForSitemap()).toEqual([]);
    const { ArticlesSection } = await import("../components/articles/ArticlesSection");
    expect(await ArticlesSection()).toBeNull();
    const { default: List } = await import("../app/articles/page");
    expect(renderToStaticMarkup(await List({ searchParams: Promise.resolve({}) }))).toContain("Опубликованных материалов пока нет");
  });
  it("rechecks publication on subsequent reads and resolves only known public catalog links", async () => {
    rows[0].related_categories = ["known-category", "missing", { slug: "javascript:alert(1)" }];
    rows[0].related_products = ["known-product", "draft-product"];
    catalogRows = { categories: [{ id: "known-category", slug: "known-category", title: "Категория", status: "published" }], products: [{ id: "known-product", slug: "known-product", title: "Товар", status: "published", category: { status: "published" } }, { id: "draft-product", slug: "draft-product", title: "Черновик товара", status: "draft" }] };
    const article = await articles.getPublishedArticle("one");
    expect(article).not.toBeNull();
    expect(await articles.getArticleRelatedLinks(article!)).toEqual([{ title: "Категория", href: "/category/known-category" }, { title: "Товар", href: "/product/known-product" }]);
    rows[0].status = "draft";
    expect(await articles.getPublishedArticle("one")).toBeNull();
    expect((await articles.getArticlesForSitemap()).map(row => row.slug)).toEqual(["two"]);
  });
  it("includes publications beyond the first 500 and fails closed if upstream pagination does not progress", async () => {
    rows = Array.from({ length: 501 }, (_, index) => ({ ...rows[0], id: `article-${index}`, slug: `article-${String(index).padStart(4, "0")}` }));
    const all = await articles.getArticlesForSitemap();
    expect(all).toHaveLength(501);
    expect(new Set(all.map(row => row.slug)).size).toBe(501);
    expect(all.some(row => row.slug === "article-0500")).toBe(true);
    ignorePaging = true;
    expect(await articles.getArticlesForSitemap()).toEqual([]);
  });
  it("keeps list links, metadata and adapter pages within the real gateway's bounded article window", async () => {
    useActualGateway = true; virtualArticleTotal = 12_001;
    const { default: List, generateMetadata } = await import("../app/articles/page");
    const first = renderToStaticMarkup(await List({ searchParams: Promise.resolve({ page: "1000" }) }));
    expect(first).toContain('href="/articles?page=1001"');
    const next = await articles.getPublishedArticles({ page: 1001, limit: 12 });
    expect(next.items.map(row => row.id)).toEqual(["article-12000"]);
    const following = renderToStaticMarkup(await List({ searchParams: Promise.resolve({ page: "1001" }) }));
    expect(following).toContain('href="/articles/article-12000"');
    expect(following).not.toContain('rel="next"');
    virtualArticleTotal = 1_000_020;
    const oversized = await articles.getPublishedArticles({ page: 9_999_999, limit: 12 });
    expect(oversized.page).toBe(83_334);
    expect(oversized.items[0]?.id).toBe("article-999996");
    const last = renderToStaticMarkup(await List({ searchParams: Promise.resolve({ page: "9999999" }) }));
    expect(last).toContain('href="/articles/article-999996"');
    expect(last).not.toContain('rel="next"');
    expect(await generateMetadata({ searchParams: Promise.resolve({ page: "9999999" }) })).toMatchObject({ alternates: { canonical: "https://synthetic.example/articles?page=83334" } });
    const last24 = await articles.getPublishedArticles({ page: 9_999_999, limit: 24 });
    expect(last24.page).toBe(41_667);
    expect(last24.items[0]?.id).toBe("article-999984");
  });
});

describe("allowlisted article HTML rendered through React", () => {
  it("preserves readable entities, stable TOC, lists/tables and drops executable elements/attributes/URLs", () => {
    const html = '<h1>Вложенный заголовок</h1><h2 id="evil">Раздел &amp; данные</h2><h2>Раздел &amp; данные</h2><h2>Итог</h2><p onclick="alert(1)">Текст &lt;script&gt; <a href="jav&#x61;script:alert(1)">ссылка</a></p><script>alert(1)</script><style>body{display:none}</style><svg><a href="javascript:alert(2)">bad</a></svg><ul><li>Пункт</li></ul><table><tr><th>Номер</th><td>1</td></tr></table><img src="/assets/' + cover + '" alt="Деталь" onerror="alert(1)"><img src="/api/assets/' + privateImage + '"><img src="https://tracker.invalid/pixel"><a href="//evil.invalid">bad</a>';
    const parsed = renderer.prepareArticleContent(html, [cover]);
    const output = renderToStaticMarkup(createElement(renderer.ArticleContent, { prepared: parsed }));
    expect(output).not.toMatch(/<h1|<script|<style|<svg|onclick|onerror|javascript:|tracker.invalid|evil.invalid/);
    expect(output).toContain('Раздел &amp; данные'); expect(output).toContain('<table>'); expect(output).toContain('<li>Пункт</li>');
    expect(output).toContain(`/api/assets/${cover}`); expect(output).not.toContain(privateImage);
    expect(parsed.headings.map(row => row.id)).toEqual(['section-1', 'section-2', 'section-3', 'section-4']);
    expect(renderer.prepareArticleContent(html, [cover]).headings).toEqual(parsed.headings);
  });
  it("handles malformed unknown HTML as escaped text and bounds untrusted input", () => {
    const parsed = renderer.prepareArticleContent('<unknown><p>safe &quot;text&quot;<b>bold</unknown><iframe src="https://evil.invalid"><p>private</iframe><a href="/catalog">Каталог</a>', []);
    const output = renderToStaticMarkup(createElement(renderer.ArticleContent, { prepared: parsed }));
    expect(output).toContain('safe'); expect(output).toContain('href="/catalog"'); expect(output).not.toContain('iframe'); expect(output).not.toContain('private');
    const tooLarge = renderer.prepareArticleContent('x'.repeat(250_001), []);
    expect(tooLarge.truncated).toBe(true);
    expect(renderToStaticMarkup(createElement(renderer.ArticleContent, { prepared: tooLarge })).length).toBeLessThan(251_000);
    const tooDeep = renderer.prepareArticleContent('<div>'.repeat(100) + '<p>deep</p>' + '</div>'.repeat(100), []);
    expect(tooDeep.truncated).toBe(true);
    expect(renderToStaticMarkup(createElement(renderer.ArticleContent, { prepared: tooDeep }))).not.toContain('deep');
    const tooMany = renderer.prepareArticleContent('<p>item</p>'.repeat(6_000), []);
    expect(tooMany.truncated).toBe(true);
    expect(renderToStaticMarkup(createElement(renderer.ArticleContent, { prepared: tooMany })).match(/<p>/g)!.length).toBeLessThan(5_001);
  });
});
