import { describe, expect, it } from "vitest";
import { isValidAssetId } from "../lib/assets";
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
});
