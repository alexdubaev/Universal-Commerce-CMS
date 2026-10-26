export function formatProductPrice(price: number | null | undefined, currency: string | null | undefined) {
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) return "Цена по запросу";
  const code = currency && /^[A-Z]{3}$/.test(currency) ? currency : "RUB";
  try {
    const standardFormatter = new Intl.NumberFormat("ru-RU", { style: "currency", currency: code });
    const fractionDigits = standardFormatter.resolvedOptions().maximumFractionDigits;
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: code,
      minimumFractionDigits: Number.isInteger(price) ? 0 : fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(price);
  } catch {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: Number.isInteger(price) ? 0 : 2 }).format(price)} ${code}`;
  }
}
