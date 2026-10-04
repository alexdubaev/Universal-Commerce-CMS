const directusUrl = process.env.DIRECTUS_URL?.replace(/\/$/, "");
const directusToken = process.env.DIRECTUS_TOKEN;
const mockMode = process.env.STOREFRONT_MOCK_MODE === "true" || !directusUrl;

export function isMockMode() {
  return mockMode;
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
    const message = await response.text().catch(() => "");
    throw new Error(`Directus ${response.status}: ${message.slice(0, 240)}`);
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
