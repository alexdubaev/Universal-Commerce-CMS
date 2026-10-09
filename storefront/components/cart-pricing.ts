import type { Product, RequestItem } from "@/lib/types";

export function normalizeSku(value: string) {
  return value.trim().toLocaleUpperCase("en").replace(/[^A-Z0-9А-ЯЁ]/g, "");
}

export function resolveCartProduct(item: RequestItem, products: Product[], total = products.length): Product | null {
  // A partial search page cannot prove that this SKU and brand are unique.
  if (total !== products.length) return null;
  const sku = normalizeSku(item.article);
  if (!sku) return null;
  const exact = products.filter((product) => normalizeSku(product.sku) === sku);
  if (item.brand.trim() && item.brand.trim().toLocaleLowerCase("ru") !== "не указан") {
    const matches = exact.filter((product) => product.brand.trim().toLocaleLowerCase("ru") === item.brand.trim().toLocaleLowerCase("ru"));
    return matches.length === 1 ? matches[0] : null;
  }
  return exact.length === 1 ? exact[0] : null;
}

export function cartUnitPrice(product: Product | null) {
  if (!product || product.price_status !== "fixed" || product.price == null || !Number.isFinite(product.price) || product.price < 0) return null;
  const currency = product.currency?.trim() || "RUB";
  try {
    const formatter = new Intl.NumberFormat("ru-RU", { style: "currency", currency });
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    const factor = 10 ** digits;
    return { amount: Math.round((product.price + Number.EPSILON) * factor) / factor, currency, formatter };
  } catch {
    return null;
  }
}

export function cartLineTotal(unit: NonNullable<ReturnType<typeof cartUnitPrice>>, quantity: number) {
  const factor = 10 ** (unit.formatter.resolvedOptions().maximumFractionDigits ?? 2);
  return Math.round((unit.amount * quantity + Number.EPSILON) * factor) / factor;
}
