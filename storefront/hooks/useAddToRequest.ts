"use client";

import { useCallback, useState } from "react";
import { mergeRequestItems, readRequestItems, writeRequestItems } from "@/lib/request-store";
import type { Product } from "@/lib/types";

export function useAddToRequest(product: Product) {
  const [added, setAdded] = useState(false);

  const add = useCallback(() => {
    const next = mergeRequestItems(readRequestItems(), [{
      article: product.sku,
      title: product.title,
      brand: product.brand,
      quantity: 1,
    }]);
    writeRequestItems(next);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }, [product.sku, product.title, product.brand]);

  return { added, add };
}
