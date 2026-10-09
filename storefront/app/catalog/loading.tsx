export default function CatalogLoading() {
  return (
    <div className="shell page-shell catalog-loading" role="status" aria-live="polite" aria-busy="true">
      <h1>Каталог запчастей</h1>
      <p>Обновляем список запчастей…</p>
      <div className="catalog-loading-lines" aria-hidden="true"><span /><span /><span /></div>
    </div>
  );
}
