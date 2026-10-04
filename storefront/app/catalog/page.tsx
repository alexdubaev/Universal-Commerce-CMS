import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { SearchBox } from "@/components/SearchBox";
import { brands, getProducts } from "@/lib/catalog";

type Props = {
  searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
};

export default async function CatalogPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const result = await getProducts({ q: params.q, brand: params.brand, page, limit: 12 });
  const maxPage = Math.max(1, Math.ceil(result.total / result.limit));

  return (
    <div className="shell page-shell">
      <div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>Каталог</span></div>
      <div className="catalog-head">
        <div>
          <span className="eyebrow">100 000 ready</span>
          <h1>Каталог запчастей</h1>
          <p>Поиск по артикулам и OEM-кодам уже совместим с текущим commerce API.</p>
        </div>
        <SearchBox compact initial={params.q ?? ""} />
      </div>

      <div className="catalog-layout">
        <aside className="filters panel">
          <details open>
            <summary>Бренд</summary>
            <div className="filter-links">
              <Link className={!params.brand ? "active" : ""} href={params.q ? `/catalog?q=${encodeURIComponent(params.q)}` : "/catalog"}>Все бренды</Link>
              {brands.map((brand) => (
                <Link
                  className={params.brand === brand.slug ? "active" : ""}
                  href={`/catalog?brand=${brand.slug}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}
                  key={brand.slug}
                >
                  {brand.name}
                </Link>
              ))}
            </div>
          </details>
          <details open>
            <summary>Статус</summary>
            <label className="check"><input type="checkbox" disabled /> В наличии</label>
            <label className="check"><input type="checkbox" disabled /> Под заказ</label>
            <small className="filter-note">UI подготовлен; серверные facet-фильтры подключаются следующим этапом.</small>
          </details>
          <details>
            <summary>Тип запчасти</summary>
            <label className="check"><input type="checkbox" disabled /> Оригинал</label>
            <label className="check"><input type="checkbox" disabled /> OEM</label>
            <label className="check"><input type="checkbox" disabled /> Аналог</label>
          </details>
        </aside>

        <section className="catalog-content">
          <div className="catalog-toolbar">
            <span>Найдено: <strong>{result.total}</strong></span>
            <span className="source-badge">{result.source === "directus" ? "Directus" : "Mock data"}</span>
          </div>

          {result.items.length ? (
            <div className="product-grid catalog-grid">
              {result.items.map((product) => <ProductCard product={product} key={product.id} />)}
            </div>
          ) : (
            <div className="panel empty-state">
              <h2>Ничего не найдено</h2>
              <p>Проверьте артикул или отправьте список менеджеру.</p>
              <Link className="button primary" href="/request">Отправить заявку</Link>
            </div>
          )}

          {maxPage > 1 && (
            <nav className="pagination" aria-label="Пагинация">
              {Array.from({ length: Math.min(maxPage, 7) }, (_, index) => index + 1).map((number) => (
                <Link
                  className={number === page ? "active" : ""}
                  key={number}
                  href={`/catalog?page=${number}${params.brand ? `&brand=${params.brand}` : ""}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}
                >
                  {number}
                </Link>
              ))}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
