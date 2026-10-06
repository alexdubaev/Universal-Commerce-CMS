import { NextRequest, NextResponse } from "next/server";
import { DirectusRequestError, directusFetch, isMockMode } from "../../../lib/directus";
import { readBoundedJson } from "../../../lib/bounded-json";

type Body = {
  request_key?: string;
  company?: string;
  name?: string;
  phone?: string;
  email?: string;
  message?: string;
  page_url?: string;
  request_items?: Array<{ article: string; quantity: number }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 512_000;

function publicDirectusError(error: DirectusRequestError) {
  if ([400, 409, 422].includes(error.status)) {
    return NextResponse.json(
      { error: error.publicMessage || "Проверьте данные заявки." },
      { status: error.status },
    );
  }
  return NextResponse.json({ error: "Сервис заявок временно недоступен." }, { status: 502 });
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await readBoundedJson(request, MAX_BODY_BYTES);
    if (!parsed.ok && parsed.reason === "too-large") {
      return NextResponse.json({ error: "Заявка слишком большая." }, { status: 413 });
    }
    if (!parsed.ok || !parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) {
      return NextResponse.json({ error: "Проверьте данные заявки." }, { status: 400 });
    }
    const body = parsed.value as Body;

    const company = String(body.company ?? "").trim();
    const message = [company ? `Компания: ${company}` : "", String(body.message ?? "").trim()]
      .filter(Boolean)
      .join("\n\n");

    const requestItems = Array.isArray(body.request_items) ? body.request_items : [];
    if (requestItems.length > 100) {
      return NextResponse.json({ error: "В одной заявке можно отправить не более 100 позиций." }, { status: 400 });
    }

    const lead = {
      name: String(body.name ?? "").trim(),
      phone: String(body.phone ?? "").trim() || null,
      email: String(body.email ?? "").trim() || null,
      message: message || null,
      page_url: /^https?:\/\//.test(String(body.page_url ?? ""))
        ? String(body.page_url)
        : (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
      request_items: requestItems,
    };

    if (lead.name.length < 2 || (!lead.phone && !lead.email)) {
      return NextResponse.json({ error: "Укажите имя и телефон или email." }, { status: 400 });
    }

    const requestKey = body.request_key && UUID.test(body.request_key)
      ? body.request_key
      : crypto.randomUUID();

    if (isMockMode()) {
      return NextResponse.json({ id: `mock-${requestKey}`, replayed: false, mock: true });
    }

    const payload = await directusFetch<{ data: { id: string; replayed: boolean } }>("/commerce/leads", {
      method: "POST",
      body: JSON.stringify({
        request_key: requestKey,
        lead,
        attachments: [],
        attachment_manifest: [],
        action: "create",
      }),
    });

    return NextResponse.json(payload.data);
  } catch (error) {
    console.error("Lead proxy failed:", error);
    if (error instanceof DirectusRequestError) return publicDirectusError(error);
    return NextResponse.json({ error: "Не удалось отправить заявку." }, { status: 500 });
  }
}
