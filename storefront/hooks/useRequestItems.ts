"use client";

import { useCallback, useEffect, useState } from "react";
import { REQUEST_STORAGE_KEY, readRequestItems, writeRequestItems } from "@/lib/request-store";
import type { RequestItem } from "@/lib/types";

function useRequestSynchronization(sync: () => void) {
  useEffect(() => {
    sync();
    window.addEventListener("request-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("request-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, [sync]);
}

// The header historically counts raw storage entries, including default quantities
// and numeric coercion. Reading normalized request items would change that contract.
export function readRequestCount() {
  try {
    const items = JSON.parse(localStorage.getItem(REQUEST_STORAGE_KEY) ?? "[]") as Array<{ quantity?: number }>;
    return items.reduce((sum, item) => sum + Number(item.quantity ?? 1), 0);
  } catch {
    return 0;
  }
}

export function useRequestCount() {
  const [requestCount, setRequestCount] = useState(0);
  const sync = useCallback(() => setRequestCount(readRequestCount()), []);
  useRequestSynchronization(sync);
  return requestCount;
}

export function useRequestItems() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const sync = useCallback(() => setItems(readRequestItems()), []);
  useRequestSynchronization(sync);

  const persist = useCallback((next: RequestItem[]) => {
    setItems(next);
    writeRequestItems(next);
  }, []);

  const changeQuantity = useCallback((index: number, delta: number) => {
    const next = items.map((item, itemIndex) => itemIndex === index
      ? { ...item, quantity: Math.max(1, item.quantity + delta) }
      : item);
    persist(next);
  }, [items, persist]);

  const remove = useCallback((index: number) => {
    persist(items.filter((_, itemIndex) => itemIndex !== index));
  }, [items, persist]);

  return { items, persist, changeQuantity, remove };
}
