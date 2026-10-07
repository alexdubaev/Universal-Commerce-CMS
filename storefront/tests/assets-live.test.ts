import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  directusFetch: vi.fn(),
}));

vi.mock("../lib/directus", () => ({
  isMockMode: () => false,
  directusFetch: mocks.directusFetch,
}));

import {
  isStorefrontAssetAllowed,
  storefrontAssetResponseHeaders,
  storefrontAssetResponsePolicy,
} from "../lib/assets";

describe("live storefront asset authorization", () => {
  beforeEach(() => {
    mocks.directusFetch.mockReset();
  });

  it("stops after the first published product reference matches", async () => {
    mocks.directusFetch.mockResolvedValueOnce({ data: [{ id: "product-1" }] });

    await expect(
      isStorefrontAssetAllowed("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    ).resolves.toBe(true);
    expect(mocks.directusFetch).toHaveBeenCalledTimes(1);
    expect(String(mocks.directusFetch.mock.calls[0][0])).toContain("/items/products?");
    const productFilter = JSON.parse(
      new URL(String(mocks.directusFetch.mock.calls[0][0]), "http://localhost").searchParams.get("filter")!,
    );
    expect(productFilter._and).toContainEqual({
      _or: [
        { category: { _null: true } },
        { category: { status: { _eq: "published" } } },
      ],
    });
    expect(mocks.directusFetch.mock.calls[0][1]).toEqual({ revalidate: 0 });
  });

  it.each([
    ["product_images", "image"],
    ["product_documents", "file"],
  ])("requires a published or absent product category for %s references", async (collection, referenceField) => {
    mocks.directusFetch.mockResolvedValueOnce({ data: [] });
    if (collection === "product_documents") mocks.directusFetch.mockResolvedValueOnce({ data: [] });
    mocks.directusFetch.mockResolvedValueOnce({ data: [{ id: "child-1" }] });

    await expect(
      isStorefrontAssetAllowed("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    ).resolves.toBe(true);
    const callIndex = collection === "product_images" ? 1 : 2;
    expect(mocks.directusFetch).toHaveBeenCalledTimes(callIndex + 1);
    const [url] = mocks.directusFetch.mock.calls[callIndex];
    expect(String(url)).toContain(`/items/${collection}?`);
    const filter = JSON.parse(new URL(String(url), "http://localhost").searchParams.get("filter")!);
    expect(filter._and).toContainEqual({ [referenceField]: { _eq: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } });
    expect(filter._and).toContainEqual({ product: { status: { _eq: "published" } } });
    expect(filter._and).toContainEqual({
      _or: [
        { product: { category: { _null: true } } },
        { product: { category: { status: { _eq: "published" } } } },
      ],
    });
  });

  it("forces potentially active document types to download", () => {
    expect(storefrontAssetResponsePolicy("text/html; charset=utf-8")).toEqual({
      contentType: "application/octet-stream",
      contentDisposition: "attachment",
    });
    expect(storefrontAssetResponsePolicy("application/javascript")).toEqual({
      contentType: "application/octet-stream",
      contentDisposition: "attachment",
    });
  });

  it("keeps images and PDFs renderable", () => {
    expect(storefrontAssetResponsePolicy("image/png")).toEqual({
      contentType: "image/png",
      contentDisposition: "inline",
    });
    expect(storefrontAssetResponsePolicy("image/svg+xml")).toEqual({
      contentType: "image/svg+xml",
      contentDisposition: "inline",
    });
    expect(storefrontAssetResponsePolicy("application/pdf")).toEqual({
      contentType: "application/pdf",
      contentDisposition: "inline",
    });
  });

  it("requires fresh authorization and sets no-store with existing safety headers", () => {
    expect(storefrontAssetResponseHeaders("image/png")).toEqual({
      "content-type": "image/png",
      "content-disposition": "inline",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "cross-origin-resource-policy": "same-origin",
      "content-security-policy": "sandbox; default-src 'none'",
    });
  });
});
