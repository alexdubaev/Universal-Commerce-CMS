const directusUrl = process.env.DIRECTUS_URL?.replace(/\/$/, "");
const directusToken = process.env.DIRECTUS_TOKEN;
const useStorefrontGateway = process.env.STOREFRONT_DIRECTUS_GATEWAY === "true";
const configuredMockMode = process.env.STOREFRONT_MOCK_MODE;
const mockMode = configuredMockMode === "true" || (configuredMockMode !== "false" && !directusUrl);
const mockFallback = process.env.STOREFRONT_ALLOW_MOCK_FALLBACK === "true";

export class DirectusRequestError extends Error {
  status: number;
  publicMessage: string | null;

  constructor(status: number, publicMessage: string | null = null) {
    super(`Directus request failed with status ${status}`);
    this.name = "DirectusRequestError";
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

export function isMockMode() {
  return mockMode;
}

export function allowMockFallback() {
  return mockFallback;
}

type DirectusInit = RequestInit & { revalidate?: number };

const gatewayCollections = new Set([
  "categories",
  "home_page",
  "navigation_items",
  "pages",
  "product_codes",
  "product_documents",
  "product_images",
  "product_specifications",
  "products",
  "products_analogs",
  "site_settings",
]);

function gatewayPath(path: string) {
  const match = /^(\/[^?#]*)([?#].*)?$/.exec(path);
  const pathname = match?.[1];
  const suffix = match?.[2] ?? "";
  if (!pathname) throw new Error("Directus gateway path is not allowlisted");

  const collection = /^\/items\/([a-z_]+)$/.exec(pathname)?.[1];
  if (collection && gatewayCollections.has(collection)) {
    return `/commerce/storefront/items/${collection}${suffix}`;
  }
  const routes: Record<string, string> = {
    "/commerce/search": "/commerce/storefront/search",
    "/commerce/leads": "/commerce/storefront/leads",
    "/commerce/orders": "/commerce/storefront/orders",
    "/server/health": "/commerce/storefront/health",
  };
  const target = routes[pathname];
  if (target) return `${target}${suffix}`;
  throw new Error("Directus gateway path is not allowlisted");
}

export async function directusFetch<T>(
  path: string,
  init: DirectusInit = {},
): Promise<T> {
  if (!directusUrl) throw new Error("DIRECTUS_URL is not configured");

  const { revalidate = 60, ...requestInit } = init;
  const requestPath = useStorefrontGateway ? gatewayPath(path) : path;
  const headers = new Headers(requestInit.headers);
  headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && requestInit.body) headers.set("Content-Type", "application/json");
  if (directusToken) headers.set("Authorization", `Bearer ${directusToken}`);

  const response = await fetch(`${directusUrl}${requestPath}`, {
    ...requestInit,
    headers,
    next: requestInit.method && requestInit.method !== "GET"
      ? undefined
      : { revalidate },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let publicMessage: string | null = null;

    if (response.status < 500 && text) {
      try {
        const parsed = JSON.parse(text) as { errors?: Array<{ message?: unknown }> };
        const message = parsed.errors?.[0]?.message;
        if (typeof message === "string" && message.length <= 500) publicMessage = message;
      } catch {
        publicMessage = null;
      }
    }

    throw new DirectusRequestError(response.status, publicMessage);
  }

  return response.json() as Promise<T>;
}

export async function directusAsset(id: string) {
  if (!directusUrl) throw new Error("DIRECTUS_URL is not configured");
  const headers = new Headers();
  if (directusToken) headers.set("Authorization", `Bearer ${directusToken}`);
  const path = useStorefrontGateway
    ? `/commerce/storefront/assets/${encodeURIComponent(id)}`
    : `/assets/${encodeURIComponent(id)}`;
  return fetch(`${directusUrl}${path}`, {
    headers,
    cache: "no-store",
  });
}
