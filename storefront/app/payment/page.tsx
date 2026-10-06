import type { Metadata } from "next";
import Link from "next/link";
import { CmsPageRenderer } from "@/components/CmsPageRenderer";
import { getSiteSettings } from "@/lib/catalog";
import { getCmsPage } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCmsPage("payment");
  return {
    title: page?.seo_title || page?.title || "Оплата",
    description: page?.seo_description || page?.intro || "Условия оплаты B2B-заказов запчастей для юридических лиц.",
    alternates: { canonical: page?.canonical_url || "/payment" },
    robots: page?.is_indexable === false ? { index: false, follow: true } : undefined,
    openGraph: page?.og_image ? { images: [{ url: `/api/assets/${page.og_image}` }] } : undefined,
  };
}

export default async function PaymentPage() {
  const [page, settings] = await Promise.all([getCmsPage("payment"), getSiteSettings()]);
  if (page) return <CmsPageRenderer page={page} />;

  return (
    <div className="shell page-shell">
      <div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>Оплата</span></div>
      <div className="page-title">
        <span className="eyebrow">B2B расчёты</span>
        <h1>Оплата по согласованным условиям</h1>
        <p>После проверки состава заявки менеджер подтверждает цену, срок поставки и формирует документы для оплаты.</p>
      </div>
      <section className="feature-cards">
        <article className="panel"><span className="feature-number">01</span><h2>Заявка</h2><p>Передайте артикулы и количество удобным способом.</p></article>
        <article className="panel"><span className="feature-number">02</span><h2>Предложение</h2><p>Получите подтверждённые цены, сроки и условия поставки.</p></article>
        <article className="panel"><span className="feature-number">03</span><h2>Документы</h2><p>{settings.vat_info || "Налоговые условия и комплект документов указываются в предложении и счёте."}</p></article>
      </section>
      <section className="panel callout">
        <div><span className="eyebrow">Нужен расчёт?</span><h2>Отправьте список позиций</h2><p>Артикулы из каталога, ручной список, CSV или XLSX попадут в одну заявку.</p></div>
        <Link className="button primary" href="/request">Создать заявку</Link>
      </section>
    </div>
  );
}
