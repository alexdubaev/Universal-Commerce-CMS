import { describe, expect, it } from "vitest";
import { subtractAcknowledgedItems } from "../lib/request-acknowledgement";
import type { RequestItem } from "../lib/types";

const item = (article: string, quantity = 1, brand = "Brand"): RequestItem =>
  ({ article, quantity, brand, title: article });

describe("acknowledging a submitted request snapshot", () => {
  it("preserves additions and increments without restoring removed or reduced rows", () => {
    const submitted = [item("SKU-1", 2, " BRAND "), item("B", 5), item("REMOVED")];
    const current = [item("sku1", 5, "brand"), item("B", 3), item("NEW", 4), item("SKU1", 2, "Other")];
    expect(subtractAcknowledgedItems(current, submitted)).toEqual([
      item("sku1", 3, "brand"), item("NEW", 4), item("SKU1", 2, "Other"),
    ]);
  });

  it("consumes duplicate identities once without mutating either snapshot", () => {
    const submitted = [item("A", 2), item("A", 1)];
    const current = [item("A", 2), item("a", 3), item("B")];
    expect(subtractAcknowledgedItems(current, submitted)).toEqual([item("a", 2), item("B")]);
    expect(current.map(({ quantity }) => quantity)).toEqual([2, 3, 1]);
    expect(submitted.map(({ quantity }) => quantity)).toEqual([2, 1]);
  });
});
