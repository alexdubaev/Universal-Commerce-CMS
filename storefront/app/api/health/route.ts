import { NextResponse } from "next/server";
import { directusFetch, isMockMode } from "@/lib/directus";

export async function GET() {
  if (isMockMode()) return NextResponse.json({ ok: true, source: "mock" });
  try {
    await directusFetch("/server/health", { revalidate: 0 });
    return NextResponse.json({ ok: true, source: "directus" });
  } catch {
    return NextResponse.json({ ok: false, source: "directus" }, { status: 503 });
  }
}
