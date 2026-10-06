import type { Metadata } from "next";
import Link from "next/link";
import { CmsPageRenderer } from "@/components/CmsPageRenderer";
import { getSiteSettings } from "@/lib/catalog";
import { getCmsPage } from "@/lib/content";
import { safeCanonicalUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCmsPage("delivery");
  return {
    title: page?.seo_title || page?.title || "Доставка запчастей",
    description: page?.seo_description || page?.intro || "Условия доставки B2B-заказов запчастей для спецтехники.",
    alternates: { canonical: safeCanonicalUrl(page?.canonical_url, "/delivery") },
    robots: page?.is_indexable === false ? { index: false, follow: true } : undefined,
    openGraph: page?.og_image ? { images: [{ url: `/api/assets/${page.og_image}` }] } : undefined,
  };
}

export default async function DeliveryPage() {
  const [page, settings] = await Promise.all([getCmsPage("delivery"), getSiteSettings()]);
  if (page) return <CmsPageRenderer page={page} />;

  const region = settings.delivery_region || "по России";

  return (
    <div className="shell page-shell">
      <div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>Доставка</span></div>
      <div className="page-title">
        <span className="eyebrow">Логистика</span>
        <h1>Доставка {region}</h1>
        <p>Способ, стоимость и срок доставки согласуются при подтверждении заявки с учётом склада, веса и габаритов заказа.</p>
      </div>

      <section className="info-hero panel">
        <div>
          <span className="eyebrow">B2B поставка</span>
          <h2>От комплектации до передачи перевозчику</h2>
          <p>После согласования заказа менеджер подтверждает вариант отгрузки и передаёт информацию для отслеживания.</p>
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
          <span className="eyebrow">Варианты</span>
          <h2>До терминала или до адреса</h2>
          <p>Конкретный перевозчик и способ доставки выбираются при согласовании заказа. Для крупногабаритных и тяжёлых деталей условия рассчитываются отдельно.</p>
          <ul><li>Отправка до терминала</li><li>Доставка до адреса</li><li>Дополнительная упаковка при необходимости</li><li>Отдельный расчёт негабаритных грузов</li></ul>
        </article>
        <article className="panel prose">
          <span className="eyebrow">Расчёт</span>
          <h2>Нужен срок и стоимость?</h2>
          <p>Добавьте позиции в заявку — менеджер сможет рассчитать поставку по конкретному составу заказа.</p>
          <Link className="button primary" href="/request">Рассчитать поставку</Link>
        </article>
      </section>
    </div>
  );
}
