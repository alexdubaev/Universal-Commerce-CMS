import type { RequestItem } from "./types";

export const REQUEST_STORAGE_KEY = "smtechno-request";
export const MAX_REQUEST_ITEMS = 100;
export const MAX_REQUEST_QUANTITY = 100000;

export function normalizeRequestQuantity(value: unknown) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return 1;
  return Math.max(1, Math.min(MAX_REQUEST_QUANTITY, Math.floor(quantity)));
}

export function normalizeRequestArticle(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9А-ЯЁ]+/g, "");
}

function normalizeBrand(value: string) {
  return value.trim().toLocaleLowerCase("ru");
}

function unknownBrand(value: string) {
  return !value.trim() || normalizeBrand(value) === normalizeBrand("Не указан");
}

export function readRequestItems(): RequestItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(REQUEST_STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is RequestItem => Boolean(item && typeof item === "object" && "article" in item))
      .map((item) => ({
        article: String(item.article ?? "").trim(),
        title: String(item.title ?? "Позиция из списка"),
        brand: String(item.brand ?? "Не указан"),
        quantity: normalizeRequestQuantity(item.quantity),
      }))
      .filter((item) => item.article)
      .slice(0, MAX_REQUEST_ITEMS);
  } catch {
    return [];
  }
}

export function writeRequestItems(items: RequestItem[]) {
  if (typeof window === "undefined") return;
  try {
    const normalized = items.slice(0, MAX_REQUEST_ITEMS).filter((item) => normalizeRequestArticle(item.article)).map((item) => ({
      ...item,
      article: String(item.article).trim(),
      quantity: normalizeRequestQuantity(item.quantity),
    }));
    localStorage.setItem(REQUEST_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new Event("request-updated"));
  } catch { /* The in-memory selection remains usable when storage is denied. */ }
}

export function mergeRequestItems(current: RequestItem[], incoming: RequestItem[], onOverflow?: () => void) {
  const result = current.slice(0, MAX_REQUEST_ITEMS).map((item) => ({ ...item, quantity: normalizeRequestQuantity(item.quantity) }));

  for (const item of incoming) {
    const articleKey = normalizeRequestArticle(item.article);
    if (!articleKey) continue;

    const sameArticle = result.filter((candidate) => normalizeRequestArticle(candidate.article) === articleKey);
    let existing: RequestItem | undefined;

    if (unknownBrand(item.brand)) {
      if (sameArticle.length === 1) existing = sameArticle[0];
      else existing = sameArticle.find((candidate) => unknownBrand(candidate.brand));
    } else {
      existing = sameArticle.find((candidate) => normalizeBrand(candidate.brand) === normalizeBrand(item.brand));
    }

    if (existing) {
      existing.quantity = normalizeRequestQuantity(existing.quantity + normalizeRequestQuantity(item.quantity));
      continue;
    }

    if (result.length >= MAX_REQUEST_ITEMS) {
      onOverflow?.();
      break;
    }
    result.push({ ...item, quantity: normalizeRequestQuantity(item.quantity) });
  }

  return result;
}
