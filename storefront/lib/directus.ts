const directusUrl = process.env.DIRECTUS_URL?.replace(/\/$/, "");
const directusToken = process.env.DIRECTUS_TOKEN;
const mockMode = process.env.STOREFRONT_MOCK_MODE === "true" || !directusUrl;
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

export async function directusFetch<T>(
  path: string,
  init: DirectusInit = {},
): Promise<T> {
  if (!directusUrl) throw new Error("DIRECTUS_URL is not configured");

  const { revalidate = 60, ...requestInit } = init;
  const headers = new Headers(requestInit.headers);
  headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && requestInit.body) headers.set("Content-Type", "application/json");
  if (directusToken) headers.set("Authorization", `Bearer ${directusToken}`);

  const response = await fetch(`${directusUrl}${path}`, {
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
  return fetch(`${directusUrl}/assets/${encodeURIComponent(id)}`, {
    headers,
    cache: "no-store",
  });
}
