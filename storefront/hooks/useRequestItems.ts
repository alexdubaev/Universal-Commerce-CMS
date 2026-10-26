"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_REQUEST_QUANTITY, REQUEST_STORAGE_KEY, normalizeRequestQuantity, readRequestItems, writeRequestItems } from "@/lib/request-store";
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
    return items.reduce((sum, item) => sum + normalizeRequestQuantity(item.quantity), 0);
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

  const currentItems = useRef(items);
  currentItems.current = items;
  const persist = useCallback((next: RequestItem[] | ((current: RequestItem[]) => RequestItem[])) => {
    const updated = typeof next === "function" ? next(currentItems.current) : next;
    currentItems.current = updated;
    setItems(updated);
    writeRequestItems(updated);
  }, []);

  const changeQuantity = useCallback((index: number, delta: number) => {
    const next = items.map((item, itemIndex) => itemIndex === index
      ? { ...item, quantity: Math.max(1, Math.min(MAX_REQUEST_QUANTITY, item.quantity + delta)) }
      : item);
    persist(next);
  }, [items, persist]);

  const remove = useCallback((index: number) => {
    persist(items.filter((_, itemIndex) => itemIndex !== index));
  }, [items, persist]);

  return { items, persist, changeQuantity, remove };
}
