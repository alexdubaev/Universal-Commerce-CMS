import { describe, expect, it } from "vitest";
import type { Product, RequestItem } from "@/lib/types";
import { cartLineTotal, cartUnitPrice, resolveCartProduct } from "../components/cart-pricing";

const item: RequestItem = { article: "ab-12", brand: "Acme", title: "Old title", quantity: 3 };
const product = (overrides: Partial<Product> = {}): Product => ({
  id: "1", slug: "part", title: "Current title", sku: "AB 12", brand: "ACME", price: 12.345,
  currency: "USD", price_status: "fixed", availability_status: "in_stock", ...overrides,
});

describe("cart pricing", () => {
  it("matches normalized SKU and brand, without trusting stored title", () => {
    expect(resolveCartProduct(item, [product()])?.title).toBe("Current title");
    expect(resolveCartProduct(item, [product({ brand: "Other" })])).toBeNull();
  });

  it("accepts a blank stored brand only when the SKU is unique", () => {
    const blankBrand = { ...item, brand: "Не указан" };
    expect(resolveCartProduct(blankBrand, [product()])).not.toBeNull();
    expect(resolveCartProduct(blankBrand, [product(), product({ id: "2", brand: "Other" })])).toBeNull();
  });

  it("does not infer uniqueness from a truncated search result", () => {
    expect(resolveCartProduct(item, [product()], 11)).toBeNull();
  });

  it("does not offer unavailable prices and rounds line totals by currency", () => {
    expect(cartUnitPrice(product({ price_status: "hidden" }))).toBeNull();
    expect(cartUnitPrice(product({ price: 0 }))?.amount).toBe(0);
    expect(cartUnitPrice(product({ availability_status: "on_request" }))?.amount).toBe(12.35);
    const unit = cartUnitPrice(product());
    expect(unit && cartLineTotal(unit, 3)).toBe(37.05);
  });
});
