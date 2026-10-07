import { describe, expect, it } from "vitest";
import { parseDelimitedText } from "../lib/request-import";
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
