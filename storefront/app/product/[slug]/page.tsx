import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToRequest } from "@/components/AddToRequest";
import { getProduct } from "@/lib/catalog";
import { brandToSlug } from "@/lib/mock";

type Props = { params: Promise<{ slug: string }> };

const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const price = product.price_status === "fixed" && product.price != null
    ? `${money.format(product.price)} ₽`
    : "Цена по запросу";

  const availability = product.availability_status === "in_stock"
    ? "В наличии"
    : product.availability_status === "out_of_stock"
      ? "Нет в наличии"
      : "Под заказ";

  return (
    <div className="shell page-shell">
      <div className="breadcrumbs">
        <Link href="/">Главная</Link><span>/</span>
        <Link href="/catalog">Каталог</Link><span>/</span>
        <Link href={`/brand/${brandToSlug(product.brand)}`}>{product.brand}</Link><span>/</span>
        <span>{product.sku}</span>
      </div>

      <section className="product-page panel">
        <div className="product-media">
          {product.main_image
            ? <img src={`/api/assets/${product.main_image}`} alt={product.title} />
            : <div className="product-placeholder"><span>{product.brand}</span><strong>{product.sku}</strong></div>}
        </div>

        <div className="product-info">
          <div className="product-tags">
            <span>{product.brand}</span>
            {product.part_type && <span>{product.part_type.toUpperCase()}</span>}
            <span className={product.availability_status === "in_stock" ? "ok" : ""}>{availability}</span>
          </div>
          <h1>{product.title}</h1>
          <div className="article-big">Артикул <strong>{product.sku}</strong></div>
          <p>{product.short_description ?? "Описание будет загружено из Directus."}</p>
          <div className="product-price">{price}</div>
          <AddToRequest product={product} full />
          <Link className="button secondary wide" href="/request">Открыть заявку</Link>
          <div className="product-trust">
            <div><strong>Доставка</strong><span>по России транспортными компаниями</span></div>
            <div><strong>Документы</strong><span>счёт, НДС и закрывающие документы</span></div>
          </div>
        </div>
      </section>

      <section className="product-details">
        <article className="panel">
          <span className="eyebrow">Описание</span>
          <h2>О товаре</h2>
          <p>{product.full_description ?? product.short_description ?? "Полное описание подключается к полю full_description в Directus."}</p>
        </article>
        <article className="panel">
          <span className="eyebrow">Характеристики</span>
          <h2>Основные данные</h2>
          <dl className="spec-list">
            <div><dt>Бренд</dt><dd>{product.brand}</dd></div>
            <div><dt>Артикул</dt><dd>{product.sku}</dd></div>
            {product.mpn && <div><dt>MPN</dt><dd>{product.mpn}</dd></div>}
            <div><dt>Категория</dt><dd>{product.category?.title ?? "—"}</dd></div>
            {Object.entries(product.specifications ?? {}).map(([key, value]) => (
              <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>
            ))}
          </dl>
        </article>
      </section>
    </div>
  );
}
