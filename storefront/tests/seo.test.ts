import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("site URL configuration", () => {
  it("uses localhost only when explicit mock mode has no configured URL", async () => {
    vi.stubEnv("STOREFRONT_MOCK_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const seo = await import("../lib/seo");
    expect(seo.getSiteUrl().origin).toBe("http://localhost:3000");
  });

  it("fails clearly for a malformed configured live URL", async () => {
    vi.stubEnv("STOREFRONT_MOCK_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com/not-a-site-root");
    const seo = await import("../lib/seo");
    expect(() => seo.getSiteUrl()).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("fails clearly when live mode has no configured site URL", async () => {
    vi.stubEnv("STOREFRONT_MOCK_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const seo = await import("../lib/seo");
    expect(() => seo.getSiteUrl()).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("rejects localhost as a live canonical origin", async () => {
    vi.stubEnv("STOREFRONT_MOCK_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    const seo = await import("../lib/seo");
    expect(() => seo.getSiteUrl()).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });
});
