import { directusFetch, isMockMode } from "./directus";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidAssetId(id: string) {
  return UUID.test(id);
}

async function collectionHasReference(collection: string, filter: Record<string, unknown>) {
  try {
    const params = new URLSearchParams({
      fields: "id",
      limit: "1",
      filter: JSON.stringify(filter),
    });
    const result = await directusFetch<{ data: unknown[] }>(
      `/items/${collection}?${params.toString()}`,
      { revalidate: 300 },
    );
    return Array.isArray(result.data) && result.data.length > 0;
  } catch {
    return false;
  }
}

function singletonRow(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    const first = data[0];
    return first && typeof first === "object" ? first as Record<string, unknown> : null;
  }
  return data && typeof data === "object" ? data as Record<string, unknown> : null;
}

export async function isStorefrontAssetAllowed(id: string) {
  if (isMockMode() || !isValidAssetId(id)) return false;

  const [
    productMain,
    productImage,
    productDocument,
    categoryAsset,
    pageAsset,
    pageSectionAsset,
    homeSectionAsset,
    homeResult,
    settingsResult,
  ] = await Promise.all([
    collectionHasReference("products", {
      _and: [{ status: { _eq: "published" } }, { main_image: { _eq: id } }],
    }),
    collectionHasReference("product_images", {
      _and: [
        { status: { _eq: "published" } },
        { image: { _eq: id } },
        { product: { status: { _eq: "published" } } },
      ],
    }),
    collectionHasReference("product_documents", {
      _and: [
        { status: { _eq: "published" } },
        { file: { _eq: id } },
        { product: { status: { _eq: "published" } } },
      ],
    }),
    collectionHasReference("categories", {
      _and: [
        { status: { _eq: "published" } },
        {
          _or: [
            { image: { _eq: id } },
            { icon: { _eq: id } },
            { og_image: { _eq: id } },
          ],
        },
      ],
    }),
    collectionHasReference("pages", {
      _and: [{ status: { _eq: "published" } }, { og_image: { _eq: id } }],
    }),
    collectionHasReference("page_sections", {
      _and: [
        { status: { _eq: "published" } },
        { is_visible: { _eq: true } },
        { image: { _eq: id } },
        { page: { status: { _eq: "published" } } },
      ],
    }),
    collectionHasReference("page_sections", {
      _and: [
        { status: { _eq: "published" } },
        { is_visible: { _eq: true } },
        { image: { _eq: id } },
        { home_page: { status: { _eq: "published" } } },
      ],
    }),
    directusFetch<{ data: unknown }>(
      "/items/home_page?fields=status,hero_image,og_image",
      { revalidate: 300 },
    ).catch(() => ({ data: null })),
    directusFetch<{ data: unknown }>(
      "/items/site_settings?fields=logo,favicon,default_og_image,company_image",
      { revalidate: 300 },
    ).catch(() => ({ data: null })),
  ]);

  if (productMain || productImage || productDocument || categoryAsset || pageAsset || pageSectionAsset || homeSectionAsset) {
    return true;
  }

  const home = singletonRow(homeResult.data);
  if (home?.status === "published" && ["hero_image", "og_image"].some((field) => String(home[field] ?? "") === id)) {
    return true;
  }

  const settings = singletonRow(settingsResult.data);
  if (!settings) return false;
  return ["logo", "favicon", "default_og_image", "company_image"]
    .some((field) => String(settings[field] ?? "") === id);
}
