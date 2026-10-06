import { describe, expect, it, vi } from "vitest";
import { ensureIdempotencyKey } from "../lib/idempotency";

describe("client idempotency key rotation", () => {
  it("reuses the key for an identical retry", () => {
    const create = vi.fn(() => "key-1");
    const first = ensureIdempotencyKey(null, "payload-a", create);
    const retry = ensureIdempotencyKey(first, "payload-a", create);

    expect(retry).toBe(first);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("rotates the key when the payload changes", () => {
    const values = ["key-1", "key-2"];
    const create = vi.fn(() => values.shift() || "key-x");
    const first = ensureIdempotencyKey(null, "payload-a", create);
    const edited = ensureIdempotencyKey(first, "payload-b", create);

    expect(first.key).toBe("key-1");
    expect(edited.key).toBe("key-2");
    expect(edited.fingerprint).toBe("payload-b");
  });
});
