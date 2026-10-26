import { NextRequest, NextResponse } from "next/server";
import { getProducts, getSearchSuggestions } from "@/lib/catalog";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const mode = request.nextUrl.searchParams.get("mode");
  if (q.length < 2) return NextResponse.json({ data: [], meta: { total: 0 } });
  if (q.length > 64) return NextResponse.json({ error: "Слишком длинный поисковый запрос." }, { status: 400 });
  if (mode !== null && mode !== "suggestions") return NextResponse.json({ error: "Некорректный режим поиска." }, { status: 400 });
  try {
    if (mode === "suggestions") {
      const data = await getSearchSuggestions(q);
      return NextResponse.json({ data, meta: { total: data.length } }, { headers: { "cache-control": "private, max-age=15" } });
    }
    const result = await getProducts({ q, limit: 10 });
    return NextResponse.json({ data: result.items, meta: { total: result.total, ...(result.partial ? { partial: true } : {}) } }, { headers: { "cache-control": "private, max-age=15" } });
  } catch {
    return NextResponse.json({ error: "Поиск временно недоступен." }, { status: 502 });
  }
}
