import type { RequestItem } from "./types";

export type ImportRow = Array<string | number | boolean | Date | null | undefined>;
export type ImportProblemReason = "quantity_defaulted" | "quantity_clamped" | "extra_columns" | "missing_article";
export type ImportProblem = { row: number; article: string; reasons: ImportProblemReason[] };
export type ImportResult = { items: RequestItem[]; problems: ImportProblem[] };

function articleFrom(value: unknown) {
  return String(value ?? "").trim();
}

function quantityFrom(value: unknown): { quantity: number; reason?: ImportProblemReason } {
  const parsed = Number(String(value ?? "").replace(",", "."));
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { quantity: 1, reason: value === undefined ? undefined : "quantity_defaulted" };
  }
  return { quantity: Math.min(parsed, 100_000), reason: parsed > 100_000 ? "quantity_clamped" : undefined };
}

export function inspectImportRows(rows: ImportRow[]): ImportResult {
  const items: RequestItem[] = [];
  const problems: ImportProblem[] = [];
  rows.forEach((row, index) => {
    const article = articleFrom(row[0]);
    if (!article) {
      if (row.some((cell) => articleFrom(cell))) problems.push({ row: index + 1, article: "", reasons: ["missing_article"] });
      return;
    }
    const lower = article.toLowerCase();
    if (["артикул", "article", "sku", "part number", "part_number"].includes(lower)) return;
    const { quantity, reason } = quantityFrom(row[1]);
    const reasons: ImportProblemReason[] = reason ? [reason] : [];
    if (row.slice(2).some((cell) => articleFrom(cell))) reasons.push("extra_columns");
    if (reasons.length) problems.push({ row: index + 1, article, reasons });
    items.push({ article, quantity, title: "Позиция из списка", brand: "Не указан" });
  });
  return { items, problems };
}

export function rowsToRequestItems(rows: ImportRow[]): RequestItem[] {
  return inspectImportRows(rows).items;
}

export function inspectDelimitedText(text: string): ImportResult {
  const rows: ImportRow[] = text.split(/\r?\n/).map((rawLine) => {
    const line = rawLine.trim();
    if (!line) return [];
    const delimiter = line.includes("\t") ? "\t" : line.includes(";") ? ";" : line.includes(",") ? "," : null;
    if (delimiter) return line.split(delimiter).map((cell) => cell.trim());
    const match = line.match(/^(.*?)(?:\s+(\d+))?$/);
    return [match?.[1]?.trim() ?? line, match?.[2] ?? 1];
  });
  return inspectImportRows(rows);
}

export function parseDelimitedText(text: string): RequestItem[] {
  return inspectDelimitedText(text).items;
}
