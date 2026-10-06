import { describe, expect, it } from "vitest";
import { isValidAssetId } from "../lib/assets";
import { slugifyBrand } from "../lib/brands";
import { safeContentHref } from "../lib/content";
import { safeJsonLd } from "../lib/seo";

describe("storefront security helpers", () => {
  it("accepts UUID asset ids and rejects arbitrary paths", () => {
    expect(isValidAssetId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBe(true);
    expect(isValidAssetId("../../etc/passwd")).toBe(false);
    expect(isValidAssetId("not-a-file-id")).toBe(false);
  });

  it("escapes less-than characters in JSON-LD so content cannot close a script tag", () => {
    const json = safeJsonLd({ value: "</script><script>alert(1)</script>" });
    expect(json).not.toContain("<");
    expect(json).toContain("\\u003c/script>");
  });

  it("rejects unsafe CMS navigation/button URLs", () => {
    expect(safeContentHref("javascript:alert(1)")).toBeNull();
    expect(safeContentHref("data:text/html,test")).toBeNull();
    expect(safeContentHref("//evil.example/path")).toBeNull();
    expect(safeContentHref("/catalog")).toBe("/catalog");
    expect(safeContentHref("https://example.com/path")).toBe("https://example.com/path");
    expect(safeContentHref("mailto:sales@example.com")).toBe("mailto:sales@example.com");
  });

  it("creates stable URL slugs for arbitrary future brands", () => {
    expect(slugifyBrand("John Deere")).toBe("john-deere");
    expect(slugifyBrand("  LiuGong / ZF  ")).toBe("liugong-zf");
    expect(slugifyBrand("БелАЗ")).toBe("белаз");
  });
});
