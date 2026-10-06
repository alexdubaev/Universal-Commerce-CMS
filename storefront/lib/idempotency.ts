export type IdempotencyState = {
  fingerprint: string;
  key: string;
};

export function ensureIdempotencyKey(
  current: IdempotencyState | null,
  fingerprint: string,
  createKey: () => string,
): IdempotencyState {
  if (current && current.fingerprint === fingerprint) return current;
  return { fingerprint, key: createKey() };
}
