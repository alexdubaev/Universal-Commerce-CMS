import { describe, expect, it, vi } from "vitest";
import { MAX_REQUEST_ITEMS, mergeRequestItems } from "../lib/request-store";
import type { RequestItem } from "../lib/types";

function item(article: string, brand = "Не указан", quantity = 1): RequestItem {
  return { article, brand, quantity, title: article };
}

describe("bounded request import overflow", () => {
  it("reports dropped rows when importing more than 100 unique articles", () => {
    const dropped = vi.fn();
    const incoming = Array.from({ length: 101 }, (_, index) => item(`SKU${index}`));
    const result = mergeRequestItems([], incoming, dropped);
    expect(result).toHaveLength(MAX_REQUEST_ITEMS);
    expect(dropped).toHaveBeenCalledTimes(1);
  });

  it("merges duplicates at capacity without reporting an overflow", () => {
    const dropped = vi.fn();
    const current = Array.from({ length: 100 }, (_, index) => item(`SKU${index}`, "Brand"));
    const result = mergeRequestItems(current, [item("SKU-0", "Не указан", 3)], dropped);
    expect(result).toHaveLength(100);
    expect(result[0].quantity).toBe(4);
    expect(dropped).not.toHaveBeenCalled();
  });

  it("preserves the existing stop at the first overflowing article", () => {
    const dropped = vi.fn();
    const current = Array.from({ length: 100 }, (_, index) => item(`SKU${index}`, "Brand"));
    const result = mergeRequestItems(current, [item("NEW"), item("SKU-0", "Brand", 2)], dropped);
    expect(result).toHaveLength(100);
    expect(result[0].quantity).toBe(1);
    expect(dropped).toHaveBeenCalledTimes(1);
  });

  it("reports ambiguous unknown-brand rows that cannot merge at capacity", () => {
    const dropped = vi.fn();
    const current = [item("SAME", "A"), item("SAME", "B"),
      ...Array.from({ length: 98 }, (_, index) => item(`SKU${index}`))];
    const result = mergeRequestItems(current, [item("SAME")], dropped);
    expect(result.slice(0, 2).map(({ quantity }) => quantity)).toEqual([1, 1]);
    expect(dropped).toHaveBeenCalledTimes(1);
  });
});
