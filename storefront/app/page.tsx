import type { Metadata } from "next";
import Link from "next/link";
import { CmsSections } from "@/components/CmsPageRenderer";
import { ProductCard } from "@/components/ProductCard";
import { getBrands, getProducts } from "@/lib/catalog";
import { getCmsHome, safeContentHref } from "@/lib/content";
import { safeCanonicalUrl } from "@/lib/seo";

function SearchIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m15.5 15.5 4.2 4.2" /></svg>;
}

function AlternativesIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4" /></svg>;
}

export async function generateMetadata(): Promise<Metadata> {
  const home = await getCmsHome();
  if (!home) return {};
  return {
    title: home.seo_title || home.h1 || home.hero_title || undefined,
    description: home.seo_description || home.hero_text || undefined,
    alternates: { canonical: safeCanonicalUrl(home.canonical_url, "/") },
    robots: home.is_indexable === false ? { index: false, follow: true } : undefined,
    openGraph: {
      title: home.seo_title || home.h1 || home.hero_title || undefined,
      description: home.seo_description || home.hero_text || undefined,
      images: home.hero_image ? [{ url: `/api/assets/${home.hero_image}` }] : undefined,
    },
  };
}

export default async function HomePage() {
  const [products, brandList, home] = await Promise.all([
    getProducts({ limit: 8 }),
    getBrands(),
    getCmsHome(),
  ]);

  const primaryHref = safeContentHref(home?.hero_primary_button_url);
  const secondaryHref = safeContentHref(home?.hero_secondary_button_url);
  const heroTitle = home?.hero_title || "Запчасти для спецтехники";
  const heroText = home?.hero_text || "Введите артикул или OEM-номер, чтобы найти деталь в каталоге. Добавьте позиции в заявку, чтобы уточнить наличие и условия поставки.";
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

            <h1>{home ? heroTitle : <><span>Запчасти</span><span>для вашей</span><span>техники</span></>}</h1>
            <p>{heroText}</p>
            <div className="hero-cms-actions">
                {primaryHref && home?.hero_primary_button_text ? (
                  primaryHref.startsWith("/")
                    ? <Link className="button primary" href={primaryHref}>{home.hero_primary_button_text}</Link>
                    : <a className="button primary" href={primaryHref} target="_blank" rel="noreferrer">{home.hero_primary_button_text}</a>
                ) : <Link className="button primary" href="/catalog">Открыть каталог</Link>}
                {secondaryHref && home?.hero_secondary_button_text ? (
                  secondaryHref.startsWith("/")
                    ? <Link className="button secondary" href={secondaryHref}>{home.hero_secondary_button_text}</Link>
                    : <a className="button secondary" href={secondaryHref} target="_blank" rel="noreferrer">{home.hero_secondary_button_text}</a>
                ) : <Link className="button secondary" href="/request">Отправить список</Link>}
            </div>
          </div>

        </div>

        <div className="shell hero-quicklinks" aria-label="Быстрый поиск">
          <strong>Что ищете?</strong>
          <a href="#article-search"><span aria-hidden="true">⌕</span>По артикулу <b>→</b></a>
          <a href="#brands"><span aria-hidden="true">⚙</span>По бренду <b>→</b></a>
        </div>
      </section>

      <section className="brand-strip" id="brands">
        <div className="shell">
          <div className="brand-list">
            {brandList.map((brand) => (
              <Link href={`/brand/${brand.slug}`} key={brand.slug}>{brand.name}</Link>
            ))}
            <Link className="all-brands" href="/brands">Все бренды →</Link>
          </div>
        </div>
      </section>

      <section className="section shell">
        <div className="section-heading">
          <div>

            <h2>Подборка каталога</h2>
          </div>
          <Link href="/catalog">Открыть весь каталог →</Link>
        </div>
        {products.items.length ? (
          <div className="product-grid home-product-grid scroll-reveal">
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
        <article className="service-card large scroll-reveal">

          <h2>Не ищите позиции по одной</h2>
          <p>Соберите товары в заявку, вставьте список артикулов или загрузите XLSX/CSV.</p>
          <Link className="button primary" href="/request">Собрать заявку</Link>
        </article>
        <article className="service-card scroll-reveal">
          <span className="service-icon"><SearchIcon /></span>
          <h3>Поиск по артикулу</h3>
          <p>Ищите запчасти по артикулу или OEM-номеру.</p>
        </article>
        <article className="service-card scroll-reveal">
          <span className="service-icon"><AlternativesIcon /></span>
          <h3>Оригиналы и аналоги</h3>
          <p>Если для товара указаны совместимые позиции, они доступны в его карточке.</p>
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
