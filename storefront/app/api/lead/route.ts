import { NextRequest, NextResponse } from "next/server";
import { directusFetch, isMockMode } from "@/lib/directus";

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

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Body;
    const company = String(body.company ?? "").trim();
    const message = [company ? `Компания: ${company}` : "", String(body.message ?? "").trim()]
      .filter(Boolean)
      .join("\n\n");

    const lead = {
      name: String(body.name ?? "").trim(),
      phone: String(body.phone ?? "").trim() || null,
      email: String(body.email ?? "").trim() || null,
      message: message || null,
      page_url: /^https?:\/\//.test(String(body.page_url ?? ""))
        ? String(body.page_url)
        : (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
      request_items: Array.isArray(body.request_items) ? body.request_items : [],
    };

    if (lead.name.length < 2 || (!lead.phone && !lead.email)) {
      return NextResponse.json({ error: "Укажите имя и телефон или email." }, { status: 400 });
    }

    const requestKey = body.request_key && uuid.test(body.request_key)
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
    console.error("Lead proxy error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось отправить заявку." },
      { status: 500 },
    );
  }
}
