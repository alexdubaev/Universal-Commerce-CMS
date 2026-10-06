import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToRequest } from "@/components/AddToRequest";
import { ProductCard } from "@/components/ProductCard";
import { getProductDetail, getRelatedProducts } from "@/lib/catalog";
import { brandToSlug } from "@/lib/mock";
import { absoluteUrl, safeJsonLd } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) return {};

  const title = product.seo_title || `${product.brand} ${product.sku} — ${product.title}`;
  const description = product.seo_description || product.short_description || `Запчасть ${product.brand} ${product.sku}. B2B-заявка и поставка.`;

  return {
    title,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      type: "website",
      title,
      description,
      images: product.main_image ? [{ url: `/api/assets/${product.main_image}` }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) notFound();
  const related = await getRelatedProducts(product, 4);

  const price = product.price_status === "fixed" && product.price != null
    ? `${money.format(product.price)} ₽`
    : "Цена по запросу";

  const availability = product.availability_status === "in_stock"
    ? "В наличии"
    : product.availability_status === "out_of_stock"
      ? "Нет в наличии"
      : "Под заказ";

  const availabilitySchema = product.availability_status === "in_stock"
    ? "https://schema.org/InStock"
    : product.availability_status === "out_of_stock"
      ? "https://schema.org/OutOfStock"
      : "https://schema.org/PreOrder";

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    sku: product.sku,
    mpn: product.mpn || undefined,
    brand: { "@type": "Brand", name: product.brand },
    description: product.short_description || product.full_description || undefined,
    image: product.main_image ? [absoluteUrl(`/api/assets/${product.main_image}`)] : undefined,
    offers: product.price_status === "fixed" && product.price != null ? {
      "@type": "Offer",
      priceCurrency: product.currency || "RUB",
      price: product.price,
      availability: availabilitySchema,
      url: absoluteUrl(`/product/${product.slug}`),
    } : undefined,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Каталог", item: absoluteUrl("/catalog") },
      { "@type": "ListItem", position: 3, name: product.brand, item: absoluteUrl(`/brand/${brandToSlug(product.brand)}`) },
      { "@type": "ListItem", position: 4, name: product.sku, item: absoluteUrl(`/product/${product.slug}`) },
    ],
  };

  const primaryImage = product.images[0]?.image || product.main_image;

  return (
    <div className="shell page-shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />

      <div className="breadcrumbs">
        <Link href="/">Главная</Link><span>/</span>
        <Link href="/catalog">Каталог</Link><span>/</span>
        <Link href={`/brand/${brandToSlug(product.brand)}`}>{product.brand}</Link><span>/</span>
        <span>{product.sku}</span>
      </div>

      <section className="product-page panel">
        <div className="product-media">
          {primaryImage
            ? <img src={`/api/assets/${primaryImage}`} alt={product.images[0]?.alt_text || product.title} />
            : <div className="product-placeholder"><span>{product.brand}</span><strong>{product.sku}</strong></div>}
          {product.images.length > 1 && (
            <div className="product-thumbs" aria-label="Галерея товара">
              {product.images.slice(0, 6).map((image, index) => (
                <a href={`/api/assets/${image.image}`} target="_blank" rel="noreferrer" key={`${image.image}-${index}`}>
                  <img src={`/api/assets/${image.image}`} alt={image.alt_text || `${product.title}, изображение ${index + 1}`} />
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="product-info">
          <div className="product-tags">
            <span>{product.brand}</span>
            {product.part_type && <span>{product.part_type.toUpperCase()}</span>}
            <span className={product.availability_status === "in_stock" ? "ok" : ""}>{availability}</span>
          </div>
          <h1>{product.title}</h1>
          <div className="article-big">Артикул <strong>{product.sku}</strong></div>
          <p>{product.short_description ?? "Описание и применяемость уточняются по запросу."}</p>
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
          <p>{product.full_description ?? product.short_description ?? "Дополнительную информацию по детали можно запросить у менеджера."}</p>
          {product.category && <Link className="text-link" href={`/category/${product.category.slug}`}>Категория: {product.category.title} →</Link>}
        </article>
        <article className="panel">
          <span className="eyebrow">Характеристики</span>
          <h2>Основные данные</h2>
          <dl className="spec-list">
            <div><dt>Бренд</dt><dd>{product.brand}</dd></div>
            <div><dt>Артикул</dt><dd>{product.sku}</dd></div>
            {product.mpn && <div><dt>MPN</dt><dd>{product.mpn}</dd></div>}
            <div><dt>Категория</dt><dd>{product.category?.title ?? "—"}</dd></div>
            {product.specification_items.length
              ? product.specification_items.map((item, index) => (
                <div key={`${item.name}-${index}`}>
                  <dt>{item.name}</dt>
                  <dd>{item.value}{item.unit ? ` ${item.unit}` : ""}</dd>
                </div>
              ))
              : Object.entries(product.specifications ?? {}).map(([key, value]) => (
                <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>
              ))}
          </dl>
        </article>
      </section>

      {(product.codes.length > 0 || product.documents.length > 0) && (
        <section className="product-extra-grid">
          {product.codes.length > 0 && (
            <article className="panel product-extra">
              <span className="eyebrow">Кросс-номера</span>
              <h2>Дополнительные номера</h2>
              <div className="code-list">
                {product.codes.map((code, index) => (
                  <div key={`${code.code}-${index}`}><strong>{code.code}</strong><span>{code.code_type}</span></div>
                ))}
              </div>
            </article>
          )}
          {product.documents.length > 0 && (
            <article className="panel product-extra">
              <span className="eyebrow">Документы</span>
              <h2>Файлы товара</h2>
              <div className="document-list">
                {product.documents.map((document, index) => (
                  <a href={`/api/assets/${document.file}`} target="_blank" rel="noreferrer" key={`${document.file}-${index}`}>
                    <span>PDF / FILE</span><strong>{document.title || `Документ ${index + 1}`}</strong><b>↗</b>
                  </a>
                ))}
              </div>
            </article>
          )}
        </section>
      )}

      {product.relations.length > 0 && (
        <section className="section product-relations">
          <div className="section-heading">
            <div><span className="eyebrow">Кроссы и замены</span><h2>Аналоги и совместимые позиции</h2></div>
          </div>
          <div className="product-grid">
            {product.relations.slice(0, 4).map((relation) => (
              <div className="relation-wrap" key={`${relation.relation_type}-${relation.product.id}`}>
                <span className="relation-type">{relation.relation_type.replaceAll("_", " ")}</span>
                <ProductCard product={relation.product} />
              </div>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="section related-section">
          <div className="section-heading">
            <div><span className="eyebrow">Ещё в категории</span><h2>Связанные товары</h2></div>
          </div>
          <div className="product-grid">
            {related.map((item) => <ProductCard product={item} key={item.id} />)}
          </div>
        </section>
      )}
    </div>
  );
}
