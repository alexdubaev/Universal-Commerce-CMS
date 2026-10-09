import { describe, expect, it } from "vitest";
import { inspectDelimitedText, inspectImportRows, parseDelimitedText, rowsToRequestItems } from "../lib/request-import";
import { MAX_REQUEST_ITEMS, mergeRequestItems } from "../lib/request-store";
import type { RequestItem } from "../lib/types";

const item = (article: string, quantity = 1, brand = "Не указан"): RequestItem =>
  ({ article, quantity, brand, title: article });

describe("request import quantities and identity", () => {
  it("skips CSV headers and preserves quantities with a safe default", () => {
    const rows = parseDelimitedText("Артикул;Количество\nSKU-1;3\nSKU-2;invalid");
    expect(rows.map(({ article, quantity }) => ({ article, quantity }))).toEqual([
      { article: "SKU-1", quantity: 3 }, { article: "SKU-2", quantity: 1 },
    ]);
  });

  it("merges normalized articles without combining distinct explicit brands", () => {
    const current = [item("SKU1", 2, "A"), item("SKU2", 1, "A")];
    const result = mergeRequestItems(current, [item("SKU-1", 3), item("SKU-2", 4, "B")]);
    expect(result).toEqual([item("SKU1", 5, "A"), item("SKU2", 1, "A"), item("SKU-2", 4, "B")]);
    expect(current[0].quantity).toBe(2);
  });

  it("merges at capacity but reports an article that would exceed the limit", () => {
    const current = Array.from({ length: MAX_REQUEST_ITEMS }, (_, i) => item(`SKU${i}`));
    let overflow = false;
    const result = mergeRequestItems(current, [item("SKU-0", 3), item("NEW")], () => { overflow = true; });
    expect(result).toHaveLength(MAX_REQUEST_ITEMS);
    expect(result[0].quantity).toBe(4);
    expect(overflow).toBe(true);
  });
});


describe("request import problem rows", () => {
  it("reports original text row numbers and every adjustment while preserving imported items", () => {
    const result = inspectDelimitedText("Артикул;Количество\n\nOK;3\nBAD;invalid\nBIG;100001\nEXTRA;2;ignored\n;4\nSINGLE");
    expect(result.items.map(({ article, quantity }) => ({ article, quantity }))).toEqual([
      { article: "OK", quantity: 3 }, { article: "BAD", quantity: 1 },
      { article: "BIG", quantity: 100000 }, { article: "EXTRA", quantity: 2 },
      { article: "SINGLE", quantity: 1 },
    ]);
    expect(result.problems).toEqual([
      { row: 4, article: "BAD", reasons: ["quantity_defaulted"] },
      { row: 5, article: "BIG", reasons: ["quantity_clamped"] },
      { row: 6, article: "EXTRA", reasons: ["extra_columns"] },
      { row: 7, article: "", reasons: ["missing_article"] },
    ]);
    expect(parseDelimitedText("Артикул;Количество\n\nOK;3\nBAD;invalid\nBIG;100001\nEXTRA;2;ignored\n;4\nSINGLE")).toEqual(result.items);
  });

  it("reports spreadsheet issues together and skips blank or header rows", () => {
    const rows = [["SKU", "Quantity", "Note"], [], [null, null], ["PART", -2, "comment"], ["DECIMAL", 2.5], ["EMPTY", ""], ["DEFAULT"], ["BIG", 100001], [null, 2]];
    const result = inspectImportRows(rows);
    expect(result.items.map(({ article, quantity }) => ({ article, quantity }))).toEqual([
      { article: "PART", quantity: 1 }, { article: "DECIMAL", quantity: 1 },
      { article: "EMPTY", quantity: 1 }, { article: "DEFAULT", quantity: 1 }, { article: "BIG", quantity: 100000 },
    ]);
    expect(result.problems).toEqual([
      { row: 4, article: "PART", reasons: ["quantity_defaulted", "extra_columns"] },
      { row: 5, article: "DECIMAL", reasons: ["quantity_defaulted"] },
      { row: 6, article: "EMPTY", reasons: ["quantity_defaulted"] },
      { row: 8, article: "BIG", reasons: ["quantity_clamped"] },
      { row: 9, article: "", reasons: ["missing_article"] },
    ]);
    expect(rowsToRequestItems(rows)).toEqual(result.items);
  });
});
