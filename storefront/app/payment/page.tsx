import type { Metadata } from "next";
import Link from "next/link";
import { CmsPageRenderer } from "@/components/CmsPageRenderer";
import { getSiteSettings } from "@/lib/catalog";
import { getCmsPage } from "@/lib/content";
import { absoluteUrl, safeCanonicalUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCmsPage("payment");
  const title = page?.seo_title || page?.title || "Оплата";
  const description = page?.seo_description || page?.intro || "Условия оплаты B2B-заказов запчастей для юридических лиц.";
  return {
    title,
    description,
    alternates: { canonical: safeCanonicalUrl(page?.canonical_url, "/payment") },
    robots: page?.is_indexable === false ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website", title, description, url: absoluteUrl("/payment"),
      images: [{ url: absoluteUrl(page?.og_image ? `/api/assets/${page.og_image}` : "/images/hero-industrial-v3.webp") }],
    },
  };
}

export default async function PaymentPage() {
  const [page, settings] = await Promise.all([getCmsPage("payment"), getSiteSettings()]);
  if (page) return <CmsPageRenderer page={page} />;

  return (
    <div className="shell page-shell">
      <div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>Оплата</span></div>
      <div className="page-title">

        <h1>Оплата по согласованным условиям</h1>
        <p>Заявка через сайт не требует оплаты. Перед оформлением поставки получите подтверждение состава заказа, стоимости и условий оплаты.</p>
      </div>
      <section className="feature-cards">
        <article className="panel"><span className="feature-number">01</span><h2>Заявка</h2><p>Передайте артикулы и количество удобным способом.</p></article>
        <article className="panel"><span className="feature-number">02</span><h2>Предложение</h2><p>Получите подтверждённые цены, сроки и условия поставки.</p></article>
        <article className="panel"><span className="feature-number">03</span><h2>Оплата и документы</h2><p>{settings.vat_info || "До оплаты уточните способ расчёта, условия НДС и перечень документов по своему заказу."}</p></article>
      </section>
      <section className="panel callout">
        <div><h2>Отправьте список позиций</h2><p>Артикулы из каталога, ручной список, CSV или XLSX попадут в одну заявку.</p></div>
        <Link className="button primary" href="/request?import=1">Отправить список</Link>
      </section>
    </div>
  );
}
