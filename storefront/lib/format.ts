export function formatProductPrice(price: number | null | undefined, currency: string | null | undefined) {
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) return "Цена по запросу";
  const code = currency && /^[A-Z]{3}$/.test(currency) ? currency : "RUB";
  try {
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(price);
  } catch {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(price)} ${code}`;
  }
}
