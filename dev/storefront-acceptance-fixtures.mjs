import { randomUUID, randomBytes } from 'node:crypto';
import { resolve, sep } from 'node:path';

export const LOCAL_URL = 'http://127.0.0.1:18056';
export const PRIVATE_DIR_NAME = '.storefront-acceptance';
export const FIXTURE_SCHEMA = 'universal-cms/storefront-acceptance/v1';
export const COLLECTIONS = Object.freeze([
  'directus_access', 'directus_folders', 'directus_files', 'directus_policies', 'directus_roles',
  'directus_users', 'categories', 'products', 'product_codes', 'products_analogs',
  'product_images', 'product_specifications', 'product_documents', 'pages',
  'page_sections', 'navigation_items',
]);
const GUARDED_DELETE_COLLECTIONS = new Set([
  'categories', 'products', 'product_codes', 'products_analogs', 'product_images',
  'product_specifications', 'product_documents', 'pages', 'page_sections',
]);

const slug = value => String(value).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function assertLocalTarget(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error('DIRECTUS_URL must be the approved local endpoint'); }
  if (url.origin !== LOCAL_URL || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('DIRECTUS_URL must be exactly http://127.0.0.1:18056');
  }
  return url.origin;
}

const DIRECTUS_SYSTEM_ENDPOINTS = Object.freeze({ directus_folders: '/folders', directus_files: '/files', directus_users: '/users', directus_roles: '/roles', directus_policies: '/policies', directus_access: '/access' });
export function collectionEndpoint(collection) { return DIRECTUS_SYSTEM_ENDPOINTS[collection] ?? `/items/${collection}`; }
export function readCollectionRows(client, collection, query) { return client.request(`${collectionEndpoint(collection)}?${query}`); }

export function safeManifestDirectory(root) {
  if (typeof root !== 'string' || !root.trim()) throw new Error('An explicit integration root is required');
  const base = resolve(root);
  const target = resolve(base, 'dev', PRIVATE_DIR_NAME);
  if (!target.startsWith(`${base}${sep}`)) throw new Error('Private manifest directory must stay inside the integration checkout');
  return target;
}

export function createFixturePlan({ runId = randomUUID(), random = randomUUID } = {}) {
  if (!uuidPattern.test(runId)) throw new Error('runId must be a UUID');
  const brands = ['Fixture Works', 'Sample Mechanics', 'Neutral Parts Lab'];
  const categories = ['fixture-components', 'sample-tools', 'neutral-materials'].map((value, index) => ({
    id: random(), slug: `acceptance-${runId.slice(0, 8)}-${value}`,
    title: `Synthetic ${['Components', 'Tools', 'Materials'][index]}`, status: 'published', is_indexable: true,
  }));
  const products = Array.from({ length: 15 }, (_, index) => {
    const variant = index === 3;
    const row = {
      id: random(),
      slug: `acceptance-${runId.slice(0, 8)}-item-${String(index + 1).padStart(2, '0')}`,
      title: variant ? `Synthetic fixture assembly ${'extended '.repeat(22)}wide model — ${index + 1}` : `Synthetic test part ${String(index + 1).padStart(2, '0')}`,
      sku: variant ? `FX-${runId.slice(0, 8)}-VARIANT-LONG-SKU-0003` : `FX-${runId.slice(0, 8)}-${String(index + 1).padStart(4, '0')}`,
      brand: brands[index % brands.length], category: categories[index % categories.length].id,
      mpn: `MPN-FX-${runId.slice(0, 8)}-${String(index + 1).padStart(4, '0')}`,
      currency: 'RUB', status: 'published', price_status: ['fixed', 'on_request', 'hidden'][index % 3],
      availability_status: ['in_stock', 'on_request', 'out_of_stock'][index % 3],
      price: index % 3 === 0 ? 1234.5 + index : null,
      part_type: ['original', 'oem', 'analog'][index % 3],
      is_indexable: index !== 14, source_name: 'synthetic acceptance fixture',
    };
    if (index === 0) Object.assign(row, { gallery: [{ id: 'synthetic-gallery-placeholder', alt: 'Generated synthetic gallery image' }], specifications: [{ name: 'Fixture dimension', value: '12 mm' }], documents: [{ title: 'Synthetic datasheet', name: 'fixture.pdf' }] });
    return row;
  });
  const drafts = [0, 1].map(index => ({
    id: random(), slug: `acceptance-${runId.slice(0, 8)}-draft-${index + 1}`,
    title: `Synthetic draft parent ${index + 1}`, sku: `FX-${runId.slice(0, 8)}-DRAFT-${index + 1}`,
    brand: brands[index], currency: 'RUB', price_status: 'hidden', availability_status: 'on_request', status: 'draft',
  }));
  const draftImageId = random();
  const children = drafts.map((parent, index) => ({
    parent: parent.id,
    specification: { id: random(), name: 'Draft-only fixture field', value: 'must remain private', status: 'draft', sort_order: 1 },
    image: { id: random(), image: draftImageId, alt_text: 'Draft-only generated image', status: index === 0 ? 'published' : 'draft', sort_order: 1 },
  }));
  const page = { id: random(), slug: `acceptance-${runId.slice(0, 8)}-content-page`, title: 'Synthetic acceptance page', h1: 'Synthetic test page', page_type: 'standard', status: 'published' };
  const sections = [{ id: random(), page: page.id, section_type: 'text', title: 'Fixture section', text: 'Synthetic acceptance content.', status: 'published', is_visible: true, sort_order: 1 }];
  const navigation = ['header', 'footer', 'legal'].map((location, index) => ({ id: random(), label: `Synthetic ${location} link`, url: page.slug, location, status: 'published', is_visible: true, sort_order: index + 1 }));
  return { runId, brands, categories, products, drafts, children, page, sections, navigation, assets: ['fixture-gallery.png', 'fixture-home.png', 'fixture-draft-only.png', 'fixture-unreferenced.png', 'fixture-document.html', 'fixture-public.pdf', 'fixture-private.pdf'] };
}

export function makeOwnershipManifest(runId, target = LOCAL_URL) {
  return {
    schema: FIXTURE_SCHEMA,
    runId,
    target: assertLocalTarget(target),
    createdAt: new Date().toISOString(),
    created: Object.fromEntries(COLLECTIONS.map(name => [name, []])),
    pending: Object.fromEntries(COLLECTIONS.map(name => [name, {}])),
    ownership: Object.fromEntries(COLLECTIONS.map(name => [name, {}])),
    namedRefs: {
      primaryProductId: null,
      primaryProductSlug: null,
      galleryFileIds: [],
      documentId: null,
      documentFileId: null,
      publicDocumentFileId: null,
      draftReferencedAssetId: null,
      unreferencedAssetId: null,
      htmlDocumentId: null,
      htmlFileId: null,
      privateAssetId: null,
      privateFolderId: null,
      privateDocumentId: null,
      draftProductIds: [],
      nonIndexableProductId: null,
      nonIndexableProductSlug: null,
      pageId: null,
      pageSlug: null,
      homeImageId: null,
      childProbeProductId: null,
      childProbeSpecificationId: null,
      sectionProbePageId: null,
      sectionProbeId: null,
    },
    original: {},
    service: { token: null, userId: null, roleId: null, policyId: null },
    publicFolderId: null,
    childCreateVerified: false,
    sectionCreateVerified: null,
    sectionProbeOutcome: null,
    phase: 'planned',
  };
}

export function appendOwnedId(manifest, collection, id) {
  if (!COLLECTIONS.includes(collection) || !uuidPattern.test(String(id))) throw new Error('Refusing to record invalid ownership');
  const ids = manifest.created[collection] ?? (manifest.created[collection] = []);
  if (!ids.includes(id)) ids.push(id);
  return manifest;
}

export function guardedDeleteRequest(collection, id, expected = { id }) {
  if (!GUARDED_DELETE_COLLECTIONS.has(collection) || !uuidPattern.test(String(id))) throw new Error('Refusing unguarded or invalid content deletion');
  return {
    path: `/commerce/mutations/${collection}/${encodeURIComponent(id)}`,
    options: { method: 'POST', body: JSON.stringify({ expected: { ...expected, id }, action: 'delete' }) },
  };
}

export function ownershipFields(collection, data) {
  const fieldMap = {
    directus_folders: ['name'], directus_files: ['folder', 'filename_download'],
    directus_policies: ['name'], directus_roles: ['name'], directus_users: ['email', 'role', 'status'],
    directus_access: ['role', 'policy'], categories: ['slug', 'title'],
    products: ['slug', 'sku', 'mpn', 'brand', 'status'], product_codes: ['product', 'code', 'source_name'],
    products_analogs: ['product_from', 'product_to', 'relation_type', 'canonical_key'],
    product_images: ['product', 'image', 'alt_text', 'status'],
    product_specifications: ['product', 'name', 'value', 'status'],
    product_documents: ['product', 'file', 'title', 'status'],
    pages: ['slug', 'title', 'status'], page_sections: ['page', 'section_type', 'title', 'status'],
    navigation_items: ['label', 'url', 'location', 'status'],
  };
  return Object.fromEntries(['id', ...(fieldMap[collection] ?? [])].filter(key => Object.hasOwn(data, key)).map(key => [key, data[key]]));
}

export function reconcileLegacySectionPage(expected, actual, id, runId, createdIds) {
  const suffix = runId.slice(0, 8);
  if (id !== expected?.id || !createdIds.includes(id) || actual?.id !== id || actual.slug !== `acceptance-${suffix}-page` || actual.title !== 'Synthetic acceptance page' || actual.status !== 'published' || expected.slug !== `acceptance-${suffix}-section-probe` || expected.title !== 'Synthetic section transaction probe' || expected.status !== 'published') return null;
  return { id, slug: actual.slug, title: actual.title, status: actual.status };
}

export function casRestorePatch(snapshot, current, allowedFields, expected = snapshot) {
  let alreadyRestored = true;
  for (const field of allowedFields) {
    if (!Object.hasOwn(snapshot, field)) continue;
    if (!Object.hasOwn(current, field)) throw new Error(`Refusing restore because ${field} is missing`);
    if (stableJson(current[field]) === stableJson(snapshot[field])) continue;
    alreadyRestored = false;
    if (!Object.hasOwn(expected, field) || stableJson(current[field]) !== stableJson(expected[field])) {
      throw new Error(`Refusing restore because ${field} changed after fixture provisioning`);
    }
  }
  if (alreadyRestored) return {};
  return Object.fromEntries(allowedFields.filter(field => Object.hasOwn(snapshot, field)).map(field => [field, snapshot[field]]));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function redactSummary(manifest) {
  return {
    status: manifest.phase,
    counts: Object.fromEntries(Object.entries(manifest.created ?? {}).map(([key, ids]) => [key, ids.length])),
    childCreateVerified: Boolean(manifest.childCreateVerified),
    sectionCreateVerified: manifest.sectionCreateVerified,
    sectionProbeStatus: manifest.sectionProbeOutcome?.status ?? null,
    serviceConfigured: manifest.phase === 'active' && Boolean(manifest.service?.userId && manifest.service?.token && manifest.created?.directus_users?.includes(manifest.service.userId)),
  };
}

export function productAnalogKey(fromId, toId, relationType) {
  const pair = ['superseded_by'].includes(relationType) ? [fromId, toId] : [fromId, toId].sort();
  return `${relationType}:${pair.join(':')}`;
}

export function newServiceToken() { return randomBytes(48).toString('base64url'); }

export function serviceEmailForRun(runId) {
  if (!uuidPattern.test(runId)) throw new Error('runId must be a UUID');
  return `storefront-${runId.slice(0, 8)}@example.com`;
}
