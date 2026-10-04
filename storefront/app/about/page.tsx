import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="shell page-shell">
      <div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>О компании</span></div>
      <section className="about-grid">
        <div className="page-title">
          <span className="eyebrow">СМ ТЕХНО</span>
          <h1>Поставка запчастей без лишней сложности</h1>
          <p>Демонстрационная страница компании. Тексты специально отделены от commerce-данных, чтобы позже перенести их в страницы и секции Directus.</p>
          <Link className="button primary" href="/contacts">Связаться с нами</Link>
        </div>
        <div className="about-visual panel">
          <span>COMMERCE</span>
          <strong>CORE</strong>
          <small>Directus + Next.js</small>
        </div>
      </section>
      <section className="brand-stats about-stats">
        <div><strong>100 000</strong><span>архитектура рассчитана на большой каталог</span></div>
        <div><strong>1 API</strong><span>единая точка commerce-интеграции</span></div>
        <div><strong>2 UI</strong><span>desktop и mobile</span></div>
        <div><strong>B2B</strong><span>заявки вместо перегруженной розничной логики</span></div>
      </section>
      <section className="two-columns">
        <article className="panel prose"><span className="eyebrow">Подход</span><h2>Поиск сначала</h2><p>Главный сценарий — быстро найти запчасть по артикулу, а затем отправить запрос. Это соответствует уже существующему нормализованному поиску CMS.</p></article>
        <article className="panel prose"><span className="eyebrow">Данные</span><h2>CMS как источник истины</h2><p>Товары, SEO, документы, аналоги и заявки берутся из Universal Commerce CMS. Mock-данные автоматически уступают место Directus после настройки env.</p></article>
      </section>
    </div>
  );
}
