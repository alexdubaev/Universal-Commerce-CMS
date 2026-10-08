import Link from "next/link";
import { AddToRequest } from "./AddToRequest";
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
    <article className="product-card">
      <Link className="product-art" href={`/product/${product.slug}`} aria-label={product.title}>
        {product.main_image
          ? <img src={`/api/assets/${product.main_image}`} alt={`${product.title} — ${product.brand}`} loading="lazy" />
          : <span><b aria-hidden="true">⚙</b><small>Фото не предоставлено</small></span>}
      </Link>
      <div className="product-meta">
        <span>{product.brand}</span>
        <span className={product.availability_status === "in_stock" ? "stock ok" : "stock"}>{state}</span>
      </div>
      <Link className="product-title" href={`/product/${product.slug}`}>{product.title}</Link>
      <div className="sku">Артикул: <strong>{product.sku}</strong></div>
      <div className="product-bottom">
        <strong className="price">{price(product)}</strong>
        <AddToRequest product={product} />
      </div>
    </article>
  );
}
