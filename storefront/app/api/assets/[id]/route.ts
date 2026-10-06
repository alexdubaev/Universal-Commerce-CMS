import { NextResponse } from "next/server";
import { isStorefrontAssetAllowed, storefrontAssetResponsePolicy } from "@/lib/assets";
import { directusAsset, isMockMode } from "@/lib/directus";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  if (isMockMode()) return new NextResponse(null, { status: 404 });
  const { id } = await context.params;

  try {
    if (!(await isStorefrontAssetAllowed(id))) {
      return new NextResponse(null, { status: 404 });
    }

    const upstream = await directusAsset(id);
    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status === 404 ? 404 : 502 });
    }

    const headers = new Headers();
    const policy = storefrontAssetResponsePolicy(upstream.headers.get("content-type"));
    headers.set("content-type", policy.contentType);
    headers.set("content-disposition", policy.contentDisposition);
    headers.set("cache-control", "public, max-age=300, stale-while-revalidate=86400");
    headers.set("x-content-type-options", "nosniff");
    headers.set("cross-origin-resource-policy", "same-origin");
    headers.set("content-security-policy", "sandbox; default-src 'none'");
    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (error) {
    console.error("Asset proxy failed:", error);
    return new NextResponse(null, { status: 502 });
  }
}
