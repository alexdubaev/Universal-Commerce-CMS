import { describe, expect, it } from "vitest";
import { readBoundedJson } from "../lib/bounded-json";

function streamedRequest(chunks: Uint8Array[], onCancel: () => void, headers?: HeadersInit) {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) controller.enqueue(chunks[index++]);
      else controller.close();
    },
    cancel() { onCancel(); },
  }, { highWaterMark: 0 });
  return new Request("http://localhost/api", { method: "POST", headers, body, duplex: "half" } as RequestInit);
}

describe("readBoundedJson", () => {
  it("accepts valid JSON when Content-Length is absent", async () => {
    const bytes = new TextEncoder().encode('{"name":"ok"}');
    const result = await readBoundedJson(streamedRequest([bytes], () => undefined), 64);
    expect(result).toEqual({ ok: true, value: { name: "ok" } });
  });

  it("cancels an over-limit stream based on received bytes before parsing", async () => {
    let cancelled = false;
    const result = await readBoundedJson(
      streamedRequest([new Uint8Array(8), new Uint8Array(8), new Uint8Array(8)], () => { cancelled = true; }),
      10,
    );
    expect(result).toEqual({ ok: false, reason: "too-large" });
    expect(cancelled).toBe(true);
  });

  it("counts UTF-8 bytes rather than JavaScript characters", async () => {
    const bytes = new TextEncoder().encode('{"v":"я"}');
    expect(bytes.byteLength).toBeGreaterThan('{"v":"я"}'.length);
    const result = await readBoundedJson(streamedRequest([bytes], () => undefined), bytes.byteLength - 1);
    expect(result).toEqual({ ok: false, reason: "too-large" });
  });

  it("rejects a dishonest small Content-Length when the actual stream exceeds the limit", async () => {
    let cancelled = false;
    const result = await readBoundedJson(
      streamedRequest([new Uint8Array(5), new Uint8Array(6)], () => { cancelled = true; }, { "content-length": "1" }),
      10,
    );
    expect(result).toEqual({ ok: false, reason: "too-large" });
    expect(cancelled).toBe(true);
  });

  it("returns a controlled malformed result for invalid JSON", async () => {
    const result = await readBoundedJson(streamedRequest([new TextEncoder().encode("{")], () => undefined), 64);
    expect(result).toEqual({ ok: false, reason: "malformed" });
  });
});
