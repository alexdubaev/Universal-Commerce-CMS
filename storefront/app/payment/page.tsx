import Link from "next/link";

export default function PaymentPage() {
  return (
    <div className="shell page-shell">
      <div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>Оплата</span></div>
      <div className="page-title">
        <span className="eyebrow">B2B расчёты</span>
        <h1>Оплата по счёту</h1>
        <p>Страница сделана под юридических лиц. Финальные условия должны быть заполнены владельцем магазина в Directus.</p>
      </div>
      <section className="feature-cards">
        <article className="panel"><span className="feature-number">01</span><h2>Счёт</h2><p>После подтверждения заявки менеджер формирует коммерческое предложение и счёт.</p></article>
        <article className="panel"><span className="feature-number">02</span><h2>НДС</h2><p>Витрина подготовлена к отображению цены и налоговой информации из профиля магазина.</p></article>
        <article className="panel"><span className="feature-number">03</span><h2>Документы</h2><p>Закрывающие документы и отгрузочные документы передаются с заказом.</p></article>
      </section>
      <section className="panel callout">
        <div><span className="eyebrow">Нужен счёт?</span><h2>Отправьте список позиций</h2><p>Мы соберём заявку в одном месте и передадим её менеджеру.</p></div>
        <Link className="button primary" href="/request">Создать заявку</Link>
      </section>
    </div>
  );
}
