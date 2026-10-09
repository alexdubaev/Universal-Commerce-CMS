import type { Metadata } from "next";
import Link from "next/link";
import { CmsSections } from "@/components/CmsPageRenderer";
import { ProductCard } from "@/components/ProductCard";
import { SearchFocusLink } from "@/components/SearchFocusLink";
import { ArticlesSection } from "@/components/articles/ArticlesSection";
import { getBrands, getCategories, getProducts } from "@/lib/catalog";
import { getCmsHome, safeContentHref } from "@/lib/content";
import { absoluteUrl, safeCanonicalUrl } from "@/lib/seo";

const defaultHeroTitle = "Запчасти для спецтехники";
const defaultHeroText = "Найдите деталь по артикулу или отправьте список позиций для расчёта";

export async function generateMetadata(): Promise<Metadata> {
  const home = await getCmsHome();
  const title = home?.seo_title || home?.h1 || home?.hero_title || defaultHeroTitle;
  const description = home?.seo_description || home?.hero_text || defaultHeroText;
  const canonical = absoluteUrl(safeCanonicalUrl(home?.canonical_url, "/"));
  const image = home?.hero_image ? `/api/assets/${home.hero_image}` : "/images/hero-industrial-v3.webp";
  return {
    title,
    description,
    alternates: { canonical },
    robots: home?.is_indexable === false ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description,
      url: canonical,
      images: [{ url: absoluteUrl(image) }],
    },
  };
}

export default async function HomePage() {
  const [products, brandList, categories, home] = await Promise.all([
    getProducts({ limit: 6 }),
    getBrands(),
    getCategories(),
    getCmsHome(),
  ]);

  const primaryHref = safeContentHref(home?.hero_primary_button_url);
  const secondaryHref = safeContentHref(home?.hero_secondary_button_url);
  const secondaryActionHref = secondaryHref === "/request" ? "/request?import=1" : secondaryHref;
  const heroTitle = home?.hero_title || defaultHeroTitle;
  const heroText = home?.hero_text || defaultHeroText;
  const heroImage = home?.hero_image ? `/api/assets/${home.hero_image}` : "/images/hero-industrial-v3.webp";
  const mobileHeroImage = home?.hero_image ? heroImage : "/images/hero-industrial-v3-mobile.webp";

  return (
    <>
      <section className={`hero${home?.hero_image ? " hero-cms-image" : ""}`}>
        <picture className="hero-background" aria-hidden={home?.hero_image ? undefined : true}>
          <source media="(max-width: 820px)" srcSet={mobileHeroImage} />
          <img src={heroImage} alt={home?.hero_image ? home.hero_image_alt || "" : ""} width="2172" height="724" fetchPriority="high" />
        </picture>
        <div className="shell hero-grid">
          <div className="hero-copy">

            <h1>{heroTitle === defaultHeroTitle ? <><span>Запчасти</span>{" "}<span>для</span>{" "}<span>спецтехники</span></> : heroTitle}</h1>
            <p>{heroText}</p>
            <div className="hero-cms-actions">
                {primaryHref && home?.hero_primary_button_text ? (
                  primaryHref.startsWith("/")
                    ? <Link className="button primary" href={primaryHref}>{home.hero_primary_button_text}</Link>
                    : <a className="button primary" href={primaryHref} target="_blank" rel="noreferrer">{home.hero_primary_button_text}</a>
                ) : <Link className="button primary" href="/catalog">Открыть каталог</Link>}
                {secondaryActionHref && home?.hero_secondary_button_text ? (
                  secondaryActionHref.startsWith("/")
                    ? <Link className="button secondary" href={secondaryActionHref}>{home.hero_secondary_button_text}</Link>
                    : <a className="button secondary" href={secondaryActionHref} target="_blank" rel="noreferrer">{home.hero_secondary_button_text}</a>
                ) : <Link className="button secondary" href="/request?import=1">Отправить список</Link>}
            </div>
          </div>

        </div>

        <div className="shell hero-quicklinks" aria-label="Быстрый поиск">
          <strong>Что ищете?</strong>
          <SearchFocusLink><span aria-hidden="true">⌕</span>По артикулу <b aria-hidden="true">→</b></SearchFocusLink>
          <a href="#brands"><span aria-hidden="true">⚙</span>По бренду <b>→</b></a>
        </div>
      </section>

      <section className="brand-strip" id="brands">
        <div className="shell">
          <div className="brand-strip-heading"><strong>По производителю</strong><Link className="all-brands" href="/brands">Все бренды →</Link></div>
          <div className="brand-list" tabIndex={0} role="region" aria-label="Бренды — прокрутите список">
            {brandList.map((brand) => (
              <Link href={`/brand/${brand.slug}`} key={brand.slug}>{brand.name}</Link>
            ))}
          </div>
          <p className="brand-scroll-hint">Листайте список брендов →</p>
        </div>
      </section>

      {categories.length ? <section className="section shell home-categories" aria-labelledby="home-categories-title">
        <div className="section-heading">
          <h2 id="home-categories-title">Категории запчастей</h2>
          <Link href="/catalog">Весь каталог →</Link>
        </div>
        <div className="home-category-grid">
          {categories.slice(0, 8).map((category) => (
            <Link className="home-category-link" href={`/category/${category.slug}`} key={category.slug}>
              <span>{category.title}</span>
            </Link>
          ))}
        </div>
      </section> : null}

      <section className="section shell home-products">
        <div className="section-heading">
          <div>

            <h2>Запчасти из каталога</h2>
          </div>
          <Link href="/catalog">Открыть весь каталог →</Link>
        </div>
        {products.items.length ? (
          <div className="product-grid home-product-grid">
            {products.items.map((product) => <ProductCard product={product} key={product.id} />)}
          </div>
        ) : (
          <div className="panel empty-state">
            <p>Каталог временно недоступен или пока не содержит опубликованных товаров.</p>
            <Link className="button primary" href="/request?import=1">Отправить список</Link>
          </div>
        )}
      </section>

      <section className="section shell home-order" aria-labelledby="home-order-title">
        <div className="section-heading"><h2 id="home-order-title">Как заказать</h2></div>
        <ol className="home-order-steps">
          <li><span className="home-step-number" aria-hidden="true">01</span><h3>Найдите товар или передайте список</h3><p>Используйте артикул, OEM-номер или список позиций.</p></li>
          <li><span className="home-step-number" aria-hidden="true">02</span><h3>Получите подтверждение условий</h3><p>Уточните наличие, цену и условия поставки.</p></li>
          <li><span className="home-step-number" aria-hidden="true">03</span><h3>Согласуйте заказ и поставку</h3><p>Подтвердите состав заказа и согласованные условия.</p></li>
        </ol>
        <div className="home-order-next"><p><strong>Не знаете артикул?</strong> Укажите название детали, марку и модель техники и известные обозначения в заявке.</p><Link className="button primary" href="/request?import=1">Отправить список</Link></div>
      </section>

      <ArticlesSection />

      {home?.sections.length ? (
        <section className="shell home-cms-sections">
          <CmsSections sections={home.sections} />
        </section>
      ) : null}
    </>
  );
}
