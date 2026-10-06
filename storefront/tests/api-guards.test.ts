import { beforeEach, describe, expect, it, vi } from "vitest";

const { directusFetch } = vi.hoisted(() => ({ directusFetch: vi.fn() }));

vi.mock("../lib/directus", async () => {
  const actual = await vi.importActual<typeof import("../lib/directus")>("../lib/directus");
  return { ...actual, directusFetch, isMockMode: () => false };
});

import { POST as submitLead } from "../app/api/lead/route";
import { POST as submitOrder } from "../app/api/order/route";

function oversizedRequest() {
  const chunk = new Uint8Array(512_001);
  let sent = false;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent) controller.close();
      else {
        sent = true;
        controller.enqueue(chunk);
      }
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const request = new Request("http://localhost/api", { method: "POST", body, duplex: "half" } as RequestInit);
  return { request, wasCancelled: () => cancelled };
}

describe("commerce API body guards", () => {
  beforeEach(() => directusFetch.mockReset());

  it.each([
    ["lead", submitLead, "Заявка слишком большая."],
    ["order", submitOrder, "Заказ слишком большой."],
  ])("rejects oversized %s streams before calling Directus", async (_name, post, error) => {
    const { request, wasCancelled } = oversizedRequest();
    const response = await post(request as never);
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error });
    expect(wasCancelled()).toBe(true);
    expect(directusFetch).not.toHaveBeenCalled();
  });

  it("returns a controlled 400 for malformed lead JSON", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: "{",
      headers: { "content-type": "application/json" },
    });
    const response = await submitLead(request as never);
    expect(response.status).toBe(400);
    expect(directusFetch).not.toHaveBeenCalled();
  });
});
