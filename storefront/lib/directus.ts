const directusUrl = process.env.DIRECTUS_URL?.replace(/\/$/, "");
const directusToken = process.env.DIRECTUS_TOKEN;
const mockMode = process.env.STOREFRONT_MOCK_MODE === "true" || !directusUrl;

export function isMockMode() {
  return mockMode;
}

export async function directusFetch<T>(
  path: string,
  init: RequestInit & { revalidate?: number } = {},
): Promise<T> {
  if (!directusUrl) throw new Error("DIRECTUS_URL is not configured");

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  if (directusToken) headers.set("Authorization", `Bearer ${directusToken}`);

  const response = await fetch(`${directusUrl}${path}`, {
    ...init,
    headers,
    next: init.method && init.method !== "GET"
      ? undefined
      : { revalidate: init.revalidate ?? 60 },
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
