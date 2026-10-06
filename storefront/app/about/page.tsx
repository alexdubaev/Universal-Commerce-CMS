import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "О компании",
  description: "СМ ТЕХНО — поставка запчастей для спецтехники и сельскохозяйственной техники.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="shell page-shell">
      <div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>О компании</span></div>
      <section className="about-grid">
        <div className="page-title">
          <span className="eyebrow">СМ ТЕХНО</span>
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
          <span className="eyebrow">Подбор</span>
          <h2>Поиск начинается с номера детали</h2>
          <p>Введите артикул или OEM-номер. Если точной позиции нет в выдаче, отправьте запрос — менеджер сможет проверить замену или совместимый вариант.</p>
        </article>
        <article className="panel prose">
          <span className="eyebrow">Закупка</span>
          <h2>Несколько позиций — одна заявка</h2>
          <p>Товары можно добавлять из каталога или загрузить списком. Это удобнее для закупок, где одновременно требуется несколько десятков артикулов.</p>
        </article>
      </section>
    </div>
  );
}
