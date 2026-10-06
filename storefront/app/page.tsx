import type { Metadata } from "next";
import Link from "next/link";
import { CmsSections } from "@/components/CmsPageRenderer";
import { ProductCard } from "@/components/ProductCard";
import { SearchBox } from "@/components/SearchBox";
import { brands, getCategories, getProducts } from "@/lib/catalog";
import { getCmsHome, safeContentHref } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const home = await getCmsHome();
  if (!home) return {};
  return {
    title: home.seo_title || home.h1 || home.hero_title || undefined,
    description: home.seo_description || home.hero_text || undefined,
    alternates: { canonical: home.canonical_url || "/" },
    robots: home.is_indexable === false ? { index: false, follow: true } : undefined,
    openGraph: {
      title: home.seo_title || home.h1 || home.hero_title || undefined,
      description: home.seo_description || home.hero_text || undefined,
      images: home.hero_image ? [{ url: `/api/assets/${home.hero_image}` }] : undefined,
    },
  };
}

export default async function HomePage() {
  const [products, categories, home] = await Promise.all([
    getProducts({ limit: 8 }),
    getCategories(),
    getCmsHome(),
  ]);

  const primaryHref = safeContentHref(home?.hero_primary_button_url);
  const secondaryHref = safeContentHref(home?.hero_secondary_button_url);
  const heroTitle = home?.hero_title || "Движение вашего бизнеса зависит от деталей";
  const heroText = home?.hero_text || "Ищите по артикулу, OEM-номеру, бренду или названию. Оригинальные запчасти и проверенные аналоги.";

  return (
    <>
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy reveal">
            <span className="eyebrow">{home?.hero_search_label || "Запчасти для спецтехники · B2B"}</span>
            {home ? (
              <h1>{heroTitle}</h1>
            ) : (
              <h1>Движение вашего бизнеса <em>зависит от деталей</em></h1>
            )}
            <p>{heroText}</p>
            <SearchBox
              placeholder={home?.hero_search_placeholder || "Введите артикул, OEM, название или бренд"}
              buttonLabel={home?.hero_search_button_text || "Найти"}
            />
            <div className="search-example">Например: 1R-1808, RE568158, DZ121294, 320/04542</div>

            {(primaryHref || secondaryHref) && (
              <div className="hero-cms-actions">
                {primaryHref && home?.hero_primary_button_text && (
                  primaryHref.startsWith("/")
                    ? <Link className="button primary" href={primaryHref}>{home.hero_primary_button_text}</Link>
                    : <a className="button primary" href={primaryHref} target="_blank" rel="noreferrer">{home.hero_primary_button_text}</a>
                )}
                {secondaryHref && home?.hero_secondary_button_text && (
                  secondaryHref.startsWith("/")
                    ? <Link className="button secondary" href={secondaryHref}>{home.hero_secondary_button_text}</Link>
                    : <a className="button secondary" href={secondaryHref} target="_blank" rel="noreferrer">{home.hero_secondary_button_text}</a>
                )}
              </div>
            )}
          </div>

          <div className="hero-visual reveal delay-1" aria-label={home?.hero_image_alt || "Спецтехника"}>
            <div className={home?.hero_image ? "machine-stage has-image" : "machine-stage"}>
              {home?.hero_image && <img className="machine-image" src={`/api/assets/${home.hero_image}`} alt={home.hero_image_alt || ""} />}
              <span className="machine-kicker">HEAVY DUTY</span>
              <strong>PARTS</strong>
              <div className="machine-line" />
              <p>CAT · KOMATSU · JCB</p>
            </div>
          </div>
        </div>

        <div className="shell hero-benefits">
          <div><span>◆</span><strong>Мультибренд</strong><small>единый каталог для разных производителей</small></div>
          <div><span>▣</span><strong>По всей России</strong><small>условия доставки берутся из профиля магазина</small></div>
          <div><span>◇</span><strong>OEM и аналоги</strong><small>кроссы, замены и дополнительные номера</small></div>
          <div><span>◎</span><strong>B2B</strong><small>массовая заявка и работа с менеджером</small></div>
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

      <section className="section shell category-preview">
        <div className="section-heading">
          <div>
            <span className="eyebrow">По узлам техники</span>
            <h2>Категории запчастей</h2>
          </div>
          <Link href="/catalog">Все категории в каталоге →</Link>
        </div>
        <div className="category-cards">
          {categories.slice(0, 8).map((category) => (
            <Link className="category-card panel" href={`/category/${category.slug}`} key={category.slug}>
              <span>{category.title.slice(0, 2).toUpperCase()}</span>
              <strong>{category.title}</strong>
              <small>{category.description || "Открыть категорию"}</small>
              <b>→</b>
            </Link>
          ))}
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
        {products.items.length ? (
          <div className="product-grid">
            {products.items.map((product) => <ProductCard product={product} key={product.id} />)}
          </div>
        ) : (
          <div className="panel empty-state">
            <p>Каталог временно недоступен или пока не содержит опубликованных товаров.</p>
            <Link className="button primary" href="/request">Отправить запрос</Link>
          </div>
        )}
      </section>

      <section className="section shell service-grid">
        <article className="service-card large">
          <span className="eyebrow">Заявка по списку</span>
          <h2>Не ищите позиции по одной</h2>
          <p>Соберите товары в заявку, вставьте список артикулов или загрузите XLSX/CSV.</p>
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
          <p>Карточка товара умеет показывать product_codes и products_analogs.</p>
        </article>
      </section>

      {home?.sections.length ? (
        <section className="shell home-cms-sections">
          <CmsSections sections={home.sections} />
        </section>
      ) : null}
    </>
  );
}
