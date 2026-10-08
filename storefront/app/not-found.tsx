import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell page-shell">
      <div className="panel empty-state not-found">

        <h1>Страница не найдена</h1>
        <p>Вернитесь в каталог или найдите запчасть по артикулу.</p>
        <Link className="button primary" href="/catalog">Открыть каталог</Link>
      </div>
    </div>
  );
}
