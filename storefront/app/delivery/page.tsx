import type { Metadata } from "next";
import Link from "next/link";
import { CmsPageRenderer } from "@/components/CmsPageRenderer";
import { getSiteSettings } from "@/lib/catalog";
import { getCmsPage } from "@/lib/content";
import { absoluteUrl, safeCanonicalUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCmsPage("delivery");
  const title = page?.seo_title || page?.title || "Доставка запчастей";
  const description = page?.seo_description || page?.intro || "Условия доставки B2B-заказов запчастей для спецтехники.";
  return {
    title,
    description,
    alternates: { canonical: safeCanonicalUrl(page?.canonical_url, "/delivery") },
    robots: page?.is_indexable === false ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website", title, description, url: absoluteUrl("/delivery"),
      images: [{ url: absoluteUrl(page?.og_image ? `/api/assets/${page.og_image}` : "/images/hero-industrial-v3.webp") }],
    },
  };
}

export default async function DeliveryPage() {
  const [page, settings] = await Promise.all([getCmsPage("delivery"), getSiteSettings()]);
  if (page) return <CmsPageRenderer page={page} />;

  const region = settings.delivery_region?.trim();
  const deliveryTitle = !region || /^(Россия|по России)$/i.test(region) ? "Доставка по России" : `Доставка: ${region}`;

  return (
    <div className="shell page-shell">
      <div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>Доставка</span></div>
      <div className="page-title">

        <h1>{deliveryTitle}</h1>
        <p>Способ, стоимость и срок доставки согласуются при подтверждении заявки с учётом склада, веса и габаритов заказа.</p>
      </div>

      <section className="info-hero panel">
        <div>

          <h2>Что указать для расчёта доставки</h2>
          <p>Передайте город получения и список позиций. Вес, габариты, стоимость и срок доставки нужно подтвердить для конкретного заказа.</p>
        </div>
        <div className="info-symbol">→</div>
      </section>

      <section className="steps-grid">
        <article className="panel"><span>01</span><h3>Согласование</h3><p>Подтверждаем позиции, сроки и способ доставки.</p></article>
        <article className="panel"><span>02</span><h3>Оплата</h3><p>Формируем документы по согласованным условиям.</p></article>
        <article className="panel"><span>03</span><h3>Комплектация</h3><p>Собираем заказ и подготавливаем его к отправке.</p></article>
        <article className="panel"><span>04</span><h3>Отправка</h3><p>Передаём заказ выбранному перевозчику.</p></article>
      </section>

      <section className="two-columns">
        <article className="panel prose">

          <h2>Место получения</h2>
          <p>Сообщите, нужен ли вам терминал перевозчика или конкретный адрес. Возможность выбранного способа доставки и требования к упаковке подтверждаются для вашего заказа.</p>
        </article>
        <article className="panel prose">

          <h2>Нужен срок и стоимость?</h2>
          <p>Добавьте позиции в заявку — менеджер сможет рассчитать поставку по конкретному составу заказа.</p>
          <Link className="button primary" href="/request">Рассчитать поставку</Link>
        </article>
      </section>
    </div>
  );
}
