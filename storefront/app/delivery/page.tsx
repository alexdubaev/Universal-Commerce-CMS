import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Доставка запчастей",
  description: "Условия доставки B2B-заказов запчастей для спецтехники по России.",
  alternates: { canonical: "/delivery" },
};

export default function DeliveryPage() {
  return (
    <div className="shell page-shell">
      <div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>Доставка</span></div>
      <div className="page-title">
        <span className="eyebrow">Логистика</span>
        <h1>Доставка по всей России</h1>
        <p>Страница подготовлена под редактируемый контент Directus. Ниже — демонстрационные условия для макета.</p>
      </div>

      <section className="info-hero panel">
        <div>
          <span className="eyebrow">B2B поставка</span>
          <h2>От склада до вашего предприятия</h2>
          <p>Передадим груз выбранной транспортной компании, подготовим документы и сообщим данные для отслеживания.</p>
        </div>
        <div className="info-symbol">→</div>
      </section>

      <section className="steps-grid">
        <article className="panel"><span>01</span><h3>Согласование</h3><p>Подтверждаем наличие, сроки и способ доставки.</p></article>
        <article className="panel"><span>02</span><h3>Оплата</h3><p>Выставляем счёт и резервируем позиции.</p></article>
        <article className="panel"><span>03</span><h3>Комплектация</h3><p>Проверяем заказ, упаковку и документы.</p></article>
        <article className="panel"><span>04</span><h3>Отправка</h3><p>Передаём заказ перевозчику и отправляем трек-данные.</p></article>
      </section>

      <section className="two-columns">
        <article className="panel prose">
          <span className="eyebrow">Варианты</span>
          <h2>Транспортные компании</h2>
          <p>В production сюда подключается контент из CMS: Деловые Линии, ПЭК, СДЭК, Энергия и другие перевозчики.</p>
          <ul><li>До терминала</li><li>До двери</li><li>Страхование груза</li><li>Межтерминальная доставка</li></ul>
        </article>
        <article className="panel prose">
          <span className="eyebrow">Сроки</span>
          <h2>Расчёт под заказ</h2>
          <p>Стоимость и срок зависят от склада, габаритов и выбранного перевозчика. Для тяжёлых деталей менеджер согласует условия отдельно.</p>
          <Link className="button primary" href="/request">Рассчитать поставку</Link>
        </article>
      </section>
    </div>
  );
}
