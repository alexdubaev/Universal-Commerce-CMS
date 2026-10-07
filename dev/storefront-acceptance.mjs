import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DirectusAdminClient } from '../directus/schema/apply-schema.mjs';
import {
  COLLECTIONS, FIXTURE_SCHEMA, LOCAL_URL, appendOwnedId, assertLocalTarget, casApplyPatch, directusRows,
  casRestorePatch, collectionEndpoint, createFixturePlan, makeOwnershipManifest, newServiceToken, readCollectionRows, recordMatchesOwnership, reconcileLegacySectionPage, serviceEmailForRun,
  guardedDeleteRequest, ownershipFields, productAnalogKey, redactSummary, safeManifestDirectory,
} from './storefront-acceptance-fixtures.mjs';

// Run with the original checkout's ignored admin env file, while pointing all
// generated state at this integration root:
// node --env-file="<original>/dev/.env" dev/storefront-acceptance.mjs plan|apply|status|cleanup --integration-root "<integration-root>"
// Child proof: add --verify-child-writes --confirm-synthetic-probe to apply.
// Private ownership/token state is <integration-root>/dev/.storefront-acceptance/manifest.json.

const run = async (args = process.argv.slice(2)) => {
  const command = args[0];
  const option = name => { const at = args.indexOf(name); return at < 0 ? null : args[at + 1]; };
  if (!['plan', 'apply', 'status', 'cleanup', 'resume-config'].includes(command)) throw new Error('Use plan, apply, status, cleanup, or resume-config');
  const root = option('--integration-root') ?? process.env.STOREFRONT_ACCEPTANCE_INTEGRATION_ROOT;
  if (!root) throw new Error('Pass --integration-root pointing to the integration checkout');
  process.env.STOREFRONT_ACCEPTANCE_INTEGRATION_ROOT = resolve(root);
  const manifestDir = resolve(safeManifestDirectory(resolve(root)));
  const manifestPath = join(manifestDir, 'manifest.json');
  const baseUrl = assertLocalTarget(process.env.DIRECTUS_URL ?? LOCAL_URL);
  const summary = value => process.stdout.write(`${JSON.stringify(value)}\n`);

  if (command === 'status') {
    const manifest = await readManifest(manifestPath);
    await saveManifest(manifestPath, manifest);
    summary(redactSummary(manifest)); return;
  }
  if (command === 'plan') {
    const plan = createFixturePlan();
    summary({ status: 'planned', counts: { products: plan.products.length, drafts: plan.drafts.length, categories: plan.categories.length, navigation: plan.navigation.length, sections: plan.sections.length, assets: plan.assets.length } }); return;
  }
  if (command === 'cleanup') {
    const manifest = await readManifest(manifestPath);
    if (manifest.target !== baseUrl) throw new Error('Manifest target does not match the approved local instance');
    const client = await adminClient();
    await cleanup(client, manifest, manifestPath);
    summary(redactSummary(manifest)); return;
  }
  if (command === 'resume-config') {
    const manifest = await readManifest(manifestPath);
    if (manifest.phase !== 'partial' || manifest.target !== baseUrl) throw new Error('resume-config requires a partial manifest for this exact local instance');
    if (!manifest.original.env || !manifest.service?.userId || !manifest.publicFolderId || !manifest.namedRefs.pageId || !manifest.namedRefs.homeImageId) throw new Error('Partial manifest lacks the saved service configuration or required fixture references');
    const client = await adminClient();
    await verifyOwnedManifest(client, manifest, manifestPath);
    await gatewayEnvPlan(manifest);
    await repairOwnedAssetMime(client, manifest);
    const page = await readExactOwned(client, manifest, 'pages', manifest.namedRefs.pageId);
    const homeImage = await readExactOwned(client, manifest, 'directus_files', manifest.namedRefs.homeImageId);
    await overrideSingletons(client, manifest, manifestPath, { page, homeImage });
    await ensureLocalGatewayEnv(manifest);
    manifest.phase = 'active'; await saveManifest(manifestPath, manifest);
    summary(redactSummary(manifest)); return;
  }

  const probeOnly = args.includes('--verify-child-writes');
  if (probeOnly && !args.includes('--confirm-synthetic-probe')) throw new Error('Pass --confirm-synthetic-probe for the disposable child-write probe');
  await mkdir(manifestDir, { recursive: true, mode: 0o700 });
  await chmod(manifestDir, 0o700);
  let manifest;
  try { manifest = await readManifest(manifestPath); }
  catch (error) { if (error?.code !== 'ENOENT') throw error; manifest = makeOwnershipManifest(randomUUID(), baseUrl); await saveManifest(manifestPath, manifest); }
  if (manifest.phase !== 'planned' || manifest.target !== baseUrl) throw new Error('Existing manifest is not an unapplied plan for this exact local instance');
  const client = await adminClient();
  const plan = createFixturePlan({ runId: manifest.runId });
  await assertNoSlugCollisions(client, plan);
  if (probeOnly) {
    await verifyNativeNestedChildCreate(client, manifest, manifestPath);
    summary(redactSummary(manifest)); return;
  }
  if (!manifest.childCreateVerified) throw new Error('Native transactional child create is unverified; run apply --verify-child-writes --confirm-synthetic-probe first');
  if (manifest.sectionCreateVerified !== true) throw new Error('Native page_sections child create is unverified or rejected; run the controlled probe before apply');
  await assertNoGeneratedNameCollisions(client, manifest);
  manifest.phase = 'applying'; await saveManifest(manifestPath, manifest);
  try {
    await provision(client, manifest, manifestPath, plan);
    manifest.phase = 'active'; await saveManifest(manifestPath, manifest);
    summary(redactSummary(manifest));
  } catch {
    manifest.phase = 'partial'; await saveManifest(manifestPath, manifest);
    throw new Error('Fixture apply stopped; run status and inspect the private manifest, then cleanup the exact owned records');
  }
};

async function adminClient() {
  const url = assertLocalTarget(process.env.DIRECTUS_URL ?? LOCAL_URL);
  const client = await DirectusAdminClient.connectFromEnvironment();
  if (client.baseUrl !== url) throw new Error('Admin client target is not the approved loopback URL');
  return client;
}

export async function readSingletonRows(client, collection, fields) {
  if (!['site_settings', 'home_page'].includes(collection)) throw new Error('Unsupported fixture singleton read');
  const query = new URLSearchParams({ fields: fields.join(','), limit: '1' });
  return directusRows(await client.request(`/items/${collection}?${query}`));
}

export async function readOwnedRecord(client, collection, id) {
  if (collection === 'home_page') {
    const singleton = (await readSingletonRows(client, 'home_page', ['*']))[0] ?? null;
    return singleton?.id != null && String(singleton.id) === String(id) ? singleton : null;
  }
  const query = new URLSearchParams({ 'filter[id][_eq]': String(id), limit: '1', fields: '*' });
  return (await readCollectionRows(client, collection, query))[0] ?? null;
}

export async function assertHomeSingletonAbsent(client) {
  const singleton = (await readSingletonRows(client, 'home_page', ['*']))[0];
  if (singleton?.id != null) throw new Error('Refusing synthetic home creation because a home singleton already exists');
}

async function readExactOwned(client, manifest, collection, id) {
  const row = await readOwnedRecord(client, collection, id);
  let expected = manifest.ownership[collection]?.[id];
  if (collection === 'pages' && id === manifest.namedRefs.sectionProbePageId) {
    const reconciled = reconcileLegacySectionPage(expected, row, id, manifest.runId, manifest.created.pages ?? []);
    if (reconciled) manifest.ownership.pages[id] = expected = reconciled;
  }
  if (!recordMatchesOwnership(row, expected)) throw new Error(`Required owned ${collection} fixture is absent or changed`);
  return row;
}

async function verifyOwnedManifest(client, manifest, path) {
  for (const collection of COLLECTIONS) {
    for (const id of manifest.created[collection] ?? []) await readExactOwned(client, manifest, collection, id);
  }
  for (const [collection, records] of Object.entries(manifest.pending ?? {})) {
    for (const [id, expected] of Object.entries(records)) {
      if (collection !== 'home_page') throw new Error('resume-config refuses a manifest with unresolved pending creates');
      const singleton = (await readSingletonRows(client, 'home_page', ['*']))[0];
      if (singleton?.id != null && String(singleton.id) !== id) throw new Error('resume-config refuses a pending home create because a different singleton already exists');
      let ownedExpected = expected;
      if (singleton?.id == null) {
        ownedExpected = upgradePendingHomeExpected(manifest, id, expected);
        manifest.pending.home_page[id] = ownedExpected;
        manifest.ownership.home_page[id] = ownedExpected;
        manifest.namedRefs.homePageId = id;
        await saveManifest(path, manifest);
      }
      if (singleton?.id != null && !recordMatchesOwnership(singleton, ownedExpected)) throw new Error('resume-config refuses a changed pending home singleton');
      const row = singleton?.id != null ? singleton : await resumePendingHomeCreate(client, id, ownedExpected);
      if (!recordMatchesOwnership(row, ownedExpected)) throw new Error('resume-config refuses an unresolved home singleton create');
      markOwnedCreated(manifest, collection, id, ownedExpected);
    }
  }
  for (const collection of COLLECTIONS) {
    for (const id of manifest.created[collection] ?? []) await readExactOwned(client, manifest, collection, id);
  }
  await saveManifest(path, manifest);
}

export async function resumePendingHomeCreate(client, id, expected) {
  const row = await readOwnedRecord(client, 'home_page', id);
  if (recordMatchesOwnership(row, expected)) return row;
  const singleton = (await readSingletonRows(client, 'home_page', ['*']))[0];
  if (singleton?.id != null) throw new Error('Refusing pending home create because a different singleton already exists');
  const created = await client.request('/items/home_page', { method: 'PATCH', body: JSON.stringify(expected) });
  if (!recordMatchesOwnership(created, expected)) throw new Error('Pending home singleton retry did not return its journaled identity');
  return created;
}

export function syntheticHomeValues(sourcePageId, heroImageId) {
  return {
    status: 'published', source_page: sourcePageId, h1: 'Synthetic acceptance home',
    hero_title: 'Synthetic parts catalog', hero_text: 'Neutral local integration content.',
    hero_image: heroImageId, hero_image_alt: 'Generated synthetic test image', is_indexable: true,
    hero_search_label: 'Search synthetic parts', hero_search_placeholder: 'Enter a synthetic part number',
    hero_search_button_text: 'Search', hero_bulk_prompt: 'Looking for several synthetic items?',
    hero_bulk_link_text: 'Send a request', hero_bulk_link_url: '/request',
    hero_excel_link_text: 'Request a spreadsheet lookup', hero_excel_link_url: '/request?source=spreadsheet',
    hero_photo_link_text: 'Request by photo', hero_photo_link_url: '/request?source=photo',
  };
}

export function upgradePendingHomeExpected(manifest, id, expected) {
  const { pageId, homeImageId } = manifest.namedRefs ?? {};
  if (id !== expected?.id || !pageId || !homeImageId || !(manifest.created.pages ?? []).includes(pageId) || !(manifest.created.directus_files ?? []).includes(homeImageId)) {
    throw new Error('Refusing to upgrade pending home create without its exact owned page and image references');
  }
  const values = syntheticHomeValues(pageId, homeImageId);
  for (const [field, value] of Object.entries(expected)) {
    if (field !== 'id' && (!Object.hasOwn(values, field) || JSON.stringify(value) !== JSON.stringify(values[field]))) throw new Error('Refusing to upgrade an unrecognized pending home create');
  }
  if (expected.id !== id) throw new Error('Refusing to upgrade an unrecognized pending home create');
  return ownershipFields('home_page', { id, ...values });
}

async function readManifest(path) {
  const value = JSON.parse(await readFile(path, 'utf8'));
  if (value.schema !== FIXTURE_SCHEMA || !value.created || !value.original) throw new Error('Invalid private fixture manifest');
  const defaults = makeOwnershipManifest(value.runId, value.target);
  value.pending ??= defaults.pending;
  value.ownership ??= defaults.ownership;
  for (const collection of COLLECTIONS) {
    value.pending[collection] ??= {};
    value.ownership[collection] ??= {};
  }
  value.namedRefs = { ...defaults.namedRefs, ...(value.namedRefs ?? {}) };
  if (value.namedRefs.childProbeProductId && !value.namedRefs.childProbeSpecificationId) value.namedRefs.childProbeSpecificationId = value.created.product_specifications?.[0] ?? null;
  value.service ??= defaults.service;
  if (value.sectionProbeOutcome?.status === 'verified') value.sectionProbeOutcome.httpStatus = null;
  const suffix = value.runId.slice(0, 8);
  if (value.namedRefs.childProbeProductId) value.ownership.products[value.namedRefs.childProbeProductId] ??= { id: value.namedRefs.childProbeProductId, slug: `acceptance-${suffix}-tx-probe`, sku: `FX-${suffix}-TX-PROBE`, brand: 'Fixture Works', status: 'draft' };
  if (value.namedRefs.childProbeSpecificationId && value.namedRefs.childProbeProductId) value.ownership.product_specifications[value.namedRefs.childProbeSpecificationId] ??= { id: value.namedRefs.childProbeSpecificationId, product: value.namedRefs.childProbeProductId, name: 'Transaction probe', value: 'synthetic', status: 'draft' };
  if (value.namedRefs.sectionProbePageId) value.ownership.pages[value.namedRefs.sectionProbePageId] ??= { id: value.namedRefs.sectionProbePageId, slug: `acceptance-${suffix}-section-probe`, title: 'Synthetic section transaction probe', status: 'published' };
  if (value.namedRefs.sectionProbeId && value.namedRefs.sectionProbePageId) value.ownership.page_sections[value.namedRefs.sectionProbeId] ??= { id: value.namedRefs.sectionProbeId, page: value.namedRefs.sectionProbePageId, section_type: 'text', title: 'Fixture section', status: 'published' };
  return value;
}

async function saveManifest(path, manifest) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, path);
}

const post = (client, collection, data) => client.request(`/items/${collection}`, { method: 'POST', body: JSON.stringify(data) });

export function patchSingleton(client, collection, changes) {
  if (!['site_settings', 'home_page'].includes(collection) || !changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('Unsupported fixture singleton patch');
  return client.request(`/items/${collection}`, { method: 'PATCH', body: JSON.stringify(changes) });
}

function nestedOwnedChildren(collection, data) {
  if (collection !== 'products') return [];
  return [
    ...(data.image_items ?? []).map(row => ['product_images', { ...row, product: data.id }]),
    ...(data.specification_items ?? []).map(row => ['product_specifications', { ...row, product: data.id }]),
    ...(data.document_items ?? []).map(row => ['product_documents', { ...row, product: data.id }]),
  ];
}

async function prepareOwned(client, manifest, path, collection, data) {
  const row = { ...data, id: String(data.id ?? randomUUID()) };
  for (const [targetCollection, target] of [[collection, row], ...nestedOwnedChildren(collection, row)]) {
    target.id = String(target.id ?? randomUUID());
    if (targetCollection === 'home_page') {
      await assertHomeSingletonAbsent(client);
    }
    if (await readOwnedRecord(client, targetCollection, target.id)) throw new Error('A generated record UUID is already in use; refusing to reuse or overwrite it');
    const expected = ownershipFields(targetCollection, target);
    manifest.pending[targetCollection][target.id] = expected;
    manifest.ownership[targetCollection][target.id] = expected;
  }
  await saveManifest(path, manifest);
  return row;
}

function markOwnedCreated(manifest, collection, id, expected) {
  const key = String(id);
  appendOwnedId(manifest, collection, key);
  manifest.ownership[collection][key] = expected;
  delete manifest.pending[collection][key];
}

async function createOwned(client, manifest, path, collection, data) {
  const row = await prepareOwned(client, manifest, path, collection, data);
  const systemPath = ['directus_folders'].includes(collection) ? collectionEndpoint(collection) : null;
  const created = systemPath
    ? await client.request(systemPath, { method: 'POST', body: JSON.stringify(row) })
    : collection === 'home_page'
      ? await client.request('/items/home_page', { method: 'PATCH', body: JSON.stringify(row) })
    : await post(client, collection, row);
  if (!created?.id) throw new Error('Directus create did not return its record id');
  markOwnedCreated(manifest, collection, String(created.id), ownershipFields(collection, { ...row, id: String(created.id) }));
  delete manifest.pending[collection][row.id];
  for (const [childCollection, child] of nestedOwnedChildren(collection, row)) markOwnedCreated(manifest, childCollection, child.id, ownershipFields(childCollection, child));
  await saveManifest(path, manifest);
  return created;
}

async function createSystemOwned(client, manifest, path, collection, endpoint, data) {
  const row = await prepareOwned(client, manifest, path, collection, data);
  const created = await client.request(endpoint, { method: 'POST', body: JSON.stringify(row) });
  if (!created?.id) throw new Error('Directus create did not return its record id');
  markOwnedCreated(manifest, collection, String(created.id), ownershipFields(collection, { ...row, id: String(created.id) }));
  delete manifest.pending[collection][row.id];
  await saveManifest(path, manifest);
  return created;
}

async function assertNoSlugCollisions(client, plan) {
  for (const [collection, rows] of [['categories', plan.categories], ['products', [...plan.products, ...plan.drafts]], ['pages', [plan.page]]]) {
    for (const row of rows) {
      const query = new URLSearchParams({ 'filter[slug][_eq]': row.slug, limit: '1', fields: 'id' });
      const found = await client.request(`/items/${collection}?${query}`);
      if (found.length) throw new Error(`A generated synthetic ${collection} slug is already in use; no content was changed`);
    }
  }
}

async function assertNoGeneratedNameCollisions(client, manifest) {
  const suffix = manifest.runId.slice(0, 8);
  const checks = [
    ['directus_folders', 'name', `Acceptance Public ${suffix}`],
    ['directus_folders', 'name', `Acceptance Private ${suffix}`],
    ['directus_policies', 'name', `Synthetic Storefront ${suffix}`],
    ['directus_roles', 'name', `Synthetic Storefront ${suffix}`],
    ['directus_users', 'email', serviceEmailForRun(manifest.runId)],
  ];
  for (const [collection, field, value] of checks) {
    const params = new URLSearchParams({ [`filter[${field}][_eq]`]: value, limit: '1', fields: 'id' });
    const found = await readCollectionRows(client, collection, params);
    if (found.length) throw new Error('A generated fixture identity or folder name is already in use; no fixture data was changed');
  }
}

async function verifyNativeNestedChildCreate(client, manifest, path) {
  if (!manifest.childCreateVerified) {
    const childId = randomUUID();
    const parent = {
      id: randomUUID(), title: `Synthetic transaction probe ${manifest.runId.slice(0, 8)}`,
      slug: `acceptance-${manifest.runId.slice(0, 8)}-tx-probe`, sku: `FX-${manifest.runId.slice(0, 8)}-TX-PROBE`,
      brand: 'Fixture Works', currency: 'RUB', status: 'draft', price_status: 'hidden', availability_status: 'on_request',
      specification_items: [{ id: childId, name: 'Transaction probe', value: 'synthetic', status: 'draft', sort_order: 1 }],
    };
    const collisions = await client.request(`/items/products?filter[slug][_eq]=${encodeURIComponent(parent.slug)}&limit=1&fields=id`);
    if (collisions.length) throw new Error('Synthetic transaction probe slug already exists; refusing to reuse it');
    const created = await createOwned(client, manifest, path, 'products', parent);
    manifest.namedRefs.childProbeProductId = created.id;
    manifest.namedRefs.childProbeSpecificationId = childId;
    appendOwnedId(manifest, 'product_specifications', childId);
    await saveManifest(path, manifest);
    const createdChildren = await client.request(`/items/product_specifications?filter[product][_eq]=${encodeURIComponent(created.id)}&limit=2&fields=id,product,status`);
    if (createdChildren.length !== 1 || createdChildren[0].id !== childId || createdChildren[0].product !== created.id) throw new Error('Directus did not prove nested transactional child creation');
    manifest.childCreateVerified = true;
    await saveManifest(path, manifest);
  }
  if (!manifest.sectionProbeOutcome) {
    const plan = createFixturePlan({ runId: manifest.runId });
    const probePage = { ...plan.page, id: randomUUID(), slug: `acceptance-${manifest.runId.slice(0, 8)}-section-probe`, title: 'Synthetic section transaction probe' };
    const page = await createOwned(client, manifest, path, 'pages', probePage);
    manifest.namedRefs.sectionProbePageId = page.id;
    await saveManifest(path, manifest);
    const section = { ...plan.sections[0], page: page.id };
    try {
      const createdSection = await createOwned(client, manifest, path, 'page_sections', section);
      const rows = await client.request(`/items/page_sections?filter[id][_eq]=${encodeURIComponent(createdSection.id)}&limit=1&fields=id,page,status`);
      if (rows.length !== 1 || rows[0].id !== section.id || rows[0].page !== page.id) {
        manifest.sectionCreateVerified = false;
        manifest.sectionProbeOutcome = { status: 'readback_mismatch', httpStatus: null, code: 'REST_READBACK_MISMATCH' };
      } else {
        manifest.namedRefs.sectionProbeId = createdSection.id;
        manifest.sectionCreateVerified = true;
        manifest.sectionProbeOutcome = { status: 'verified', httpStatus: null, code: null };
      }
    } catch (error) {
      const message = String(error?.message ?? '');
      const httpStatus = Number(message.match(/HTTP (\d{3})/u)?.[1] ?? 0) || null;
      const knownCode = message.match(/COMMERCE_TRANSACTION_REQUIRED|INVALID_PAYLOAD|FORBIDDEN|RECORD_NOT_UNIQUE/u)?.[0] ?? 'REST_CREATE_REJECTED';
      manifest.sectionCreateVerified = false;
      manifest.sectionProbeOutcome = { status: 'rejected', httpStatus, code: knownCode };
    }
    manifest.phase = 'planned';
    await saveManifest(path, manifest);
  }
}

async function provision(client, manifest, path, plan) {
  const publicFolder = await createOwned(client, manifest, path, 'directus_folders', { name: `Acceptance Public ${manifest.runId.slice(0, 8)}` });
  const privateFolder = await createOwned(client, manifest, path, 'directus_folders', { name: `Acceptance Private ${manifest.runId.slice(0, 8)}` });
  manifest.publicFolderId = publicFolder.id;
  manifest.namedRefs.privateFolderId = privateFolder.id;
  await saveManifest(path, manifest);
  const gallery = await uploadAsset(client, manifest, path, publicFolder.id, 'fixture-gallery.png', pngBytes);
  const homeImage = await uploadAsset(client, manifest, path, publicFolder.id, 'fixture-home.png', pngBytes);
  const draftImage = await uploadAsset(client, manifest, path, publicFolder.id, 'fixture-draft-only.png', pngBytes);
  const unreferencedImage = await uploadAsset(client, manifest, path, publicFolder.id, 'fixture-unreferenced.png', pngBytes);
  const htmlFile = await uploadAsset(client, manifest, path, publicFolder.id, 'fixture-document.html', htmlBytes);
  const publicPdf = await uploadAsset(client, manifest, path, publicFolder.id, 'fixture-public.pdf', pdfBytes);
  const privateFile = await uploadAsset(client, manifest, path, privateFolder.id, 'fixture-private.pdf', pdfBytes);
  manifest.namedRefs.galleryFileIds = [gallery.id, homeImage.id];
  manifest.namedRefs.privateAssetId = privateFile.id;
  manifest.namedRefs.publicDocumentFileId = publicPdf.id;
  manifest.namedRefs.documentFileId = publicPdf.id;
  manifest.namedRefs.draftReferencedAssetId = draftImage.id;
  manifest.namedRefs.unreferencedAssetId = unreferencedImage.id;
  manifest.namedRefs.homeImageId = homeImage.id;
  manifest.namedRefs.htmlFileId = htmlFile.id;
  await saveManifest(path, manifest);
  await provisionServiceIdentity(client, manifest, path);
  const categories = [];
  for (const row of plan.categories) categories.push(await createOwned(client, manifest, path, 'categories', row));
  const products = [];
  for (let i = 0; i < plan.products.length; i++) {
    const row = { ...plan.products[i], category: categories[i % categories.length].id };
    if (i === 0) Object.assign(row, {
      main_image: gallery.id, image_alt: 'Generated synthetic gallery image', gallery: [gallery.id],
      image_items: [
        { id: randomUUID(), image: gallery.id, alt_text: 'Synthetic primary gallery image', status: 'published', sort_order: 1 },
        { id: randomUUID(), image: homeImage.id, alt_text: 'Synthetic secondary gallery image', status: 'published', sort_order: 2 },
      ],
      specification_items: [{ id: randomUUID(), group_name: 'Synthetic', name: 'Fixture dimension', value: '12 mm', status: 'published', sort_order: 1 }],
      document_items: [
        { id: randomUUID(), file: publicPdf.id, title: 'Synthetic public fixture PDF', status: 'published', sort_order: 1 },
        { id: randomUUID(), file: htmlFile.id, title: 'Synthetic fixture HTML', status: 'published', sort_order: 2 },
        { id: randomUUID(), file: privateFile.id, title: 'Synthetic private fixture PDF', status: 'published', sort_order: 3 },
      ],
      specifications: { 'Fixture dimension': '12 mm' },
      documents: [{ title: 'Synthetic public fixture PDF', file: publicPdf.id }],
    });
    if (i === 1) Object.assign(row, { main_image: privateFile.id, image_alt: 'Intentionally private file reference' });
    const created = await createOwned(client, manifest, path, 'products', row);
    if (i === 0) {
      manifest.namedRefs.primaryProductId = created.id;
      manifest.namedRefs.primaryProductSlug = row.slug;
      manifest.namedRefs.documentId = row.document_items?.[0]?.id ?? null;
      manifest.namedRefs.documentFileId = publicPdf.id;
      manifest.namedRefs.htmlDocumentId = row.document_items?.[1]?.id ?? null;
      manifest.namedRefs.privateDocumentId = row.document_items?.[2]?.id ?? null;
    }
    if (i === plan.products.length - 1) {
      manifest.namedRefs.nonIndexableProductId = created.id;
      manifest.namedRefs.nonIndexableProductSlug = row.slug;
    }
    for (const key of ['image_items', 'specification_items', 'document_items']) {
      for (const child of row[key] ?? []) appendOwnedId(manifest, key === 'image_items' ? 'product_images' : key === 'specification_items' ? 'product_specifications' : 'product_documents', child.id);
    }
    await saveManifest(path, manifest);
    products.push(created);
  }
  await createOwned(client, manifest, path, 'product_codes', { product: products[0].id, code: `OEM-${manifest.runId.slice(0, 8)}-TEST`, code_type: 'oem', source_name: 'synthetic acceptance', is_active: true });
  for (const [from, to, relation_type] of [[products[0], products[1], 'analog'], [products[1], products[2], 'compatible'], [products[2], products[3], 'superseded_by']]) {
    await createOwned(client, manifest, path, 'products_analogs', { product_from: from.id, product_to: to.id, relation_type, canonical_key: productAnalogKey(from.id, to.id, relation_type), source_name: 'synthetic acceptance' });
  }
  for (const [index, draft] of plan.drafts.entries()) {
    const child = plan.children[index];
    const payload = {
      ...draft,
      specification_items: [child.specification],
      image_items: [{ ...child.image, image: draftImage.id, status: index === 0 ? 'published' : 'draft' }],
    };
    const created = await createOwned(client, manifest, path, 'products', payload);
    manifest.namedRefs.draftProductIds.push(created.id);
    if (index === 0) manifest.namedRefs.draftReferencedAssetId = draftImage.id;
    appendOwnedId(manifest, 'product_specifications', child.specification.id);
    appendOwnedId(manifest, 'product_images', child.image.id);
    await saveManifest(path, manifest);
  }
  const page = await createOwned(client, manifest, path, 'pages', plan.page);
  manifest.namedRefs.pageId = page.id;
  manifest.namedRefs.pageSlug = page.slug;
  await saveManifest(path, manifest);
  for (const row of plan.sections) await createOwned(client, manifest, path, 'page_sections', { ...row, page: page.id });
  for (const row of plan.navigation) await createOwned(client, manifest, path, 'navigation_items', { ...row, url: `/${page.slug}` });
  await overrideSingletons(client, manifest, path, { page, homeImage });
  // `privateFile` is intentionally referenced by a published product above;
  // no broad file permissions or file-based entitlement bypass is installed.
}

async function provisionServiceIdentity(client, manifest, path) {
  const suffix = manifest.runId.slice(0, 8);
  const policy = await createSystemOwned(client, manifest, path, 'directus_policies', '/policies', { id: randomUUID(), name: `Synthetic Storefront ${suffix}`, icon: 'lock', description: 'Synthetic local zero-grant gateway identity', app_access: false, admin_access: false });
  manifest.service.policyId = policy.id;
  await saveManifest(path, manifest);
  const role = await createSystemOwned(client, manifest, path, 'directus_roles', '/roles', { id: randomUUID(), name: `Synthetic Storefront ${suffix}`, icon: 'lock', description: 'Synthetic local zero-grant gateway identity' });
  manifest.service.roleId = role.id;
  await saveManifest(path, manifest);
  const access = await createSystemOwned(client, manifest, path, 'directus_access', '/access', { id: randomUUID(), role: role.id, policy: policy.id });
  await saveManifest(path, manifest);
  const permissions = await client.request(`/permissions?filter[policy][_eq]=${encodeURIComponent(policy.id)}&limit=1&fields=id`);
  if (permissions.length) throw new Error('The storefront service policy unexpectedly has native permissions');
  const token = newServiceToken();
  const userId = randomUUID();
  manifest.service = { token, userId, roleId: role.id, policyId: policy.id };
  await saveManifest(path, manifest);
  const user = await createSystemOwned(client, manifest, path, 'directus_users', '/users', { id: userId, email: serviceEmailForRun(manifest.runId), first_name: 'Synthetic', last_name: 'Storefront', status: 'active', role: role.id, token });
  manifest.service.userId = user.id;
  await saveManifest(path, manifest);
  await writeLocalGatewayEnv(manifest);
}

async function writeLocalGatewayEnv(manifest) {
  const root = process.env.STOREFRONT_ACCEPTANCE_INTEGRATION_ROOT;
  const envPath = join(root, 'dev/.env');
  const text = await readFile(envPath, 'utf8');
  const keys = ['COMMERCE_STOREFRONT_ENABLED', 'COMMERCE_STOREFRONT_USER_ID', 'COMMERCE_STOREFRONT_PUBLIC_FOLDER_ID'];
  manifest.original.env = Object.fromEntries(keys.map(key => [key, envValue(text, key)]));
  if (manifest.original.env.COMMERCE_STOREFRONT_ENABLED !== null && manifest.original.env.COMMERCE_STOREFRONT_ENABLED !== 'false') throw new Error('Refusing to replace an already enabled storefront gateway');
  if (manifest.original.env.COMMERCE_STOREFRONT_USER_ID && manifest.original.env.COMMERCE_STOREFRONT_USER_ID.trim()) throw new Error('Refusing to replace an existing storefront service identity');
  if (manifest.original.env.COMMERCE_STOREFRONT_PUBLIC_FOLDER_ID && manifest.original.env.COMMERCE_STOREFRONT_PUBLIC_FOLDER_ID.trim()) throw new Error('Refusing to replace an existing storefront public folder');
  await saveManifest(join(root, 'dev/.storefront-acceptance/manifest.json'), manifest);
  let next = setEnvValue(text, keys[0], 'true');
  next = setEnvValue(next, keys[1], String(manifest.service.userId));
  next = setEnvValue(next, keys[2], String(manifest.publicFolderId));
  await writeFile(envPath, next, { mode: 0o600 });
  await chmod(envPath, 0o600);
}

async function ensureLocalGatewayEnv(manifest) {
  const { envPath, text, next } = await gatewayEnvPlan(manifest);
  if (next !== text) { await writeFile(envPath, next, { mode: 0o600 }); await chmod(envPath, 0o600); }
}

async function gatewayEnvPlan(manifest) {
  const root = process.env.STOREFRONT_ACCEPTANCE_INTEGRATION_ROOT;
  const envPath = join(root, 'dev/.env');
  const keys = ['COMMERCE_STOREFRONT_ENABLED', 'COMMERCE_STOREFRONT_USER_ID', 'COMMERCE_STOREFRONT_PUBLIC_FOLDER_ID'];
  const expected = ['true', String(manifest.service.userId), String(manifest.publicFolderId)];
  const original = manifest.original.env;
  const text = await readFile(envPath, 'utf8');
  let next = text;
  for (let index = 0; index < keys.length; index++) {
    const current = envValue(text, keys[index]);
    if (current !== expected[index] && current !== original[keys[index]]) throw new Error(`Refusing environment resume because ${keys[index]} changed after fixture start`);
    if (current === original[keys[index]] && current !== expected[index]) next = setEnvValue(next, keys[index], expected[index]);
  }
  return { envPath, text, next };
}

function envValue(text, key) {
  const line = text.split(/\r?\n/u).find(value => value.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1) : null;
}

function setEnvValue(text, key, value) {
  const lines = text.split(/\r?\n/u);
  const index = lines.findIndex(line => line.startsWith(`${key}=`));
  if (index < 0) lines.push(`${key}=${value}`); else lines[index] = `${key}=${value}`;
  return lines.join('\n');
}

async function overrideSingletons(client, manifest, path, { page, homeImage }) {
  const settingsRows = await readSingletonRows(client, 'site_settings', ['id', 'commerce_profile']);
  if (!settingsRows.length) throw new Error('site_settings singleton is missing');
  const settings = settingsRows[0];
  const profileSnapshot = manifest.original.site_settings;
  if (profileSnapshot && String(profileSnapshot.id) !== String(settings.id)) throw new Error('site_settings singleton identity changed after fixture start');
  const profile = profileSnapshot?.commerce_profile ?? settings.commerce_profile;
  if (!profile || profile.currency !== 'RUB' || profile.features?.cart !== false) throw new Error('Existing commerce profile does not match the expected RUB/cart-off baseline');
  const fixtureProfile = profileSnapshot?.expectedCommerceProfile ?? { ...profile, features: { ...profile.features, parts_request: true, cart: false } };
  manifest.original.site_settings = { ...(profileSnapshot ?? { id: settings.id, commerce_profile: profile }), expectedCommerceProfile: fixtureProfile };
  await saveManifest(path, manifest);
  const profilePatch = casApplyPatch({ commerce_profile: manifest.original.site_settings.commerce_profile }, { commerce_profile: settings.commerce_profile }, ['commerce_profile'], { commerce_profile: fixtureProfile });
  if (Object.keys(profilePatch).length) await patchSingleton(client, 'site_settings', profilePatch);
  const homeFields = ['status', 'source_page', 'h1', 'hero_title', 'hero_text', 'hero_image', 'hero_image_alt'];
  const homeRows = await readSingletonRows(client, 'home_page', ['id', ...homeFields]);
  if (!homeRows.length) throw new Error('home_page singleton is missing');
  const home = homeRows[0];
  const homeSnapshot = manifest.original.home_page;
  if (homeSnapshot && String(homeSnapshot.id) !== String(home.id)) throw new Error('home_page singleton identity changed after fixture start');
  const values = homeSnapshot?.expectedValues ?? (home.id == null
    ? syntheticHomeValues(page.id, homeImage.id)
    : { status: 'published', source_page: page.id, h1: 'Synthetic acceptance home', hero_title: 'Synthetic parts catalog', hero_text: 'Neutral local integration content.', hero_image: homeImage.id, hero_image_alt: 'Generated synthetic test image' });
  if (home.id == null) {
    const created = await createOwned(client, manifest, path, 'home_page', { id: randomUUID(), ...values, is_indexable: true });
    manifest.namedRefs.homePageId = created.id;
    await saveManifest(path, manifest);
    return;
  }
  if ((manifest.created.home_page ?? []).includes(String(home.id))) {
    await readExactOwned(client, manifest, 'home_page', String(home.id));
    manifest.namedRefs.homePageId = String(home.id);
    await saveManifest(path, manifest);
    return;
  }
  const currentValues = Object.fromEntries(homeFields.map(key => [key, Object.hasOwn(home, key) ? home[key] : null]));
  manifest.original.home_page = homeSnapshot ?? { id: home.id, values: currentValues };
  manifest.original.home_page.expectedValues = values;
  await saveManifest(path, manifest);
  const homePatch = casApplyPatch(manifest.original.home_page.values, currentValues, homeFields, values);
  if (Object.keys(homePatch).length) await patchSingleton(client, 'home_page', homePatch);
}

const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/T8sAAAAASUVORK5CYII=', 'base64');
const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Kids [] /Count 0 >>endobj\ntrailer<< /Root 1 0 R >>\n%%EOF\n');
const htmlBytes = Buffer.from('<!doctype html><title>Synthetic fixture</title><p>Generated synthetic acceptance document.</p>');

async function uploadAsset(client, manifest, path, folderId, filename, bytes) {
  const extensionAt = filename.lastIndexOf('.');
  const runLabel = manifest.runId.slice(0, 8);
  const generatedName = `${filename.slice(0, extensionAt)}-${runLabel}${filename.slice(extensionAt)}`;
  const duplicate = await readCollectionRows(client, 'directus_files', new URLSearchParams({ 'filter[folder][_eq]': folderId, 'filter[filename_download][_eq]': generatedName, limit: '1', fields: 'id' }));
  if (duplicate.length) throw new Error('A generated file name is already in the fixture folder; refusing to overwrite it');
  const id = randomUUID();
  const idCollision = await readCollectionRows(client, 'directus_files', new URLSearchParams({ 'filter[id][_eq]': id, limit: '1', fields: 'id' }));
  if (idCollision.length) throw new Error('A generated file UUID is already in use; refusing to overwrite it');
  const expected = { id, folder: folderId, filename_download: generatedName };
  manifest.pending.directus_files[id] = expected;
  manifest.ownership.directus_files[id] = expected;
  await saveManifest(path, manifest);
  const form = new FormData();
  form.append('id', id);
  form.append('folder', folderId);
  form.append('title', 'Generated synthetic acceptance fixture');
  const mime = fixtureMime(generatedName);
  form.append('file', new Blob([bytes], { type: mime }), generatedName);
  const response = await fetch(`${client.baseUrl}/files`, { method: 'POST', headers: { authorization: `Bearer ${client.token}` }, body: form });
  if (!response.ok) throw new Error(`Generated asset upload failed with HTTP ${response.status}`);
  const record = (await response.json()).data;
  if (!record?.id) throw new Error('Asset upload did not return an owned file id');
  markOwnedCreated(manifest, 'directus_files', String(record.id), { id: String(record.id), folder: folderId, filename_download: generatedName, type: mime });
  delete manifest.pending.directus_files[id];
  await saveManifest(path, manifest);
  return record;
}

function fixtureMime(filename) {
  const extension = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  return ({ png: 'image/png', pdf: 'application/pdf', html: 'text/html' })[extension] ?? null;
}

function fixtureBytes(filename) {
  const extension = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  return ({ png: pngBytes, pdf: pdfBytes, html: htmlBytes })[extension] ?? null;
}

export async function repairOwnedAssetMime(client, manifest, fetchImpl = fetch) {
  for (const id of manifest.created.directus_files ?? []) {
    const expected = manifest.ownership.directus_files?.[id];
    if (!expected || expected.id !== id) throw new Error('Refusing MIME repair without exact file ownership');
    const desired = fixtureMime(expected.filename_download ?? '');
    const bytes = fixtureBytes(expected.filename_download ?? '');
    if (!desired || !bytes) throw new Error('Refusing MIME repair for an unknown generated file type');
    const current = await readOwnedRecord(client, 'directus_files', id);
    if (!recordMatchesOwnership(current, { id, folder: expected.folder, filename_download: expected.filename_download })) throw new Error('Refusing MIME repair because the owned file identity changed');
    if (current.type === desired) { expected.type = desired; continue; }
    if (current.type !== 'application/octet-stream') throw new Error('Refusing MIME repair because the file MIME changed after fixture creation');
    const asset = await fetchImpl(`${client.baseUrl}/assets/${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${client.token}` } });
    if (!asset.ok) throw new Error(`Owned asset verification failed with HTTP ${asset.status}`);
    const actualBytes = Buffer.from(await asset.arrayBuffer());
    if (actualBytes.length !== bytes.length || !actualBytes.equals(bytes)) throw new Error('Refusing MIME repair because owned asset bytes differ from the generated fixture');
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: desired }), expected.filename_download);
    const response = await fetchImpl(`${client.baseUrl}/files/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { authorization: `Bearer ${client.token}` }, body: form });
    if (!response.ok) throw new Error(`Owned asset MIME repair failed with HTTP ${response.status}`);
    const returned = (await response.json()).data;
    if (returned?.id !== id || returned.type !== desired) throw new Error('Owned asset MIME repair did not return the expected file identity and type');
    expected.type = desired;
  }
}

async function cleanup(client, manifest, path) {
  if (manifest.original.env) {
    const envPath = join(process.env.STOREFRONT_ACCEPTANCE_INTEGRATION_ROOT, 'dev/.env');
    const text = await readFile(envPath, 'utf8');
    const expected = {
      COMMERCE_STOREFRONT_ENABLED: 'true',
      COMMERCE_STOREFRONT_USER_ID: String(manifest.service.userId),
      COMMERCE_STOREFRONT_PUBLIC_FOLDER_ID: String(manifest.publicFolderId),
    };
    for (const [key, value] of Object.entries(expected)) {
      const current = envValue(text, key);
      const original = manifest.original.env[key];
      if (current !== value && current !== original) throw new Error(`Refusing environment restore because ${key} changed after fixture provisioning`);
    }
    let restored = text;
    for (const [key, value] of Object.entries(manifest.original.env)) restored = value === null ? restored.split(/\r?\n/u).filter(line => !line.startsWith(`${key}=`)).join('\n') : setEnvValue(restored, key, value);
    await writeFile(envPath, restored, { mode: 0o600 });
    await chmod(envPath, 0o600);
  }
  for (const [collection, saved] of [['home_page', manifest.original.home_page], ['site_settings', manifest.original.site_settings]]) {
    if (!saved) continue;
    const fields = collection === 'home_page' ? ['id', 'status', 'source_page', 'h1', 'hero_title', 'hero_text', 'hero_image', 'hero_image_alt'] : ['id', 'commerce_profile'];
    const currentRows = await readSingletonRows(client, collection, fields);
    if (!currentRows.length || String(currentRows[0].id) !== String(saved.id)) throw new Error(`Refusing singleton restore for ${collection}: identity changed`);
    const snapshot = collection === 'home_page' ? saved.values : { commerce_profile: saved.commerce_profile };
    const expected = collection === 'home_page' ? saved.expectedValues : { commerce_profile: saved.expectedCommerceProfile };
    const current = currentRows[0];
    const currentValues = Object.fromEntries(fields.filter(field => field !== 'id').map(field => [field, Object.hasOwn(current, field) ? current[field] : null]));
    const allowedFields = fields.filter(field => field !== 'id');
    const restore = casRestorePatch(snapshot, currentValues, allowedFields, expected);
    if (Object.keys(restore).length) await patchSingleton(client, collection, restore);
  }
  const order = [
    'directus_users', 'directus_access', 'directus_roles', 'directus_policies',
    'navigation_items', 'page_sections', 'home_page', 'pages', 'products_analogs', 'product_codes',
    'product_documents', 'product_specifications', 'product_images', 'products',
    'categories', 'directus_files', 'directus_folders',
  ];
  for (const collection of order) {
    const ids = [...new Set([...(manifest.created[collection] ?? []), ...Object.keys(manifest.pending[collection] ?? {})])].reverse();
    for (const id of ids) {
      try {
        const row = await readOwnedRecord(client, collection, id);
        if (!row) { appendCleanupAbsent(manifest, collection, id); continue; }
        let expected = manifest.ownership[collection]?.[id] ?? manifest.pending[collection]?.[id];
        if (collection === 'pages' && id === manifest.namedRefs.sectionProbePageId) {
          const reconciled = reconcileLegacySectionPage(expected, row, id, manifest.runId, manifest.created.pages ?? []);
          if (reconciled) {
            manifest.ownership.pages[id] = expected = reconciled;
            await saveManifest(path, manifest);
          }
        }
        if (!recordMatchesOwnership(row, expected)) {
          const error = new Error('record no longer matches the fixture ownership snapshot');
          error.cleanupReason = 'FIXTURE_OWNERSHIP_MISMATCH';
          throw error;
        }
        if (['navigation_items', 'page_sections', 'pages', 'products_analogs', 'product_codes', 'product_documents', 'product_specifications', 'product_images', 'products', 'categories'].includes(collection)) {
          const request = guardedDeleteRequest(collection, id, expected);
          await client.request(request.path, request.options);
        } else {
          const systemPath = collectionEndpoint(collection);
          await client.request(`${systemPath}/${encodeURIComponent(id)}`, { method: 'DELETE' });
        }
        appendCleanupAbsent(manifest, collection, id);
      }
      catch (error) { throw new Error(`Owned cleanup stopped at ${collection} (${cleanupReason(error)}); run status and retain manifest`); }
    }
  }
  manifest.phase = 'cleaned'; await saveManifest(path, manifest);
}

function appendCleanupAbsent(manifest, collection, id) {
  manifest.created[collection] = (manifest.created[collection] ?? []).filter(value => value !== id);
  delete manifest.pending[collection]?.[id];
  delete manifest.ownership[collection]?.[id];
}

export function cleanupReason(error) {
  if (error?.cleanupReason) return error.cleanupReason;
  const message = String(error?.message ?? '');
  const status = message.match(/HTTP (\d{3})/u)?.[1];
  if (status) return `HTTP_${status}`;
  const jsonStart = message.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const code = JSON.parse(message.slice(jsonStart)).errors?.[0]?.extensions?.code;
      if (typeof code === 'string' && /^[A-Z0-9_]{2,}$/u.test(code)) return code;
    } catch {}
  }
  return 'REQUEST_FAILED';
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
  run().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
