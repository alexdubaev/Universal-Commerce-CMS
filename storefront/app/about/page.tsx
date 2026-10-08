import type { Metadata } from "next";
import Link from "next/link";
import { CmsPageRenderer } from "@/components/CmsPageRenderer";
import { getCmsPage } from "@/lib/content";
import { safeCanonicalUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCmsPage("about");
  return {
    title: page?.seo_title || page?.title || "О компании",
    description: page?.seo_description || page?.intro || "СМ ТЕХНО — поставка запчастей для спецтехники и сельскохозяйственной техники.",
    alternates: { canonical: safeCanonicalUrl(page?.canonical_url, "/about") },
    robots: page?.is_indexable === false ? { index: false, follow: true } : undefined,
    openGraph: page?.og_image ? { images: [{ url: `/api/assets/${page.og_image}` }] } : undefined,
  };
}

export default async function AboutPage() {
  const page = await getCmsPage("about");
  if (page) return <CmsPageRenderer page={page} />;

  return (
    <div className="shell page-shell">
      <div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>О компании</span></div>
      <section className="about-grid">
        <div className="page-title">

          <h1>Поставка запчастей без лишней сложности</h1>
          <p>Помогаем быстро найти нужную позицию по артикулу, собрать несколько товаров в одну заявку и согласовать поставку с менеджером.</p>
          <Link className="button primary" href="/contacts">Связаться с нами</Link>
        </div>
        <div className="about-visual panel">
          <span>HEAVY EQUIPMENT</span>
          <strong>PARTS</strong>
          <small>мультибрендовый B2B-каталог</small>
        </div>
      </section>
      <section className="brand-stats about-stats">
        <div><strong>Мультибренд</strong><span>один каталог для разных производителей</span></div>
        <div><strong>Артикул</strong><span>поиск по SKU и OEM-номерам</span></div>
        <div><strong>Списком</strong><span>массовая заявка на несколько позиций</span></div>
        <div><strong>B2B</strong><span>работа через заявку и менеджера</span></div>
      </section>
      <section className="two-columns">
        <article className="panel prose">

          <h2>Поиск начинается с номера детали</h2>
          <p>Введите артикул или OEM-номер. Если точной позиции нет в выдаче, отправьте запрос — менеджер сможет проверить замену или совместимый вариант.</p>
        </article>
        <article className="panel prose">

          <h2>Несколько позиций — одна заявка</h2>
          <p>Товары можно добавлять из каталога или загрузить списком. Это удобнее для закупок, где одновременно требуется несколько десятков артикулов.</p>
        </article>
      </section>
    </div>
  );
}
