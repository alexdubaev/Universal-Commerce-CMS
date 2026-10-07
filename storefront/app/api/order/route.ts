import { NextRequest, NextResponse } from "next/server";
import { DirectusRequestError, directusFetch, isMockMode } from "../../../lib/directus";
import { readBoundedJson } from "../../../lib/bounded-json";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 512_000;

export async function POST(request: NextRequest) {
  try {
    const parsed = await readBoundedJson(request, MAX_BODY_BYTES);
    if (!parsed.ok && parsed.reason === "too-large") {
      return NextResponse.json({ error: "Заказ слишком большой." }, { status: 413 });
    }
    if (!parsed.ok || !parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) {
      return NextResponse.json({ error: "Проверьте состав заказа." }, { status: 400 });
    }
    const body = parsed.value as { request_key?: string; order?: unknown; items?: unknown[] };
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) {
      return NextResponse.json({ error: "Проверьте состав заказа." }, { status: 400 });
    }

    const requestKey = body.request_key && UUID.test(body.request_key)
      ? body.request_key
      : crypto.randomUUID();

    if (isMockMode()) {
      return NextResponse.json({ id: `mock-order-${requestKey}`, replayed: false, mock: true });
    }

    const payload = await directusFetch<{ data: { id: string; replayed: boolean } }>("/commerce/orders", {
      method: "POST",
      body: JSON.stringify({
        request_key: requestKey,
        order: body.order,
        items: body.items,
      }),
    });

    return NextResponse.json(payload.data);
  } catch (error) {
    console.error("Order proxy failed:", error);
    if (error instanceof DirectusRequestError && [400, 409, 422].includes(error.status)) {
      return NextResponse.json(
        { error: error.publicMessage || "Проверьте данные заказа." },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Не удалось оформить заказ." }, { status: 502 });
  }
}
