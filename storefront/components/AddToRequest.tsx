"use client";

import { useAddToRequest } from "@/hooks/useAddToRequest";
import type { Product } from "@/lib/types";

export function AddToRequest({ product, full = false }: { product: Product; full?: boolean }) {
  const { added, add } = useAddToRequest(product);

  return (
    <>
      <button className={full ? "button primary wide" : "card-action"} type="button" onClick={add}>
        {added ? "В корзине ✓" : "В корзину"}
      </button>
      <span className="request-announcement" role="status" aria-live="polite">{added ? `${product.sku}: добавлено в корзину` : ""}</span>
    </>
  );
}
