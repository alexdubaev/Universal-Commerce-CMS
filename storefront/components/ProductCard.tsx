import Link from "next/link";
import { AddToRequest } from "./AddToRequest";
import { CopyArticle } from "./CopyArticle";
import type { Product } from "@/lib/types";

const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function price(product: Product) {
  if (product.price_status !== "fixed" || product.price == null) return "Цена по запросу";
  return `${money.format(product.price)} ₽`;
}

export function ProductCard({ product }: { product: Product }) {
  const state = product.availability_status === "in_stock"
    ? "В наличии"
    : product.availability_status === "out_of_stock"
      ? "Нет в наличии"
      : "Под заказ";

  return (
    <article className={`product-card${product.main_image ? "" : " product-card-no-photo"}`}>
      <Link className={`product-art${product.main_image ? "" : " product-art-empty"}`} href={`/product/${product.slug}`} aria-label={`Открыть ${product.title}, ${product.sku}`}>
        {product.main_image
          ? <img src={`/api/assets/${product.main_image}`} alt={`${product.title} — ${product.brand}`} loading="lazy" />
          : <span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="1" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 4-6 5 7" /></svg><small>Без фото</small></span>}
      </Link>
      <Link className="product-title" href={`/product/${product.slug}`}>{product.title}</Link>
      <div className="product-meta">
        <span>{product.brand}</span>
        <span className={product.availability_status === "in_stock" ? "stock ok" : "stock"}>{state}</span>
      </div>
      <div className="sku"><span>Артикул: <strong>{product.sku}</strong></span><CopyArticle article={product.sku} /></div>
      <div className="product-bottom">
        <strong className="price">{price(product)}</strong>
        <AddToRequest product={product} />
      </div>
    </article>
  );
}
