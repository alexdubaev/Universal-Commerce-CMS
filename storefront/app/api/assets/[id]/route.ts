import { NextResponse } from "next/server";
import { directusAsset, isMockMode } from "@/lib/directus";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  if (isMockMode()) return new NextResponse(null, { status: 404 });
  const { id } = await context.params;

  try {
    const upstream = await directusAsset(id);
    if (!upstream.ok) return new NextResponse(null, { status: upstream.status });

    const headers = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    headers.set("cache-control", "public, max-age=300, stale-while-revalidate=86400");
    return new NextResponse(upstream.body, { status: 200, headers });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
