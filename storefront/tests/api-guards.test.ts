import { describe, expect, it } from "vitest";
import { POST } from "../app/api/lead/route";

describe("lead request body boundary", () => {
  it("cancels an oversized stream even when Content-Length understates its bytes", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(512_001)); },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 });
    const request = new Request("http://localhost/api/lead", {
      method: "POST", body, duplex: "half", headers: { "content-length": "1" },
    } as RequestInit);
    const response = await POST(request as never);
    expect(response.status).toBe(413);
    expect(cancelled).toBe(true);
    expect(await response.json()).toEqual({ error: "Заявка слишком большая." });
  });

  it("returns a controlled client error for malformed JSON", async () => {
    const response = await POST(new Request("http://localhost/api/lead", { method: "POST", body: "{" }) as never);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Проверьте данные заявки." });
  });
});
