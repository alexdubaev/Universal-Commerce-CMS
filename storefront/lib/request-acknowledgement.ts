import { normalizeRequestArticle } from "./request-store";
import type { RequestItem } from "./types";

function identity(item: RequestItem) {
  return JSON.stringify([normalizeRequestArticle(item.article), item.brand.trim().toLocaleLowerCase("ru")]);
}

/** Remove acknowledged quantities without discarding additions or restoring removed rows. */
export function subtractAcknowledgedItems(current: RequestItem[], submitted: RequestItem[]): RequestItem[] {
  const acknowledged = new Map<string, number>();
  for (const item of submitted) {
    const key = identity(item);
    acknowledged.set(key, (acknowledged.get(key) ?? 0) + item.quantity);
  }

  return current.flatMap((item) => {
    const key = identity(item);
    const removed = Math.min(item.quantity, acknowledged.get(key) ?? 0);
    acknowledged.set(key, (acknowledged.get(key) ?? 0) - removed);
    const quantity = item.quantity - removed;
    return quantity > 0 ? [{ ...item, quantity }] : [];
  });
}
