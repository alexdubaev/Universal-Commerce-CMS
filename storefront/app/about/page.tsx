import type { Metadata } from "next";
import Link from "next/link";
import { CmsPageRenderer } from "@/components/CmsPageRenderer";
import { getCmsPage } from "@/lib/content";
import { getBrands, getCategories, getSiteSettings } from "@/lib/catalog";
import { absoluteUrl, safeCanonicalUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCmsPage("about");
  const title = page?.seo_title || page?.title || "О компании";
  const description = page?.seo_description || page?.intro || "СМ ТЕХНО — поставка запчастей для спецтехники и сельскохозяйственной техники.";
  return {
    title,
    description,
    alternates: { canonical: safeCanonicalUrl(page?.canonical_url, "/about") },
    robots: page?.is_indexable === false ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website", title, description, url: absoluteUrl("/about"),
      images: [{ url: absoluteUrl(page?.og_image ? `/api/assets/${page.og_image}` : "/images/hero-industrial-v3.webp") }],
    },
  };
}

export default async function AboutPage() {
  const [page, settings, brands, categories] = await Promise.all([
    getCmsPage("about"), getSiteSettings(), getBrands(), getCategories(),
  ]);
  if (page) return <CmsPageRenderer page={page} />;

  return (
    <div className="shell page-shell">
      <div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>О компании</span></div>
      <section>
        <div className="page-title">

          <h1>О компании {settings.company_name}</h1>
          <p>{settings.company_name} — поставщик запчастей для спецтехники. В каталоге представлены детали разных производителей{brands.length ? `: ${brands.slice(0, 6).map((brand) => brand.name).join(", ")}` : ""}.</p>
          <Link className="button primary" href="/contacts">Связаться с нами</Link>
        </div>
      </section>
      <section className="two-columns">
        <article className="panel prose">

          <h2>Ассортимент</h2>
          <p>Основные разделы каталога помогают найти детали по узлу техники. Название, артикул, цена и наличие указаны в карточке каждой позиции.</p>
          {categories.length > 0 && <ul>{categories.slice(0, 8).map((category) => <li key={category.slug}><Link className="text-link" href={`/category/${category.slug}`}>{category.title}</Link></li>)}</ul>}
        </article>
        <article className="panel prose">

          <h2>Работа с заявками</h2>
          <p>Передайте артикулы, количество и контактные данные. Заявка нужна для подтверждения наличия, стоимости и условий конкретной поставки; она не является оплатой заказа.</p>
          <Link className="text-link" href="/request?import=1">Передать список позиций →</Link>
        </article>
      </section>
    </div>
  );
}
