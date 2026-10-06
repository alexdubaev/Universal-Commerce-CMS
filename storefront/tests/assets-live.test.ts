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
});
