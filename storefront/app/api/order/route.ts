import { NextRequest, NextResponse } from "next/server";
import { directusFetch, isMockMode } from "@/lib/directus";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { request_key?: string; order?: unknown; items?: unknown[] };
    if (isMockMode()) {
      return NextResponse.json({ id: `mock-order-${Date.now()}`, replayed: false, mock: true });
    }

    const payload = await directusFetch<{ data: { id: string; replayed: boolean } }>("/commerce/orders", {
      method: "POST",
      body: JSON.stringify({
        request_key: body.request_key || crypto.randomUUID(),
        order: body.order,
        items: body.items,
      }),
    });

    return NextResponse.json(payload.data);
  } catch (error) {
    console.error("Order proxy error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось оформить заказ." },
      { status: 500 },
    );
  }
}
