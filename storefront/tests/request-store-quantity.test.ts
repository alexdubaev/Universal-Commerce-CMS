import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_REQUEST_QUANTITY, mergeRequestItems, readRequestItems, writeRequestItems } from "../lib/request-store";
import type { RequestItem } from "../lib/types";

const item = (quantity: number): RequestItem => ({ article: "SKU", title: "Part", brand: "Brand", quantity });

describe("request quantity bounds", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    vi.stubGlobal("localStorage", { getItem: vi.fn(), setItem: vi.fn() });
  });

  it("normalizes stored quantities to finite integers from 1 through the maximum", () => {
    expect(MAX_REQUEST_QUANTITY).toBe(100000);
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify([
      { ...item(1), quantity: 1.8 }, { ...item(2), article: "B", quantity: 100001 },
      { ...item(3), article: "C", quantity: -2 }, { ...item(4), article: "D", quantity: Infinity },
    ]));
    expect(readRequestItems().map(({ quantity }) => quantity)).toEqual([1, MAX_REQUEST_QUANTITY, 1, 1]);
  });

  it("bounds merge inputs and serializes only normalized update values", () => {
    const merged = mergeRequestItems([item(99999)], [item(50.7)]);
    expect(merged[0].quantity).toBe(MAX_REQUEST_QUANTITY);
    writeRequestItems([item(NaN)]);
    expect(JSON.parse(vi.mocked(localStorage.setItem).mock.calls.at(-1)?.[1] ?? "[]")[0].quantity).toBe(1);
  });
});
