"use client";

import { useState } from "react";
import type { Product, RequestItem } from "@/lib/types";

const key = "smtechno-request";

function read(): RequestItem[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as RequestItem[];
  } catch {
    return [];
  }
}

export function AddToRequest({ product, full = false }: { product: Product; full?: boolean }) {
  const [added, setAdded] = useState(false);

  function add() {
    const items = read();
    const existing = items.find((item) => item.article === product.sku && item.brand === product.brand);
    if (existing) existing.quantity += 1;
    else items.push({ article: product.sku, title: product.title, brand: product.brand, quantity: 1 });
    localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(new Event("request-updated"));
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }

  return (
    <button className={full ? "button primary wide" : "card-action"} type="button" onClick={add}>
      {added ? "Добавлено ✓" : full ? "Добавить в заявку" : "В заявку"}
    </button>
  );
}
