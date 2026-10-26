import { describe, expect, it } from "vitest";
import { clearPendingSubmission, ensurePendingSubmission, fingerprintPayload, requireLeadAcknowledgement, validateLeadSubmission } from "../lib/idempotency";

function storage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) };
}

describe("reload-safe pending lead keys", () => {
  it("blocks an empty parts RFQ while allowing quick contact without items", () => {
    expect(validateLeadSubmission("request", [])).toBe("Добавьте позиции в корзину перед отправкой заявки.");
    expect(validateLeadSubmission("contact", [])).toBeNull();
    expect(validateLeadSubmission("request", [{ article: "SKU", quantity: 1 }])).toBeNull();
  });

  it("rejects malformed acknowledgements even when HTTP succeeded", () => {
    expect(requireLeadAcknowledgement({ id: "lead-42" })).toBe("lead-42");
    for (const payload of [null, {}, { id: "" }, { id: 42 }]) {
      expect(() => requireLeadAcknowledgement(payload)).toThrow();
    }
  });

  it("reuses a key for a matching payload after remount and replaces it when edits change the payload", async () => {
    const firstTabMount = storage();
    const lead = { name: "Анна", phone: "+7 900 1234567", request_items: [{ article: "SKU", quantity: 2 }] };
    const key1 = await ensurePendingSubmission(firstTabMount, "request", lead, () => "key-1");
    const remounted = await ensurePendingSubmission(firstTabMount, "request", lead, () => "key-2");
    const edited = await ensurePendingSubmission(firstTabMount, "request", { ...lead, message: "Изменение" }, () => "key-3");
    expect(remounted.key).toBe(key1.key);
    expect(edited.key).toBe("key-3");
  });

  it("scopes keys by form and stores only fingerprints and keys, then clears acknowledged state", async () => {
    const saved = storage();
    const payload = { email: "private@example.com" };
    const request = await ensurePendingSubmission(saved, "request", payload, () => "request-key");
    const contact = await ensurePendingSubmission(saved, "contact", payload, () => "contact-key");
    expect(contact.key).not.toBe(request.key);
    const serialized = saved.getItem("smtechno-pending-lead:request") ?? "";
    expect(serialized).not.toContain(payload.email);
    expect(serialized).toContain(await fingerprintPayload(payload));
    clearPendingSubmission(saved, "request", request.fingerprint);
    expect(saved.getItem("smtechno-pending-lead:request")).toBeNull();
    expect(saved.getItem("smtechno-pending-lead:contact")).not.toBeNull();
  });
});
