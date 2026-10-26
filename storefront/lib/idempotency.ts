export type IdempotencyState = {
  fingerprint: string;
  key: string;
};

export type PendingSubmission = IdempotencyState;
type SessionStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const unavailableStorage = new Map<string, PendingSubmission>();

export function validateLeadSubmission(scope: "request" | "contact", items: Array<unknown>): string | null {
  return scope === "request" && items.length === 0 ? "Добавьте позиции в корзину перед отправкой заявки." : null;
}

export function requireLeadAcknowledgement(payload: unknown): string {
  if (!payload || typeof payload !== "object" || typeof (payload as { id?: unknown }).id !== "string" || !(payload as { id: string }).id.trim()) {
    throw new Error("Сервис вернул некорректное подтверждение заявки.");
  }
  return (payload as { id: string }).id;
}

export async function fingerprintPayload(payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function ensurePendingSubmission(
  storage: SessionStorageLike | null,
  scope: "request" | "contact",
  payload: unknown,
  createKey: () => string,
): Promise<PendingSubmission> {
  const fingerprint = await fingerprintPayload(payload);
  const storageKey = `smtechno-pending-lead:${scope}`;
  let previous: PendingSubmission | null = null;
  try {
    const raw = storage?.getItem(storageKey);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && typeof (parsed as PendingSubmission).fingerprint === "string" && typeof (parsed as PendingSubmission).key === "string") {
        previous = parsed as PendingSubmission;
      }
    }
  } catch { previous = unavailableStorage.get(storageKey) ?? null; }
  if (!previous) previous = unavailableStorage.get(storageKey) ?? null;
  const pending = ensureIdempotencyKey(previous, fingerprint, createKey);
  unavailableStorage.set(storageKey, pending);
  try { storage?.setItem(storageKey, JSON.stringify(pending)); } catch { /* The memory fallback still protects retries in this page. */ }
  return pending;
}

export function clearPendingSubmission(storage: SessionStorageLike | null, scope: "request" | "contact", fingerprint: string) {
  const storageKey = `smtechno-pending-lead:${scope}`;
  const memory = unavailableStorage.get(storageKey);
  if (memory?.fingerprint === fingerprint) unavailableStorage.delete(storageKey);
  try {
    const raw = storage?.getItem(storageKey);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<PendingSubmission>;
    if (parsed.fingerprint === fingerprint) storage?.removeItem(storageKey);
  } catch { /* Acknowledgement cleanup must not fail because storage is unavailable. */ }
}

export function ensureIdempotencyKey(
  current: IdempotencyState | null,
  fingerprint: string,
  createKey: () => string,
): IdempotencyState {
  if (current && current.fingerprint === fingerprint) return current;
  return { fingerprint, key: createKey() };
}
