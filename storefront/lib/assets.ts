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
    return result.data.length > 0;
  } catch {
    return false;
  }
}

export async function isStorefrontAssetAllowed(id: string) {
  if (isMockMode() || !isValidAssetId(id)) return false;

  const [productMain, productImage, productDocument, categoryAsset, settingsResult] = await Promise.all([
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
    directusFetch<{ data: Array<Record<string, unknown>> }>(
      "/items/site_settings?limit=1&fields=logo,favicon,default_og_image,company_image",
      { revalidate: 300 },
    ).catch(() => ({ data: [] })),
  ]);

  if (productMain || productImage || productDocument || categoryAsset) return true;

  const settings = settingsResult.data[0];
  if (!settings) return false;
  return ["logo", "favicon", "default_og_image", "company_image"]
    .some((field) => String(settings[field] ?? "") === id);
}
