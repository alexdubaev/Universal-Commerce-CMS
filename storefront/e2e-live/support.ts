import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type FixtureManifest = {
  schema: string;
  runId: string;
  target: string | { url?: string };
  phase: string;
  namedRefs: {
    primaryProductId: string;
    primaryProductSlug: string;
    galleryFileIds: string[];
    publicDocumentFileId: string;
    htmlFileId: string;
    htmlDocumentId: string;
    draftReferencedAssetId: string;
    unreferencedAssetId: string;
    privateAssetId: string;
    documentId: string;
    pageId: string;
    draftProductIds: string[];
    nonIndexableProductId: string;
    nonIndexableProductSlug: string;
  };
  service: { token: string; userId: string; roleId: string; policyId: string };
  publicFolderId: string;
  created: { products: string[]; categories: string[] };
  ownership: {
    products: Record<string, { id: string; slug: string; sku: string; mpn: string; brand: string; status: string }>;
    categories: Record<string, { id: string; slug: string; title: string }>;
  };
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = path.join(repoRoot, "dev", ".storefront-acceptance", "manifest.json");
const cmsUrl = "http://127.0.0.1:18056";

let cached: FixtureManifest | undefined;

export async function manifest(): Promise<FixtureManifest> {
  if (cached) return cached;
  let value: FixtureManifest;
  try {
    value = JSON.parse(await readFile(manifestPath, "utf8")) as FixtureManifest;
  } catch {
    throw new Error("Live acceptance fixture manifest is missing or unreadable.");
  }
  const target = typeof value.target === "string" ? value.target : value.target?.url;
  if (value.schema !== "universal-cms/storefront-acceptance/v1" || target !== cmsUrl
    || value.phase !== "active"
    || typeof value.service?.token !== "string" || !value.service.token
    || !value.service.userId || !value.namedRefs?.primaryProductId
    || !value.namedRefs.primaryProductSlug || !value.namedRefs.nonIndexableProductSlug
    || !value.namedRefs.nonIndexableProductId || !value.namedRefs.publicDocumentFileId
    || !value.namedRefs.htmlFileId || !value.namedRefs.htmlDocumentId
    || !value.namedRefs.draftReferencedAssetId || !value.namedRefs.privateAssetId
    || !value.namedRefs.unreferencedAssetId
    || !Array.isArray(value.namedRefs.galleryFileIds) || !Array.isArray(value.namedRefs.draftProductIds)
    || !Array.isArray(value.created?.products) || !Array.isArray(value.created?.categories)
    || !value.ownership?.products || !value.ownership?.categories) {
    throw new Error("Live acceptance manifest is incomplete or targets an unsupported instance.");
  }
  cached = value;
  return cached;
}

export function directusUrl() {
  return cmsUrl;
}

export function percentile(samples: number[], fraction: number) {
  const ordered = [...samples].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)];
}
