import { afterEach, describe, expect, it, vi } from "vitest";

const environmentKeys = [
  "DIRECTUS_URL",
  "DIRECTUS_TOKEN",
  "STOREFRONT_MOCK_MODE",
  "STOREFRONT_ALLOW_MOCK_FALLBACK",
  "STOREFRONT_DIRECTUS_GATEWAY",
] as const;

const originalEnvironment = new Map(
  environmentKeys.map((key) => [key, process.env[key]]),
);

async function importDirectusWithEnvironment(environment: Record<string, string | undefined>) {
  for (const key of environmentKeys) {
    delete process.env[key];
    const value = environment[key];
    if (value !== undefined) process.env[key] = value;
  }
  vi.resetModules();
  return import("../lib/directus");
}

afterEach(() => {
  for (const key of environmentKeys) {
    const value = originalEnvironment.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("Directus mode configuration", () => {
  it.each([
    ["unset mode without URL", {}, true],
    ["unset mode with URL", { DIRECTUS_URL: "https://cms.example" }, false],
    ["explicit mock mode with URL", { DIRECTUS_URL: "https://cms.example", STOREFRONT_MOCK_MODE: "true" }, true],
    ["explicit mock mode without URL", { STOREFRONT_MOCK_MODE: "true" }, true],
    ["explicit live mode with URL", { DIRECTUS_URL: "https://cms.example", STOREFRONT_MOCK_MODE: "false" }, false],
    ["explicit live mode without URL", { STOREFRONT_MOCK_MODE: "false" }, false],
  ])("uses expected mode for %s", async (_description, environment, expected) => {
    const directus = await importDirectusWithEnvironment(environment);
    expect(directus.isMockMode()).toBe(expected);
  });

  it("rejects live fetches without a URL before making a network request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const directus = await importDirectusWithEnvironment({
      STOREFRONT_MOCK_MODE: "false",
      STOREFRONT_ALLOW_MOCK_FALLBACK: "false",
    });

    expect(directus.isMockMode()).toBe(false);
    await expect(directus.directusFetch("/items/products")).rejects.toThrow("DIRECTUS_URL is not configured");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves upstream errors when mock fallback is disabled", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    const directus = await importDirectusWithEnvironment({
      DIRECTUS_URL: "https://cms.example",
      STOREFRONT_MOCK_MODE: "false",
      STOREFRONT_ALLOW_MOCK_FALLBACK: "false",
    });

    expect(directus.allowMockFallback()).toBe(false);
    await expect(directus.directusFetch("/items/products")).rejects.toMatchObject({
      name: "DirectusRequestError",
      status: 503,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("routes allowlisted requests through the gateway and preserves their query strings", async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ data: [] })));
    vi.stubGlobal("fetch", fetch);
    const directus = await importDirectusWithEnvironment({
      DIRECTUS_URL: "https://cms.example",
      DIRECTUS_TOKEN: "server-secret",
      STOREFRONT_MOCK_MODE: "false",
      STOREFRONT_DIRECTUS_GATEWAY: "true",
    });

    await directus.directusFetch("/items/products?limit=1&filter=%7B%7D");
    await directus.directusFetch("/commerce/search?q=SKU&page=1");
    await directus.directusFetch("/commerce/leads", { method: "POST", body: "{}" });
    await directus.directusFetch("/commerce/orders", { method: "POST", body: "{}" });
    await directus.directusFetch("/server/health");
    await directus.directusAsset("file-id");

    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
      "https://cms.example/commerce/storefront/items/products?limit=1&filter=%7B%7D",
      "https://cms.example/commerce/storefront/search?q=SKU&page=1",
      "https://cms.example/commerce/storefront/leads",
      "https://cms.example/commerce/storefront/orders",
      "https://cms.example/commerce/storefront/health",
      "https://cms.example/commerce/storefront/assets/file-id",
    ]);
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get("Authorization")).toBe("Bearer server-secret");
  });

  it("fails closed for unknown gateway paths without making a network request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const directus = await importDirectusWithEnvironment({
      DIRECTUS_URL: "https://cms.example",
      STOREFRONT_MOCK_MODE: "false",
      STOREFRONT_DIRECTUS_GATEWAY: "true",
    });

    await expect(directus.directusFetch("/items/users?limit=1")).rejects.toThrow(/not allowlisted/);
    expect(fetch).not.toHaveBeenCalled();
  });
});
