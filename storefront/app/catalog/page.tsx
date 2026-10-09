import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { ResponsiveFilters } from "@/components/ResponsiveFilters";
import { getBrands, getCategories, getProducts } from "@/lib/catalog";
import type { Availability, PartType, SortOption } from "@/lib/types";

export const metadata: Metadata = {
  title: "Каталог запчастей",
  description: "Мультибрендовый B2B-каталог запчастей для спецтехники с поиском по артикулу и OEM-коду.",
  alternates: { canonical: "/catalog" },
};

type SearchParams = {
  q?: string;
  brand?: string;
  category?: string;
  availability?: Availability;
  partType?: PartType;
  sort?: SortOption;
  page?: string;
};

type Props = { searchParams: Promise<SearchParams> };

function href(params: SearchParams, patch: Partial<SearchParams>) {
  const next = { ...params, ...patch };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value && key !== "page") query.set(key, String(value));
  }
  if (patch.page) query.set("page", patch.page);
  const value = query.toString();
  return value ? `/catalog?${value}` : "/catalog";
}

function pages(current: number, max: number) {
  if (max <= 7) return Array.from({ length: max }, (_, index) => index + 1);
  const candidates = new Set([1, max, current - 2, current - 1, current, current + 1, current + 2]);
  return [...candidates].filter((value) => value >= 1 && value <= max).sort((a, b) => a - b);
}

export default async function CatalogPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const [brandList, categories, result] = await Promise.all([
    getBrands(),
    getCategories(),
    getProducts({
      q: params.q,
      brand: params.brand,
      category: params.category,
      availability: params.availability,
      partType: params.partType,
      sort: params.sort,
      page,
      limit: 12,
    }),
  ]);
  const maxPage = Math.max(1, Math.ceil(result.total / result.limit));
  const pageItems = pages(page, maxPage);

  return (
    <div className="shell page-shell">
      <div className="breadcrumbs catalog-breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>Каталог</span></div>
      <div className="catalog-layout">
        <div className="catalog-heading-row">
        <div className="catalog-head">
          <h1>Каталог запчастей</h1>
          <p>Артикулы, OEM-коды, бренды, категории, наличие и тип запчасти.</p>
        </div>
        <div className="catalog-controls">
          {(params.q || params.brand || params.category || params.availability || params.partType) && <div className="active-filters" aria-label="Активные фильтры">
            {params.q && <Link href={href(params, { q: undefined, page: undefined })}>Поиск: {params.q} <b aria-hidden="true">×</b></Link>}
            {params.brand && <Link href={href(params, { brand: undefined, page: undefined })}>Бренд: {brandList.find((item) => item.slug === params.brand)?.name ?? params.brand} <b aria-hidden="true">×</b></Link>}
            {params.category && <Link href={href(params, { category: undefined, page: undefined })}>Категория: {categories.find((item) => item.slug === params.category)?.title ?? params.category} <b aria-hidden="true">×</b></Link>}
            {params.availability && <Link href={href(params, { availability: undefined, page: undefined })}>Наличие: {params.availability === "in_stock" ? "В наличии" : params.availability === "out_of_stock" ? "Нет в наличии" : "Под заказ"} <b aria-hidden="true">×</b></Link>}
            {params.partType && <Link href={href(params, { partType: undefined, page: undefined })}>Тип: {params.partType === "original" ? "Оригинал" : params.partType === "analog" ? "Аналог" : "OEM"} <b aria-hidden="true">×</b></Link>}
            <Link className="active-filters-reset" href="/catalog">Сбросить все</Link>
          </div>}
          <div className="catalog-toolbar">
            <span>Найдено: <strong>{result.total}</strong></span>
            <div className="catalog-toolbar-right">
              <form action="/catalog" method="get">
                {params.q && <input type="hidden" name="q" value={params.q} />}
                {params.brand && <input type="hidden" name="brand" value={params.brand} />}
                {params.category && <input type="hidden" name="category" value={params.category} />}
                {params.availability && <input type="hidden" name="availability" value={params.availability} />}
                {params.partType && <input type="hidden" name="partType" value={params.partType} />}
                <select name="sort" defaultValue={params.sort ?? "popular"} aria-label="Сортировка">
                  <option value="popular">По умолчанию</option>
                  <option value="price_asc">Сначала дешевле</option>
                  <option value="price_desc">Сначала дороже</option>
                  <option value="title">По названию</option>
                </select>
                <button className="sort-apply" type="submit">Применить</button>
              </form>
            </div>
          </div>

        </div>
        </div>
        <ResponsiveFilters>
        <summary>Фильтры и подбор</summary>
        <aside className="filters panel">
          <details open>
            <summary>Категории</summary>
            <div className="filter-links">
              <Link className={!params.category ? "active" : ""} href={href(params, { category: undefined, page: undefined })}>Все категории</Link>
              {categories.map((category) => <Link className={params.category === category.slug ? "active" : ""} href={href(params, { category: category.slug, page: undefined })} key={category.slug}>{category.title}</Link>)}
            </div>
          </details>

          <details open>
            <summary>Бренд</summary>
            <div className="filter-links">
              <Link className={!params.brand ? "active" : ""} href={href(params, { brand: undefined, page: undefined })}>Все бренды</Link>
              {brandList.map((brand) => (
                <Link
                  className={params.brand === brand.slug ? "active" : ""}
                  href={href(params, { brand: brand.slug, page: undefined })}
                  key={brand.slug}
                >
                  {brand.name}
                </Link>
              ))}
            </div>
          </details>

          <form className="facet-form" action="/catalog" method="get">
            {params.q && <input type="hidden" name="q" value={params.q} />}
            {params.brand && <input type="hidden" name="brand" value={params.brand} />}
            {params.category && <input type="hidden" name="category" value={params.category} />}
            {params.sort && <input type="hidden" name="sort" value={params.sort} />}

            <label>
              Наличие
              <select name="availability" defaultValue={params.availability ?? ""}>
                <option value="">Любое</option>
                <option value="in_stock">В наличии</option>
                <option value="on_request">Под заказ</option>
                <option value="out_of_stock">Нет в наличии</option>
              </select>
            </label>

            <label>
              Тип запчасти
              <select name="partType" defaultValue={params.partType ?? ""}>
                <option value="">Любой</option>
                <option value="original">Оригинал</option>
                <option value="oem">OEM</option>
                <option value="analog">Аналог</option>
              </select>
            </label>

            <button className="button secondary wide" type="submit">Применить фильтры</button>
            {(params.q || params.brand || params.category || params.availability || params.partType || params.sort) && <Link className="reset-filters" href="/catalog">Сбросить все фильтры</Link>}
          </form>
        </aside>
        </ResponsiveFilters>

        <section className="catalog-content">
          {result.items.length ? (
            <div className="product-grid catalog-grid">
              {result.items.map((product) => <ProductCard product={product} key={product.id} />)}
            </div>
          ) : (
            <div className="panel empty-state">
              <h2>Ничего не найдено</h2>
              <p>Проверьте артикул или измените фильтры. Вы также можете передать артикул для подбора в заявке.</p>
              <Link className="button primary" href={`/request?import=1${params.q ? `&article=${encodeURIComponent(params.q)}` : ""}`}>{params.q ? "Передать артикул для подбора" : "Передать список для подбора"}</Link>
            </div>
          )}

          {maxPage > 1 && (
            <nav className="pagination" aria-label="Пагинация">
              {page > 1 && <Link aria-label="Предыдущая страница" href={href(params, { page: String(page - 1) })}>←</Link>}
              {pageItems.map((number, index) => (
                <span className="pagination-slot" key={number}>
                  {index > 0 && pageItems[index - 1] !== number - 1 && <span className="ellipsis">…</span>}
                  <Link className={number === page ? "active" : ""} aria-current={number === page ? "page" : undefined} href={href(params, { page: String(number) })}>{number}</Link>
                </span>
              ))}
              {page < maxPage && <Link aria-label="Следующая страница" href={href(params, { page: String(page + 1) })}>→</Link>}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
