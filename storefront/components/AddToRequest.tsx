"use client";

import { useState } from "react";
import { mergeRequestItems, readRequestItems, writeRequestItems } from "@/lib/request-store";
import type { Product } from "@/lib/types";

export function AddToRequest({ product, full = false }: { product: Product; full?: boolean }) {
  const [added, setAdded] = useState(false);

  function add() {
    const next = mergeRequestItems(readRequestItems(), [{
      article: product.sku,
      title: product.title,
      brand: product.brand,
      quantity: 1,
    }]);
    writeRequestItems(next);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }

  return (
    <button className={full ? "button primary wide" : "card-action"} type="button" onClick={add}>
      {added ? "Добавлено ✓" : full ? "Добавить в корзину" : "В корзину"}
    </button>
  );
}
