import type { RequestItem } from "./types";

export type ImportRow = Array<string | number | boolean | Date | null | undefined>;

function articleFrom(value: unknown) {
  return String(value ?? "").trim();
}

function quantityFrom(value: unknown) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100_000) : 1;
}

export function rowsToRequestItems(rows: ImportRow[]): RequestItem[] {
  const items: RequestItem[] = [];
  for (const row of rows) {
    const article = articleFrom(row[0]);
    if (!article) continue;
    const lower = article.toLowerCase();
    if (["артикул", "article", "sku", "part number", "part_number"].includes(lower)) continue;
    items.push({
      article,
      quantity: quantityFrom(row[1]),
      title: "Позиция из списка",
      brand: "Не указан",
    });
  }
  return items;
}

export function parseDelimitedText(text: string): RequestItem[] {
  const rows: ImportRow[] = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const delimiter = line.includes("\t") ? "\t" : line.includes(";") ? ";" : line.includes(",") ? "," : null;
      if (delimiter) return line.split(delimiter).map((cell) => cell.trim());
      const match = line.match(/^(.*?)(?:\s+(\d+))?$/);
      return [match?.[1]?.trim() ?? line, match?.[2] ?? 1];
    });
  return rowsToRequestItems(rows);
}
