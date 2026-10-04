import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";
import { ProductCard } from "@/components/ProductCard";
import { brands, getProducts } from "@/lib/catalog";

export default async function HomePage() {
  const products = await getProducts({ limit: 8 });

  return (
    <>
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy reveal">
            <span className="eyebrow">Запчасти для спецтехники · B2B</span>
            <h1>Движение вашего бизнеса <em>зависит от деталей</em></h1>
            <p>Ищите по артикулу, OEM-номеру, бренду или названию. Оригинальные запчасти и проверенные аналоги.</p>
            <SearchBox />
            <div className="search-example">Например: 1R-1808, RE568158, DZ121294, 320/04542</div>
          </div>

          <div className="hero-visual reveal delay-1" aria-label="Спецтехника">
            <div className="machine-stage">
              <span className="machine-kicker">HEAVY DUTY</span>
              <strong>PARTS</strong>
              <div className="machine-line" />
              <p>CAT · KOMATSU · JCB</p>
            </div>
          </div>
        </div>

        <div className="shell hero-benefits">
          <div><span>◆</span><strong>30 000+</strong><small>позиций в демонстрационном каталоге</small></div>
          <div><span>▣</span><strong>По всей России</strong><small>доставка транспортными компаниями</small></div>
          <div><span>◇</span><strong>6 месяцев</strong><small>демо-условие гарантии</small></div>
          <div><span>◎</span><strong>Только B2B</strong><small>счёт, НДС и документы</small></div>
        </div>
      </section>

      <section className="brand-strip" id="brands">
        <div className="shell">
          <div className="brand-list">
            {brands.map((brand) => (
              <Link href={`/brand/${brand.slug}`} key={brand.slug}>{brand.name}</Link>
            ))}
            <Link className="all-brands" href="/catalog">Все товары →</Link>
          </div>
        </div>
      </section>

      <section className="section shell">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Каталог</span>
            <h2>Популярные позиции</h2>
          </div>
          <Link href="/catalog">Открыть весь каталог →</Link>
        </div>
        <div className="product-grid">
          {products.items.map((product) => <ProductCard product={product} key={product.id} />)}
        </div>
      </section>

      <section className="section shell service-grid">
        <article className="service-card large">
          <span className="eyebrow">Заявка по списку</span>
          <h2>Не ищите позиции по одной</h2>
          <p>Соберите товары в заявку или передайте менеджеру список артикулов. Интерфейс уже подготовлен к подключению Directus lead API.</p>
          <Link className="button primary" href="/request">Собрать заявку</Link>
        </article>
        <article className="service-card">
          <span className="service-icon">⌁</span>
          <h3>Поиск по артикулу</h3>
          <p>Используется нормализованный SKU/OEM-поиск существующего commerce API.</p>
        </article>
        <article className="service-card">
          <span className="service-icon">↔</span>
          <h3>Оригиналы и аналоги</h3>
          <p>CMS уже содержит product_codes и typed products_analogs.</p>
        </article>
      </section>
    </>
  );
}
