import { NextRequest, NextResponse } from "next/server";
import { getProducts } from "@/lib/catalog";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ data: [], meta: { total: 0 } });
  const result = await getProducts({ q, limit: 10 });
  return NextResponse.json({ data: result.items, meta: { total: result.total, source: result.source } });
}
