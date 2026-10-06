export type BoundedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "too-large" | "malformed" };

/** Read and parse a JSON request body while enforcing a limit on received bytes. */
export async function readBoundedJson(request: Request, maxBytes: number): Promise<BoundedJsonResult> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    await request.body?.cancel().catch(() => undefined);
    return { ok: false, reason: "too-large" };
  }

  if (!request.body) return { ok: false, reason: "malformed" };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: "too-large" };
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, reason: "malformed" };
  } finally {
    reader.releaseLock();
  }
}
