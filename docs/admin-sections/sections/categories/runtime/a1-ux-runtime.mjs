/**
 * Installed A1 category acceptance for the already-running owned Windows Directus.
 *
 * Run only after the lead has installed and hash-checked this candidate:
 *   node --env-file=dev/.env docs/admin-sections/sections/categories/runtime/a1-ux-runtime.mjs --synthetic-probe
 * Optional --only=<scenario-regex> narrows the browser scenarios but always runs
 * preflight, fixture setup required by the selected case, and exact-ID cleanup.
 * This probe never substitutes candidate modules into the browser.
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync, spawn } from 'node:child_process';
import { dirname, resolve, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../');
const extension = resolve(root, 'directus/extensions/deere-shop-product-editor');
const require = createRequire(resolve(root, 'storefront/package.json'));
const { chromium } = require('playwright');
const origin = 'http://127.0.0.1:18056';
const project = 'universal-commerce-cms-dev';
const mutexName = 'Global\\UniversalCommerceCMS-Directus-runtime-acceptance';
const args = process.argv.slice(2);
const only = args.find(arg => arg.startsWith('--only='))?.slice(7);
const siteEffectsOnly = args.includes('--site-effects');
assert.equal(process.platform, 'win32', 'Installed runtime acceptance is Windows-only');
assert.ok(args.includes('--synthetic-probe'), 'Explicit --synthetic-probe required before own-runtime writes');
assert.equal(process.env.DIRECTUS_URL, origin, 'Load the approved dev/.env; target must be exactly 127.0.0.1:18056');
assert.ok(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD, 'Load own dev credentials privately with --env-file');
if (siteEffectsOnly) {
  if (only) {
    const selected = new RegExp(only, 'i');
    assert.ok(selected.test('native category card content, SEO, readonly parent, preservation, and desktop/mobile capture'), '--site-effects --only must select the native category card scenario');
    assert.ok(selected.test('status intent changes are explicit; ordinary save preserves status; unknown status and native draft'), '--site-effects --only must select the status intent scenario');
  }
  assert.ok(process.env.A1_STOREFRONT_GATEWAY_TOKEN, 'Set the existing non-admin storefront gateway credential privately as A1_STOREFRONT_GATEWAY_TOKEN');
}

function docker(args) { return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
const serviceContainerIds = {};
function inspectService(service) {
  const ids = docker(['ps', '--filter', `label=com.docker.compose.project=${project}`, '--filter', `label=com.docker.compose.service=${service}`, '--format', '{{.ID}}']).split(/\s+/).filter(Boolean);
  assert.equal(ids.length, 1, `Expected exactly one ${service} service in the named project`);
  serviceContainerIds[service] = ids[0];
  return JSON.parse(docker(['inspect', ids[0]]))[0];
}
function hostPathFromDocker(source) {
  const normalized = source.replaceAll('\\', '/');
  const desktop = normalized.match(/^\/(?:run\/desktop\/mnt\/host|host_mnt)\/([a-z])(?:\/(.*))?$/i);
  if (desktop) return win32.resolve(`${desktop[1].toUpperCase()}:\\`, ...(desktop[2] ?? '').split('/').filter(Boolean));
  return resolve(source);
}
const container = inspectService('directus');
assert.equal(container.Config.Labels['com.docker.compose.project'], project);
assert.equal(container.Config.Labels['com.docker.compose.service'], 'directus');
assert.ok(container.NetworkSettings.Ports['8055/tcp']?.some(port => port.HostIp === '127.0.0.1' && port.HostPort === '18056'), 'Directus must be loopback-only on port 18056');
const composeFile = container.Config.Labels['com.docker.compose.project.config_files'];
assert.ok(typeof composeFile === 'string' && /[/\\]dev[/\\]compose\.yml$/i.test(composeFile), 'Refusing a runtime not owned by this repository dev/compose.yml');
function assertRepositoryCheckout(checkoutPath, label) {
  const checkoutRoot = resolve(checkoutPath);
  const repositoryRoot = execFileSync('git', ['-C', checkoutRoot, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  assert.equal(win32.resolve(repositoryRoot).toLowerCase(), win32.resolve(checkoutRoot).toLowerCase(), `${label} Compose file must be at the root of a repository checkout`);
  const remote = execFileSync('git', ['-C', checkoutRoot, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim().replace(/\.git$/i, '');
  assert.equal(remote.toLowerCase(), 'https://github.com/alexdubaev/universal-commerce-cms', `${label} Compose checkout must belong to this repository`);
  return checkoutRoot;
}
const directusComposeRoot = assertRepositoryCheckout(resolve(dirname(composeFile), '..'), 'Directus');
const extensionsMount = container.Mounts.find(mount => mount.Destination.replaceAll('\\', '/') === '/directus/extensions' && mount.Type === 'bind');
assert.ok(extensionsMount, 'Expected the named project extension bind mount');
const mountedExtension = hostPathFromDocker(extensionsMount.Source);
const mountedRoot = resolve(mountedExtension, '..', '..');
const directusVolumes = container.Mounts.filter(mount => mount.Type === 'volume');
assert.equal(directusVolumes.length, 1, 'Directus must mount only the project uploads volume');
assert.equal(directusVolumes[0].Name, `${project}_directus-uploads`, 'Directus must use this project\'s uploads volume');
assert.equal(directusVolumes[0].Destination.replaceAll('\\', '/'), '/directus/uploads');
const database = inspectService('db');
assert.equal(database.Config.Labels['com.docker.compose.project'], project);
assert.equal(database.Config.Labels['com.docker.compose.service'], 'db');
const databaseComposeFile = database.Config.Labels['com.docker.compose.project.config_files'];
assert.ok(typeof databaseComposeFile === 'string' && /[/\\]dev[/\\]compose\.yml$/i.test(databaseComposeFile), 'Database must use this repository\'s dev/compose.yml');
const databaseComposeRoot = assertRepositoryCheckout(resolve(dirname(databaseComposeFile), '..'), 'Database');
assert.equal(database.State.Running, true, 'Own database service must be running');
assert.equal(database.State.Health?.Status, 'healthy', 'Own database service must be healthy before fixture work');
const databaseVolumes = database.Mounts.filter(mount => mount.Type === 'volume');
assert.equal(databaseVolumes.length, 1, 'Database must mount only its project data volume');
assert.equal(databaseVolumes[0].Name, `${project}_postgres-data`, 'Database must use this project\'s PostgreSQL volume');
assert.equal(databaseVolumes[0].Destination.replaceAll('\\', '/'), '/var/lib/postgresql/data');
const mountedRepositoryRoot = assertRepositoryCheckout(mountedRoot, 'Mounted extension');
const expectedNetwork = `${project}_default`;
const directusNetwork = container.NetworkSettings.Networks?.[expectedNetwork];
const databaseNetwork = database.NetworkSettings.Networks?.[expectedNetwork];
assert.ok(directusNetwork?.NetworkID && databaseNetwork?.NetworkID, 'Both services must join the named project default network');
assert.equal(directusNetwork.NetworkID, databaseNetwork.NetworkID, 'Directus and database must share the same project network');
assert.deepEqual(Object.keys(container.NetworkSettings.Networks ?? {}), [expectedNetwork], 'Directus must use only the named project network');
assert.deepEqual(Object.keys(database.NetworkSettings.Networks ?? {}), [expectedNetwork], 'Database must use only the named project network');
const dbHost = container.Config.Env?.find(value => value.startsWith('DB_HOST='))?.slice('DB_HOST='.length);
assert.equal(dbHost, 'db', 'Directus must connect to the project database service by its compose name');
assert.equal(container.Config.Image, 'directus/directus:12.1.1', 'Expected the approved Directus image tag');
const installedDirectusVersion = docker(['exec', serviceContainerIds.directus, 'node', '-p', 'require("/directus/package.json").version']);
assert.equal(installedDirectusVersion, '12.1.1', 'Installed Directus package must be version 12.1.1');
const runtimeIdentity = {
  project,
  directusComposeFile: composeFile,
  databaseComposeFile,
  directusComposeRoot,
  databaseComposeRoot,
  mountedRepositoryRoot,
  directusComposeRepository: 'https://github.com/alexdubaev/Universal-Commerce-CMS',
  databaseComposeRepository: 'https://github.com/alexdubaev/Universal-Commerce-CMS',
  mountedRepository: 'https://github.com/alexdubaev/Universal-Commerce-CMS',
  composePathsDiffer: win32.resolve(composeFile).toLowerCase() !== win32.resolve(databaseComposeFile).toLowerCase(),
  sharedProjectNetwork: true,
  projectNetworkName: expectedNetwork,
  projectNetworkId: directusNetwork.NetworkID,
  dbHost,
  directusImage: container.Config.Image,
  installedDirectusVersion,
  directusUploadsVolume: directusVolumes[0].Name,
  postgresDataVolume: databaseVolumes[0].Name,
};

const run = randomUUID();
const marker = `a1ux-${run.slice(0, 8)}`;
const out = resolve(tmpdir(), 'universal-cms-a1-ux-runtime', run);
await mkdir(out, { recursive: true });
const journalPath = resolve(out, 'private-fixture-ledger.json');
const owned = [];
const results = [];
const errors = [];
const consoleErrors = [];
const requests = [];
const notes = [];
const siteEffects = { requested: siteEffectsOnly, ran: false, ttlSeconds: 300, publicationApi: [] };
const unexpectedDialogs = [];
const hashes = {};
let token, browser, context, page, lockProc;
let createAckLoss = false;
let updateAckLoss = false;
let malformedUpdateAck = false;
let failReadbackFor;
let allowOwnFixtureBeforeUnload = false;
let failedReadbackResponses = 0;
let lostUpdateAcknowledgements = 0;
let malformedUpdateAcknowledgements = 0;
let firstMountedViewOnboardingHandled = false;
let scenarioChecksStopped = false;
let scenarioChecksStopReason = '';
const statusText = { draft: 'Черновик', published: 'Опубликована', archived: 'Архив' };
const fields = 'id,status,title,slug,parent,description,image,image_alt,h1,intro,seo_title,seo_description,is_indexable,show_on_homepage,icon,icon_alt,seo_text,selection_guide,internal_links,faq,og_image,seo,redirect_target,translations,sort_order,created_at,updated_at';

function sha(value) { return createHash('sha256').update(value).digest('hex'); }
async function durableJournal(phase = '') {
  const payload = JSON.stringify({ run, target: origin, marker, createdAt: new Date().toISOString(), phase, runtimeIdentity, owned }, null, 2);
  const temporary = `${journalPath}.next`;
  const file = await open(temporary, 'w', 0o600);
  try { await file.writeFile(payload); await file.sync(); } finally { await file.close(); }
  await rename(temporary, journalPath);
}
async function request(path, { method = 'GET', body, anonymous = false, headers = {} } = {}) {
  const response = await fetch(origin + path, {
    method,
    headers: { ...(!anonymous && token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status} ${method} ${path.split('?')[0]}`), { status: response.status, json });
  return json.data ?? json;
}
function reserve(fields, kind = 'category') {
  const entry = { collection: 'categories', id: randomUUID(), kind, fields: structuredClone(fields), created: false, cleaned: false };
  owned.push(entry);
  return entry;
}
async function createReserved(entry) {
  await durableJournal(`before-api-create:${entry.id}`);
  const record = await request('/items/categories', { method: 'POST', body: { id: entry.id, ...entry.fields } });
  assert.equal(String(record.id), entry.id);
  entry.created = true;
  await durableJournal(`api-created:${entry.id}`);
  return record;
}
async function check(name, operation) {
  if (only && !new RegExp(only, 'i').test(name)) return;
  if (scenarioChecksStopped) {
    results.push({ name, status: 'SKIP', reason: scenarioChecksStopReason });
    return;
  }
  try { await operation(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); }
  catch (error) {
    results.push({ name, status: 'FAIL', error: error.message }); console.log(`FAIL ${name}: ${error.message}`);
    if (page) {
      await page.screenshot({ path: resolve(out, `failure-${results.length}.png`), fullPage: true }).catch(() => {});
      await writeFile(resolve(out, `failure-${results.length}-dom.txt`), await page.locator('body').innerText().catch(() => ''));
    }
    const pointerBlocked = /intercepts pointer events|not receiving pointer events/i.test(error.message);
    const unexpectedNativeOverlay = await hasUnexpectedNativeOverlay();
    if (pointerBlocked || unexpectedNativeOverlay) {
      scenarioChecksStopped = true;
      scenarioChecksStopReason = pointerBlocked
        ? 'Stopped after the preceding scenario hit a pointer-intercepting overlay; see its failure DOM/screenshot.'
        : 'Stopped after the preceding scenario found an unexpected native overlay; see its failure DOM/screenshot.';
      console.log(`STOP ${scenarioChecksStopReason}`);
    }
  }
}
async function hasUnexpectedNativeOverlay() {
  if (!page) return false;
  const overlays = page.locator('#dialog-outlet [role="dialog"], #dialog-outlet dialog, #dialog-outlet .v-dialog, #dialog-outlet .v-overlay');
  return overlays.evaluateAll(nodes => nodes.some(node => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return Boolean(node.innerText?.trim()) && style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  })).catch(() => false);
}
function itemPath(id) { return `/items/categories/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}`; }
async function read(id) { return request(itemPath(id)); }
function htmlText(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;');
}
async function storefrontGatewayCategories(slug) {
  const query = new URLSearchParams({
    fields: 'id,slug,title,description,h1,intro,seo_title,seo_description',
    limit: '200',
    sort: 'sort_order,title',
    filter: JSON.stringify({ slug: { _eq: slug } }),
  });
  const response = await fetch(`${origin}/commerce/storefront/items/categories?${query}`, {
    headers: { Authorization: `Bearer ${process.env.A1_STOREFRONT_GATEWAY_TOKEN}` },
  });
  const payload = await response.json().catch(() => ({}));
  assert.equal(response.status, 200, `Storefront category gateway should respond successfully (HTTP ${response.status})`);
  assert.ok(Array.isArray(payload.data), 'Storefront gateway must return a category data array');
  return payload.data;
}
async function assertNonAdminStorefrontCredential() {
  const authorization = { Authorization: `Bearer ${process.env.A1_STOREFRONT_GATEWAY_TOKEN}` };
  const identityResponse = await fetch(`${origin}/users/me?fields=id`, { headers: authorization });
  assert.equal(identityResponse.status, 200, 'The storefront gateway credential must resolve its own account');
  const identity = (await identityResponse.json()).data;
  assert.ok(identity?.id, 'The storefront gateway self-read must return an account ID');

  const roleFields = await request('/fields/directus_roles?fields=field');
  assert.ok(Array.isArray(roleFields), 'Administrator must be able to inspect the Directus role schema');
  const hasParentField = roleFields.some(field => field.field === 'parent');
  const userFields = [
    'id',
    'role.id', 'role.name', 'role.policies.policy.id', 'role.policies.policy.admin_access',
    'policies.policy.id', 'policies.policy.admin_access',
  ];
  if (hasParentField) userFields.push('role.parent');
  const account = await request(`/users/${encodeURIComponent(identity.id)}?fields=${encodeURIComponent(userFields.join(','))}`);
  assert.equal(String(account.id), String(identity.id), 'Administrator verification must read the exact account identified by the technical credential');
  assert.ok(account.role?.id, 'The technical account must have a known Directus role');

  const assignments = [...(account.policies ?? []), ...(account.role.policies ?? [])];
  const checkedRoles = new Set();
  let role = account.role;
  for (let depth = 0; role; depth++) {
    assert.ok(depth < 16, 'Refusing to accept an unbounded or cyclic role hierarchy');
    assert.ok(role.id && !checkedRoles.has(String(role.id)), 'Refusing a cyclic role hierarchy');
    checkedRoles.add(String(role.id));
    if (depth > 0) assignments.push(...(role.policies ?? []));
    const parent = hasParentField ? role.parent : null;
    if (!parent) break;
    const parentId = typeof parent === 'object' ? parent.id : parent;
    assert.ok(parentId, 'Role inheritance must resolve to an explicit parent ID');
    role = await request(`/roles/${encodeURIComponent(parentId)}?fields=${encodeURIComponent('id,name,parent,policies.policy.id,policies.policy.admin_access')}`);
  }
  assert.ok(assignments.length > 0, 'The technical account must have at least one directly assigned role or user policy');
  for (const assignment of assignments) {
    assert.ok(assignment?.policy?.id, 'Every assigned policy must resolve to an exact policy record');
    assert.equal(typeof assignment.policy.admin_access, 'boolean', 'Every assigned policy admin_access value must be readable');
    assert.equal(assignment.policy.admin_access, false, 'The technical credential must not have an admin-access policy');
  }
}
async function verifyPublishedStorefrontCategory(entry) {
  const rows = await storefrontGatewayCategories(entry.fields.slug);
  assert.equal(rows.length, 1, 'Published own category must be visible through the storefront gateway');
  const row = rows[0];
  assert.equal(String(row.id), entry.id);
  for (const field of ['title', 'description', 'h1', 'intro', 'seo_title', 'seo_description']) {
    assert.equal(row[field], entry.fields[field], `Storefront gateway must read back own ${field}`);
  }
  const response = await fetch(`http://127.0.0.1:3000/category/${encodeURIComponent(entry.fields.slug)}`, { redirect: 'manual' });
  assert.equal(response.status, 200, `Live Next category route must respond with HTTP 200 (HTTP ${response.status})`);
  const rendered = await response.text();
  assert.ok(rendered.includes(`<h1>${htmlText(entry.fields.h1)}</h1>`), 'Rendered category must contain the saved own H1');
  assert.ok(rendered.includes(`<p>${htmlText(entry.fields.intro)}</p>`), 'Rendered category must contain the saved own introduction');
  const titleMatch = rendered.match(/<title[^>]*>(.*?)<\/title>/s);
  assert.ok(titleMatch && titleMatch[1].includes(htmlText(entry.fields.seo_title)), 'Rendered document title must use the saved SEO title');
  const descriptionTag = rendered.match(/<meta\b[^>]*name="description"[^>]*>/i)?.[0];
  assert.ok(descriptionTag?.includes(`content="${htmlText(entry.fields.seo_description)}"`), 'Rendered metadata must use the saved SEO description');
  // The response body is inspected only in memory; never persist raw catalog HTML or payload.
  siteEffects.ran = true;
  siteEffects.storefrontRouteStatus = response.status;
  siteEffects.renderedOwnContent = true;
}
async function update(id, current, changes) {
  const expected = { id, updated_at: current.updated_at, ...Object.fromEntries(Object.keys(changes).map(key => [key, current[key]])) };
  const result = await request(`/commerce/mutations/categories/${encodeURIComponent(id)}`, { method: 'POST', body: { expected, changes } });
  if (Object.hasOwn(changes, 'slug')) {
    const refreshed = await read(id);
    assert.equal(refreshed.slug, changes.slug, 'Owned slug change must be confirmed by a fresh read before updating cleanup ownership');
    assert.ok(String(refreshed.title).startsWith(marker), 'Owned slug change must still belong to this run');
    const entry = owned.find(candidate => candidate.collection === 'categories' && candidate.id === id);
    assert.ok(entry, 'Refusing to journal a slug change for an unreserved ID');
    entry.fields.slug = changes.slug;
    await durableJournal(`verified-owned-slug-change:${id}`);
  }
  return result;
}
async function waitValue(id, field, value) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (JSON.stringify((await read(id))[field] ?? null) === JSON.stringify(value ?? null)) return;
    await new Promise(resolvePromise => setTimeout(resolvePromise, 100));
  }
  assert.deepEqual((await read(id))[field] ?? null, value ?? null);
}
const input = field => page.locator(`.a1cat-editor [data-field="${field}"] input, .a1cat-editor [data-field="${field}"] textarea`).first();
const save = () => page.locator('.a1cat-editor .ac-shell__header').getByRole('button', { name: 'Сохранить', exact: true });
const tab = label => page.getByRole('tab', { name: label, exact: true }).click();
async function navigateOwnedCategoryPage(path) {
  const target = new URL(path, origin);
  assert.equal(target.origin, origin);
  const match = target.pathname.match(/^\/admin\/product-editor\/sections\/categories(?:\/([^/]+))?$/);
  assert.ok(match, 'Harness navigation is restricted to the own category section');
  const segment = match[1] ? decodeURIComponent(match[1]) : '';
  if (segment && segment !== '+') assert.ok(owned.some(entry => entry.collection === 'categories' && entry.id === segment), 'Harness navigation may open only a journaled own category');
  allowOwnFixtureBeforeUnload = true;
  try { await page.goto(target.href); } finally { allowOwnFixtureBeforeUnload = false; }
}
async function openList() {
  await navigateOwnedCategoryPage('/admin/product-editor/sections/categories');
  await page.locator('.a1cat-list').waitFor();
  if (!firstMountedViewOnboardingHandled) {
    await dismissObservedDirectusOnboardingPrompts();
    firstMountedViewOnboardingHandled = true;
  }
}
async function openCard(id) { await navigateOwnedCategoryPage(`/admin/product-editor/sections/categories/${encodeURIComponent(id)}`); await input('title').waitFor(); }
async function assertRenderedListIds(expected, label) {
  await page.waitForFunction(ids => {
    const current = [...document.querySelectorAll('.a1cat-list tbody a.a1cat-name')].map(node => decodeURIComponent(new URL(node.href).pathname.split('/').at(-1)));
    return JSON.stringify(current) === JSON.stringify(ids);
  }, expected, { timeout: 15000 });
  const actual = await page.locator('.a1cat-list tbody a.a1cat-name').evaluateAll(nodes => nodes.map(node => decodeURIComponent(new URL(node.href).pathname.split('/').at(-1))));
  assert.deepEqual(actual, expected, label);
}
async function screenshot(name, width, height) {
  await page.setViewportSize({ width, height });
  const size = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  await page.screenshot({ path: resolve(out, name), fullPage: false, animations: 'disabled' });
  assert.ok(size.scroll <= size.client + 1, `Horizontal overflow: ${JSON.stringify(size)}`);
}
async function assertCleanEditorCopy() {
  const surfaces = page.locator('.a1cat-editor .ac-shell, .a1cat-list .ac-shell, .category-comparison, .a1cat-dialog[open], .category-status-dialog[open]');
  await page.waitForFunction(() => [...document.querySelectorAll('.a1cat-editor .ac-shell, .a1cat-list .ac-shell, .category-comparison, .a1cat-dialog[open], .category-status-dialog[open]')].some(node => node.innerText?.trim()), null, { timeout: 15000 });
  const visibleText = (await surfaces.evaluateAll(nodes => nodes.map(node => node.innerText).filter(Boolean))).join('\n');
  assert.ok(visibleText.trim(), 'A category list/editor surface must be visible for the copy check');
  assert.doesNotMatch(visibleText, /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i, 'Editor UI must not expose raw UUIDs');
  assert.doesNotMatch(visibleText, /\b(?:directus|json|slug)\b/i, 'Editor UI must use human wording rather than implementation terms');
}
async function dismissObservedDirectusLicensePrompt() {
  const outlet = page.locator('#dialog-outlet');
  const promptTitle = outlet.getByText('Have a license key?', { exact: true });
  const visible = await promptTitle.waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false);
  if (!visible) return;
  for (const label of ['I have a license key', "I'm using Core plan"]) {
    await outlet.getByText(label, { exact: true }).waitFor({ state: 'visible' });
  }
  const skip = outlet.getByRole('button', { name: 'Пропустить', exact: true });
  assert.equal(await skip.count(), 1, 'Only the observed Directus license prompt skip action may be used');
  await skip.click();
  await promptTitle.waitFor({ state: 'hidden' });
}
async function dismissObservedDirectusOwnerPrompt() {
  const outlet = page.locator('#dialog-outlet');
  const promptTitle = outlet.getByText('You have not set a project owner.', { exact: true });
  const visible = await promptTitle.waitFor({ state: 'visible', timeout: 2500 }).then(() => true).catch(() => false);
  if (!visible) return;
  const promptText = await outlet.innerText();
  await outlet.getByText('Почта владельца', { exact: true }).waitFor({ state: 'visible' });
  assert.match(promptText, /MSCL/i, 'Owner reminder must include the observed MSCL compliance label');
  const remindLater = outlet.getByRole('button', { name: 'Remind Later', exact: true });
  assert.equal(await remindLater.count(), 1, 'Only the exact non-binding owner reminder action may be used');
  assert.equal(await outlet.getByRole('button', { name: 'Set Owner', exact: true }).count(), 1, 'Owner setup action must be present to identify the observed prompt');
  await remindLater.click();
  await promptTitle.waitFor({ state: 'hidden' });
}
async function dismissObservedDirectusOnboardingPrompts() {
  await dismissObservedDirectusLicensePrompt();
  await dismissObservedDirectusOwnerPrompt();
}
function tagFields(index, overrides = {}) {
  return {
    status: 'draft', title: index === 25 || index === 26 ? `${marker} Одинаковое название` : `${marker} Категория ${String(index).padStart(2, '0')}`,
    slug: `${marker}-${index}`, description: `${marker} описание ${index}`, h1: `${marker} H1 ${index}`,
    intro: `${marker} вводный текст ${index}`, seo_title: `${marker} SEO ${index}`,
    seo_description: `${marker} SEO описание ${index}`, is_indexable: index % 2 === 0,
    show_on_homepage: index % 2 === 0, sort_order: index % 3, seo: { unknownA1: { retained: true } },
    translations: { legacy: { title: `${marker} legacy` } }, ...overrides,
  };
}

try {
  const ps = `$m=[Threading.Mutex]::new($false,'${mutexName}');if(!$m.WaitOne(0)){exit 73};try{[Console]::WriteLine('LOCKED');[Console]::In.ReadLine()|Out-Null}finally{$m.ReleaseMutex();$m.Dispose()}`;
  lockProc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  await new Promise((resolvePromise, reject) => {
    let output = '';
    lockProc.stdout.setEncoding('utf8');
    lockProc.stdout.on('data', chunk => { output += chunk; if (output.includes('LOCKED')) resolvePromise(); });
    lockProc.once('exit', code => reject(new Error(code === 73 ? 'Another shared Directus runtime writer holds the acceptance mutex' : `Mutex helper exited ${code}`)));
    lockProc.once('error', reject);
  });
  await durableJournal('initialized-before-auth-or-write');

  // Prove candidate == installed bind mount before creating synthetic data.
  const localArtifact = await readFile(resolve(extension, 'dist/sections/categories.js'));
  const mountedArtifact = await readFile(resolve(mountedExtension, 'deere-shop-product-editor/dist/sections/categories.js'));
  const localSource = await readFile(resolve(extension, 'src/sections/categories.js'));
  const mountedSource = await readFile(resolve(mountedExtension, 'deere-shop-product-editor/src/sections/categories.js'));
  assert.ok(mountedArtifact.equals(localArtifact) && mountedSource.equals(localSource), 'Installed bind mount is not this exact candidate');
  hashes['categories.js'] = { candidate: sha(localArtifact), mounted: sha(mountedArtifact) };
  const distResponse = await fetch(`${origin}/extensions/sources/sections/categories.js`);
  if (distResponse.ok) hashes['served-category-source'] = sha(await distResponse.arrayBuffer());
  const installedIndexResponse = await fetch(`${origin}/extensions/sources/index.js`);
  assert.equal(installedIndexResponse.status, 200, 'Directus must serve its installed extension registry bundle');
  assert.match(installedIndexResponse.headers.get('content-type') ?? '', /javascript/i, 'Installed extension registry must be JavaScript');
  const installedIndex = await installedIndexResponse.text();
  assert.ok(installedIndex.includes('a1cat-editor') && installedIndex.includes('Изменить публикацию'), 'Served installed registry must contain the category editor and approved publication control');
  hashes['served-extensions-index'] = sha(installedIndex);
  token = (await request('/auth/login', { method: 'POST', body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } })).access_token;
  assert.ok(token, 'Own local Directus authentication failed');
  const serverInfo = await request('/server/info');
  assert.ok(serverInfo && typeof serverInfo === 'object', 'Authenticated /server/info readiness request must succeed');
  if (siteEffectsOnly) {
    await assertNonAdminStorefrontCredential();
  }
  const [metadata, permission] = await Promise.all([request('/fields/categories'), request('/permissions/me')]);
  for (const field of ['id', 'status', 'title', 'slug', 'updated_at', 'seo_title', 'seo_description']) assert.ok(metadata.some(row => row.field === field), `Missing live category metadata ${field}`);
  for (const action of ['read', 'create', 'update']) assert.ok(permission.categories?.[action], `Administrator lacks required categories ${action} permission`);
  await durableJournal('preflight-passed-before-fixture-writes');

  const primary = reserve(tagFields(0, { title: `${marker} Основная`, slug: `${marker}-main`, seo: { unknownA1: { retained: true }, legacy: '' } }), 'editor');
  await createReserved(primary);
  const listFixtures = [];
  for (let index = 1; index <= 26; index++) listFixtures.push(await createReserved(reserve(tagFields(index), 'paging')));
  let unknownStatusFixture = null;
  try {
    unknownStatusFixture = await createReserved(reserve(tagFields(90, { status: 'legacy_a1_unknown' }), 'unknown-status'));
  } catch (error) {
    if (![400, 422].includes(error.status)) throw error;
    notes.push('Unknown status scenario skipped because live schema rejected the synthetic status value.');
    results.push({ name: 'unknown status preservation (schema-gated)', status: 'SKIP' });
  }
  const nativeCreate = reserve({}, 'native-create');
  const nativeLostCreate = reserve({}, 'native-create-lost-ack');
  let activeNativeCreate = nativeCreate;

  // Keep candidate installed. This route only journals/injects a known UUID
  // into the test transport because the native form intentionally sends no ID.
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1536, height: 1024 } });
  await context.route('**/items/categories', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const payload = route.request().postDataJSON();
    if (!payload || payload.id) return route.continue();
    assert.ok(activeNativeCreate && !activeNativeCreate.created, 'No fresh reserved UUID exists for this native create');
    activeNativeCreate.fields = structuredClone(payload);
    await durableJournal(`before-native-create-post:${activeNativeCreate.id}`);
    const patched = { ...payload, id: activeNativeCreate.id };
    if (createAckLoss) {
      createAckLoss = false;
      await route.fetch({ postData: JSON.stringify(patched) });
      activeNativeCreate.created = true;
      await durableJournal(`native-create-committed-response-lost:${activeNativeCreate.id}`);
      return route.abort('failed');
    }
    const response = await route.fetch({ postData: JSON.stringify(patched) });
    if (response.ok()) { activeNativeCreate.created = true; await durableJournal(`native-created:${activeNativeCreate.id}`); }
    return route.fulfill({ response });
  });
  await context.route('**/items/categories/*', async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'GET' && failReadbackFor && path.endsWith(`/${failReadbackFor}`)) {
      failReadbackFor = undefined;
      failedReadbackResponses++;
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ errors: [{ message: 'Controlled readback outage' }] }) });
    }
    return route.continue();
  });
  await context.route('**/commerce/mutations/categories/**', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const path = new URL(route.request().url()).pathname;
    if (failReadbackFor && path.endsWith(`/${failReadbackFor}`)) return route.continue();
    if (updateAckLoss && path.endsWith(`/${primary.id}`)) {
      updateAckLoss = false;
      await route.fetch();
      lostUpdateAcknowledgements++;
      return route.abort('failed');
    }
    if (malformedUpdateAck && path.endsWith(`/${primary.id}`)) {
      malformedUpdateAck = false;
      await route.fetch();
      malformedUpdateAcknowledgements++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":' });
    }
    return route.continue();
  });
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => {
    if (dialog.type() === 'beforeunload' && allowOwnFixtureBeforeUnload) { await dialog.accept(); return; }
    unexpectedDialogs.push(dialog.type());
    await dialog.dismiss();
  });
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('request', requestEvent => {
    if (/\/items\/categories|\/commerce\/mutations\/categories|\/permissions\/me\/categories/.test(requestEvent.url())) {
      requests.push({ method: requestEvent.method(), path: new URL(requestEvent.url()).pathname, body: requestEvent.method() === 'POST' ? requestEvent.postDataJSON() : undefined });
    }
  });
  await page.goto(`${origin}/admin/login`);
  await page.locator('input[type=email]').fill(process.env.ADMIN_EMAIL);
  await page.locator('input[type=password]').fill(process.env.ADMIN_PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(url => !url.pathname.endsWith('/login'), { timeout: 30000 });
  await dismissObservedDirectusOnboardingPrompts();

  await check('synthetic list, real paging, all sort directions, stable id tie-breaker, desktop and mobile', async () => {
    await openList();
    const search = page.getByRole('searchbox', { name: 'Поиск категорий' });
    await search.fill(marker); await page.waitForTimeout(350);
    await page.getByRole('table').waitFor();
    assert.equal(await page.locator('.a1cat-list tbody tr').count(), 25);
    const next = page.getByRole('button', { name: 'Следующая страница', exact: true });
    await next.click(); await page.waitForTimeout(350);
    assert.ok([2, 3].includes(await page.locator('.a1cat-list tbody tr').count()));
    await page.getByRole('button', { name: 'Предыдущая страница', exact: true }).click(); await page.waitForTimeout(350);
    const sort = page.getByLabel('Сортировка', { exact: true });
    await sort.selectOption('title'); await page.waitForTimeout(300);
    for (const direction of ['-updated_at', 'updated_at', 'title', '-title', 'slug', '-slug', 'sort_order', '-sort_order']) {
      const pageResponse = (offset) => page.waitForResponse(response => {
        if (response.request().method() !== 'GET' || new URL(response.url()).pathname !== '/items/categories') return false;
        const query = new URL(response.url()).searchParams;
        return query.get('sort') === `${direction},id` && Number(query.get('offset') ?? 0) === offset;
      });
      const firstPagePromise = pageResponse(0);
      await sort.selectOption(direction);
      const firstPageResponse = await firstPagePromise;
      const firstPageJson = await firstPageResponse.json();
      const firstQuery = new URL(firstPageResponse.url()).searchParams;
      assert.equal(firstQuery.get('sort'), `${direction},id`);
      assert.equal(Number(firstQuery.get('offset') ?? 0), 0);
      assert.ok(Number(firstPageJson.meta?.filter_count) > 25, `Expected more than 25 server matches for ${direction}`);
      assert.equal(firstPageJson.data.length, 25, `${direction} first page should contain 25 rows`);
      const firstServerIds = firstPageJson.data.map(row => String(row.id));
      await assertRenderedListIds(firstServerIds, `Rendered first page must follow server response for ${direction}`);

      const secondPagePromise = pageResponse(25);
      await page.getByRole('button', { name: 'Следующая страница', exact: true }).click();
      const secondPageResponse = await secondPagePromise;
      const secondPageJson = await secondPageResponse.json();
      const secondQuery = new URL(secondPageResponse.url()).searchParams;
      assert.equal(secondQuery.get('sort'), `${direction},id`);
      assert.equal(Number(secondQuery.get('offset')), 25);
      assert.ok(secondPageJson.data.length > 0, `${direction} second server page must contain rows`);
      const secondServerIds = secondPageJson.data.map(row => String(row.id));
      await assertRenderedListIds(secondServerIds, `Rendered second page must follow server response for ${direction}`);
      const allRows = [...firstPageJson.data, ...secondPageJson.data];
      const allIds = allRows.map(row => String(row.id));
      assert.equal(new Set(allIds).size, allIds.length, `${direction} pages must not duplicate server IDs`);
      assert.ok(new Set(allIds).size > 25, `${direction} must verify more than one page of distinct server IDs`);
      if (['title', '-title', 'sort_order', '-sort_order'].includes(direction)) {
        const field = direction.replace(/^-/, '');
        const tied = new Map();
        for (const row of allRows) {
          const key = String(row[field]);
          tied.set(key, [...(tied.get(key) ?? []), String(row.id)]);
        }
        for (const tiedIds of tied.values()) if (tiedIds.length > 1) assert.deepEqual(tiedIds, [...tiedIds].sort(), `${direction} must apply the ascending id tie-breaker`);
      }
      const firstPageAgain = pageResponse(0);
      await page.getByRole('button', { name: 'Предыдущая страница', exact: true }).click();
      await firstPageAgain;
    }
    await search.fill(''); await search.press('Enter');
    await search.fill(`${marker}-main`); await search.press('Enter'); await page.waitForTimeout(300);
    await screenshot('categories-list-1536.png', 1536, 1024);
    await screenshot('categories-list-390.png', 390, 844);
  });

  await check('list context survives card return with search, filters, sort and page', async () => {
    await openList();
    const search = page.getByRole('searchbox', { name: 'Поиск категорий' });
    await search.fill(marker); await page.waitForTimeout(350);
    await page.getByLabel('Сортировка', { exact: true }).selectOption('title'); await page.waitForTimeout(250);
    await page.getByLabel('Статус', { exact: true }).selectOption('draft'); await page.waitForTimeout(250);
    const opener = page.getByRole('button', { name: /Фильтры/ }).first(); await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Фильтры категорий' }); await dialog.waitFor();
    await dialog.locator('.a1cat-parent-trigger').click();
    await dialog.getByRole('button', { name: 'Без родителя', exact: true }).click();
    await dialog.getByRole('button', { name: 'Применить', exact: true }).click(); await page.waitForTimeout(350);
    await page.getByRole('button', { name: 'Следующая страница', exact: true }).click(); await page.waitForTimeout(350);
    const firstLink = page.locator('.a1cat-name').first(); await firstLink.click(); await input('title').waitFor();
    await page.locator('.a1cat-editor .ac-toolbar').getByRole('button', { name: 'К списку категорий', exact: true }).click();
    await page.locator('.a1cat-list').waitFor();
    await page.waitForFunction(() => {
      const list = document.querySelector('.a1cat-list');
      const rows = list?.querySelectorAll('.ac-list tbody tr').length ?? 0;
      const pagination = list?.querySelector('.a1cat-pagination');
      const range = pagination?.querySelector('[aria-live="polite"]')?.innerText ?? '';
      const pageLabel = pagination?.querySelector('.a1cat-pager')?.innerText ?? '';
      return rows > 0 && !/Загрузка/.test(range) && /2\s*\/\s*2/.test(pageLabel);
    }, null, { timeout: 15000 });
    assert.equal(await page.getByRole('searchbox', { name: 'Поиск категорий' }).inputValue(), marker);
    assert.equal(await page.getByLabel('Сортировка', { exact: true }).inputValue(), 'title');
    assert.equal(await page.getByLabel('Статус', { exact: true }).inputValue(), 'draft');
    assert.equal(await page.locator('.a1cat-pagination').innerText().then(value => /2\s*\/\s*2/.test(value)), true);
    assert.ok(await page.getByRole('button', { name: 'Убрать фильтр Родитель: без родителя' }).count());
    await page.getByRole('button', { name: 'Сбросить фильтры', exact: true }).click();
  });

  await check('filter dialog cancel/apply focus; no results, controlled empty/error/403 labels', async () => {
    await openList(); const search = page.getByRole('searchbox', { name: 'Поиск категорий' });
    const opener = page.getByRole('button', { name: /Фильтры/ }).first();
    await opener.click(); const dialog = page.getByRole('dialog', { name: 'Фильтры категорий' }); await dialog.waitFor();
    await dialog.getByLabel('Индексация', { exact: true }).selectOption('false');
    const before = requests.length; await page.keyboard.press('Escape');
    assert.equal(requests.length, before); assert.equal(await opener.evaluate(node => node === document.activeElement), true);
    await search.fill(`${marker}-does-not-exist`); await page.waitForTimeout(350);
    await page.getByRole('heading', { name: 'Категории не найдены', exact: true }).waitFor();
    const listRequest = '**/items/categories?**';
    await page.route(listRequest, route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ errors: [{ message: 'Controlled permission response', extensions: { code: 'FORBIDDEN' } }] }) }), { times: 1 });
    await page.reload(); await page.getByRole('heading', { name: 'Не удалось загрузить категории', exact: true }).waitFor();
    await page.getByText(/Недостаточно прав/).waitFor();
    await screenshot('controlled-403-1536.png', 1536, 1024);
    await screenshot('controlled-403-390.png', 390, 844);
    await page.setViewportSize({ width: 1536, height: 1024 });
    await page.unroute(listRequest);
    await search.fill(marker); await page.waitForTimeout(350); await page.getByRole('table').waitFor();
    await page.route(listRequest, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ errors: [{ message: 'Controlled network response' }] }) }), { times: 1 });
    await page.reload(); await page.getByRole('heading', { name: 'Не удалось загрузить категории', exact: true }).waitFor();
    await page.getByText(/Проверьте (?:связь|соединение)/).waitFor();
    await screenshot('controlled-error-1536.png', 1536, 1024);
    await screenshot('controlled-error-390.png', 390, 844);
    await page.setViewportSize({ width: 1536, height: 1024 });
    await page.unroute(listRequest); await page.getByRole('button', { name: 'Повторить', exact: true }).click(); await page.getByRole('table').waitFor();
  });

  await check('native category card content, SEO, readonly parent, preservation, and desktop/mobile capture', async () => {
    await openCard(primary.id); await screenshot('category-main-1536.png', 1536, 1024); await screenshot('category-main-390.png', 390, 844);
    await assertCleanEditorCopy();
    await page.getByText('Верхний уровень каталога', { exact: true }).waitFor();
    await page.getByText('Перемещение категории пока недоступно. Остальные сведения можно изменить.', { exact: true }).waitFor();
    assert.equal(await page.locator('.a1cat-editor [data-field="parent"] input, .a1cat-editor [data-field="parent"] textarea, .a1cat-editor [data-field="parent"] select').count(), 0, 'Parent must be displayed as read-only context');
    assert.equal(await input('title').inputValue(), primary.fields.title);
    await input('description').fill(`${marker} изменение описания`);
    await page.getByText('Изменены поля, влияющие на сайт.', { exact: true }).waitFor();
    await save().click(); await waitValue(primary.id, 'description', `${marker} изменение описания`);
    assert.equal(await page.getByText('Изменены поля, влияющие на сайт.', { exact: true }).count(), 0, 'Site-impact notice should clear after successful save');
    await input('title').fill(`${marker} Обновлённая`);
    await input('image_alt').fill(`${marker} описание изображения`);
    await tab('Содержание'); await input('h1').fill(`${marker} Заголовок H1`); await input('intro').fill(`${marker} вступление`);
    await screenshot('category-content-1536.png', 1536, 1024);
    await assertCleanEditorCopy();
    await tab('Поиск и ссылки'); await input('seo_title').fill(`${marker} SEO новое`);
    await input('seo_description').fill(`${marker} SEO описание новое`);
    await screenshot('category-seo-1536.png', 1536, 1024);
    await screenshot('category-seo-390.png', 390, 844);
    await assertCleanEditorCopy();
    await save().click(); await waitValue(primary.id, 'title', `${marker} Обновлённая`);
    const after = await read(primary.id);
    assert.equal(after.description, `${marker} изменение описания`);
    assert.equal(after.image_alt, `${marker} описание изображения`);
    assert.equal(after.h1, `${marker} Заголовок H1`);
    assert.equal(after.intro, `${marker} вступление`);
    assert.equal(after.seo_title, `${marker} SEO новое`);
    assert.equal(after.seo_description, `${marker} SEO описание новое`);
    assert.deepEqual(after.seo?.unknownA1, { retained: true }, 'Unknown SEO keys must survive projection/readback');
    assert.equal(after.translations?.legacy?.title, `${marker} legacy`);
    assert.equal(after.show_on_homepage, primary.fields.show_on_homepage);
    Object.assign(primary.fields, {
      title: after.title,
      description: after.description,
      image_alt: after.image_alt,
      h1: after.h1,
      intro: after.intro,
      seo_title: after.seo_title,
      seo_description: after.seo_description,
    });
    await durableJournal(`verified-primary-card-readback:${primary.id}`);
    const mutation = requests.filter(item => item.method === 'POST' && item.path === `/commerce/mutations/categories/${primary.id}`).at(-1);
    assert.ok(mutation);
    assert.equal(Object.hasOwn(mutation.body.changes, 'parent'), false, 'Readonly parent must not enter the mutation delta');
    assert.equal(await page.getByRole('button', { name: /Удалить категорию|Удалить/ }).count(), 0, 'Category delete UI is absent');
    await tab('Дополнительно'); await screenshot('category-advanced-1536.png', 1536, 1024);
    await screenshot('category-advanced-390.png', 390, 844);
    await assertCleanEditorCopy();
  });

  await check('status intent changes are explicit; ordinary save preserves status; unknown status and native draft', async () => {
    await openCard(primary.id);
    await page.getByRole('button', { name: 'Изменить публикацию', exact: true }).click();
    let publicationDialog = page.getByRole('dialog', { name: 'Изменить публикацию', exact: true });
    await publicationDialog.waitFor();
    await assertCleanEditorCopy();
    for (const effect of ['Страница не публикуется на сайте.', 'Страница доступна посетителям сайта.', 'Страница снята с публикации и сохранена.']) {
      await publicationDialog.getByText(effect, { exact: true }).waitFor();
    }
    const publishedOption = publicationDialog.getByRole('radio', { name: 'Опубликована', exact: true });
    const draftOption = publicationDialog.getByRole('radio', { name: 'Черновик', exact: true });
    await draftOption.focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await publishedOption.getAttribute('aria-checked'), 'true', 'Arrow keys should move the checked publication option');
    await page.keyboard.press('End');
    assert.equal(await publicationDialog.getByRole('radio', { name: 'Архив', exact: true }).getAttribute('aria-checked'), 'true');
    await page.keyboard.press('Home');
    assert.equal(await draftOption.getAttribute('aria-checked'), 'true', 'Home should select the first publication option');
    await publishedOption.click();
    assert.equal(await publishedOption.getAttribute('aria-checked'), 'true');
    await publicationDialog.getByText(/Выбрано: Опубликована/).waitFor();
    await publicationDialog.getByRole('button', { name: 'Отмена', exact: true }).click();
    await input('title').fill(`${marker} Ordinary save leaves draft`); await save().click(); await waitValue(primary.id, 'title', `${marker} Ordinary save leaves draft`);
    assert.equal((await read(primary.id)).status, 'draft');
    primary.fields.title = `${marker} Ordinary save leaves draft`;
    await durableJournal(`verified-primary-status-preserving-save:${primary.id}`);
    for (const [label, value] of [['Архив', 'archived'], ['Опубликована', 'published'], ['Черновик', 'draft']]) {
      await page.getByRole('button', { name: 'Изменить публикацию', exact: true }).click();
      publicationDialog = page.getByRole('dialog', { name: 'Изменить публикацию', exact: true }); await publicationDialog.waitFor();
      const option = publicationDialog.getByRole('radio', { name: label, exact: true });
      await option.click();
      assert.equal(await option.getAttribute('aria-checked'), 'true');
      if (value === 'archived') { await assertCleanEditorCopy(); await screenshot('category-publication-1536.png', 1536, 1024); await screenshot('category-publication-390.png', 390, 844); }
      await publicationDialog.getByRole('button', { name: 'Применить к форме', exact: true }).click();
      await save().click(); await waitValue(primary.id, 'status', value);
      if (siteEffectsOnly) {
        const visible = await storefrontGatewayCategories(primary.fields.slug);
        if (value === 'published') {
          await verifyPublishedStorefrontCategory(primary);
          siteEffects.publicationApi.push({ status: value, visibleOwnRows: visible.length, ownRecordMatched: String(visible[0]?.id) === primary.id });
          assert.equal(String(visible[0]?.id), primary.id, 'Published category must pass the non-admin gateway visibility filter');
        } else {
          assert.deepEqual(visible, [], `Storefront gateway must exclude ${value} categories`);
          siteEffects.publicationApi.push({ status: value, visibleOwnRows: 0, excluded: true });
        }
      }
    }
    if (siteEffectsOnly) {
      assert.equal(siteEffects.ran, true, 'Site effects require a successful live Next route assertion while the owned category is published');
      notes.push('Live site-effects check used the existing verified non-admin gateway account; Next category caching is 300 seconds, so immediate storefront visibility after unpublishing was not asserted. Gateway exclusion of draft and archived states was checked directly.');
    } else {
      notes.push('Live storefront effects were NOT RUN. The optional --site-effects closure was not requested.');
    }
    if (unknownStatusFixture) {
      await openCard(unknownStatusFixture.id);
      assert.ok(await page.getByText('Неизвестный статус', { exact: true }).count());
      await input('title').fill(`${marker} unknown retained`); await save().click();
      await waitValue(unknownStatusFixture.id, 'title', `${marker} unknown retained`);
      assert.equal((await read(unknownStatusFixture.id)).status, 'legacy_a1_unknown');
      await page.locator('.a1cat-editor .ac-toolbar').getByRole('button', { name: 'К списку категорий', exact: true }).click();
    }
    await openCard(primary.id);
    await navigateOwnedCategoryPage('/admin/product-editor/sections/categories/+');
    await assertCleanEditorCopy();
    await input('title').fill(`${marker} Native draft`); await input('slug').fill(`${marker}-native`);
    assert.ok(await page.getByText('Новая категория будет создана как черновик.').count());
    await screenshot('category-native-create-1536.png', 1536, 1024);
    await screenshot('category-native-create-390.png', 390, 844);
    await page.setViewportSize({ width: 1536, height: 1024 });
    const nativePost = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/items/categories');
    await page.getByRole('button', { name: /Создать черновик/ }).click();
    const response = await nativePost; assert.equal(response.status(), 200);
    assert.equal(nativeCreate.created, true, 'Native draft create must be journaled under its reserved transport UUID');
    assert.equal((await read(nativeCreate.id)).status, 'draft');
    activeNativeCreate = nativeLostCreate;
  });

  await check('native create with reserved transport UUID and lost acknowledgement blocks retry', async () => {
    activeNativeCreate = nativeLostCreate;
    await navigateOwnedCategoryPage('/admin/product-editor/sections/categories/+');
    await input('title').fill(`${marker} Native uncertain`); await input('slug').fill(`${marker}-native-lost`);
    createAckLoss = true;
    await page.getByRole('button', { name: /Создать черновик/ }).click();
    await page.getByRole('heading', { name: 'Создание не подтверждено', exact: true }).waitFor();
    await assertCleanEditorCopy();
    await screenshot('category-native-create-uncertain-1536.png', 1536, 1024);
    await screenshot('category-native-create-uncertain-390.png', 390, 844);
    await page.setViewportSize({ width: 1536, height: 1024 });
    assert.equal(nativeLostCreate.created, true);
    assert.equal(await page.getByRole('button', { name: /Создать черновик/ }).isDisabled(), true);
    await page.getByRole('button', { name: 'Проверить результат создания', exact: true }).click();
    assert.equal((await request(itemPath(nativeLostCreate.id))).status, 'draft');
  });

  await check('duplicate address and validation focus; real CAS409 retains local changes and reconcile', async () => {
    await openCard(primary.id); await input('slug').fill(`${marker}-bad slug`); await save().click();
    await page.getByText(/Адрес категории: используйте строчные латинские буквы/).waitFor();
    assert.equal(await input('slug').evaluate(node => node === document.activeElement), true);
    await screenshot('category-validation-1536.png', 1536, 1024);
    await screenshot('category-validation-390.png', 390, 844);
    await page.setViewportSize({ width: 1536, height: 1024 });
    await input('slug').fill(listFixtures[0].slug); await save().click();
    await page.getByText(/Этот адрес уже (?:занят|используется)/).waitFor();
    await input('slug').waitFor(); await input('slug').focus();
    await input('slug').fill(primary.fields.slug);
    await input('title').fill(`${marker} local conflict`);
    await page.getByRole('button', { name: 'Изменить публикацию', exact: true }).click();
    const publicationDialog = page.getByRole('dialog', { name: 'Изменить публикацию', exact: true });
    await publicationDialog.getByRole('radio', { name: 'Архив', exact: true }).click();
    await publicationDialog.getByRole('button', { name: 'Применить к форме', exact: true }).click();
    await tab('Поиск и ссылки');
    const indexability = page.locator('.a1cat-editor [data-field="is_indexable"]').getByRole('checkbox');
    await indexability.waitFor();
    const initialIndexability = await indexability.getAttribute('aria-pressed');
    assert.ok(['true', 'false'].includes(initialIndexability), 'Native category checkbox must expose its pressed state');
    const originalIndexability = initialIndexability === 'true';
    await indexability.click();
    assert.equal((await indexability.getAttribute('aria-pressed')) === 'true', !originalIndexability, 'The owned conflict fixture must have a local indexability edit');
    const initial = await read(primary.id);
    await update(primary.id, initial, { title: `${marker} remote conflict` });
    await save().click();
    await page.getByText('Эта запись изменилась, пока вы её редактировали. Ваши правки остались в форме. Сравните изменения перед сохранением.', { exact: true }).waitFor();
    const writeCount = requests.filter(item => item.method === 'POST' && item.path.includes('/commerce/mutations/categories/')).length;
    await page.getByRole('button', { name: 'Сравнить изменения', exact: true }).click();
    const comparison = page.locator('.category-comparison');
    await comparison.getByRole('heading', { name: 'Сравнение изменений', exact: true }).waitFor();
    await comparison.getByText(`${marker} local conflict`, { exact: true }).waitFor();
    await comparison.getByText(`${marker} remote conflict`, { exact: true }).waitFor();
    await comparison.getByText('Статус публикации', { exact: true }).waitFor();
    await comparison.getByText('Архив', { exact: true }).waitFor();
    await comparison.getByText('Черновик', { exact: true }).waitFor();
    await comparison.getByText('Разрешить поисковым системам показывать страницу', { exact: true }).waitFor();
    await comparison.getByText(originalIndexability ? 'Индексация запрещена' : 'Индексация разрешена', { exact: true }).waitFor();
    await comparison.getByText(originalIndexability ? 'Индексация разрешена' : 'Индексация запрещена', { exact: true }).waitFor();
    const comparisonText = await comparison.innerText();
    assert.doesNotMatch(comparisonText, /\b(?:status|is_indexable)\b/i, 'Conflict comparison must display human field names instead of schema keys');
    await screenshot('category-conflict-1536.png', 1536, 1024);
    await screenshot('category-conflict-390.png', 390, 844);
    await page.setViewportSize({ width: 1536, height: 1024 });
    await page.getByRole('button', { name: 'Оставить мои правки', exact: true }).click();
    await comparison.waitFor({ state: 'hidden' });
    assert.equal(requests.filter(item => item.method === 'POST' && item.path.includes('/commerce/mutations/categories/')).length, writeCount);
    await tab('Основное');
    assert.equal(await input('title').inputValue(), `${marker} local conflict`);
    await tab('Поиск и ссылки');
    const reconciledIndexability = page.locator('.a1cat-editor [data-field="is_indexable"]').getByRole('checkbox');
    assert.equal((await reconciledIndexability.getAttribute('aria-pressed')) === 'true', !originalIndexability, 'Reconciliation must retain the local indexability edit');
    await tab('Основное');
    await page.getByRole('tabpanel', { name: 'Основное' }).getByText('Архив', { exact: true }).waitFor();
    const serverAfterConflict = await read(primary.id);
    assert.equal(serverAfterConflict.title, `${marker} remote conflict`);
    assert.equal(serverAfterConflict.status, 'draft', 'The conflicting local status intent must not have been written');
    assert.equal(serverAfterConflict.is_indexable, originalIndexability, 'The conflicting local indexability edit must not have been written');
  });

  await check('lost committed update ack, malformed ack, and failed readback preserve local data', async () => {
    const runUnknown = async (mode, value) => {
      await openCard(primary.id); await input('title').fill(value);
      const beforeAckLoss = lostUpdateAcknowledgements;
      const beforeMalformedAck = malformedUpdateAcknowledgements;
      const beforeReadbackFailure = failedReadbackResponses;
      if (mode === 'lost') updateAckLoss = true;
      if (mode === 'malformed') malformedUpdateAck = true;
      if (mode === 'readback') failReadbackFor = primary.id;
      const failedReadbackResponse = mode === 'readback' ? page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === `/items/categories/${primary.id}` && response.status() === 503) : null;
      await save().click();
      if (mode === 'lost') {
        await page.getByRole('button', { name: 'Проверить сохранение', exact: true }).waitFor();
        assert.equal(lostUpdateAcknowledgements, beforeAckLoss + 1, 'Must observe the committed update whose response was deliberately lost');
        await screenshot('category-uncertain-update-1536.png', 1536, 1024);
        await screenshot('category-uncertain-update-390.png', 390, 844);
        await page.setViewportSize({ width: 1536, height: 1024 });
      } else if (mode === 'malformed') {
        await page.getByRole('button', { name: 'Проверить сохранение', exact: true }).waitFor();
        assert.equal(malformedUpdateAcknowledgements, beforeMalformedAck + 1, 'Must observe the malformed acknowledgement response');
      } else {
        const response = await failedReadbackResponse;
        assert.equal(response.status(), 503);
        assert.equal(failedReadbackResponses, beforeReadbackFailure + 1, 'Must observe the controlled failed readback request');
        assert.equal(await save().isDisabled(), true, 'Save remains blocked while readback is unresolved');
        const retry = page.getByRole('button', { name: 'Повторить загрузку', exact: true });
        await retry.waitFor();
        const successfulRetry = page.waitForResponse(responseEvent => responseEvent.request().method() === 'GET' && new URL(responseEvent.url()).pathname === `/items/categories/${primary.id}` && responseEvent.status() === 200);
        await retry.click();
        await successfulRetry;
      }
      await assertCleanEditorCopy();
      assert.equal(await input('title').inputValue(), value);
      assert.equal((await read(primary.id)).title, value, 'Server readback must confirm each committed update');
      if (mode === 'readback') assert.equal(await input('title').inputValue(), value, 'Successful readback retry must retain the committed value');
      failReadbackFor = undefined;
      if (mode !== 'readback') {
        await page.getByRole('button', { name: 'Проверить сохранение', exact: true }).click();
        await page.getByRole('button', { name: 'Оставить мои правки', exact: true }).click();
        assert.equal(await input('title').inputValue(), value);
      }
    };
    await runUnknown('lost', `${marker} lost ack`);
    await runUnknown('malformed', `${marker} malformed ack`);
    await runUnknown('readback', `${marker} readback failed`);
  });

  await check('anonymous read and guarded write are denied; actual manager availability is reported', async () => {
    await assert.rejects(request('/items/categories?fields=id&limit=1', { anonymous: true }), error => [401, 403].includes(error.status));
    await assert.rejects(request(`/commerce/mutations/categories/${primary.id}`, { method: 'POST', anonymous: true, body: { expected: { id: primary.id }, changes: { title: 'anonymous denied' } } }), error => [401, 403].includes(error.status));
    try {
      const managerRoles = await request('/roles?fields=id,name,policies.policy.id,policies.policy.admin_access&limit=100');
      const existing = (managerRoles ?? []).filter(role => /manager|редактор/i.test(role.name ?? ''));
      notes.push(`Manager-role inspection: ${existing.length} pre-existing manager-like role(s) visible through policy relationships; no role was created or changed, and no access capability was inferred.`);
    } catch (error) {
      if (![401, 403].includes(error.status)) throw error;
      notes.push(`Manager-role availability not inspectable under current permissions (HTTP ${error.status}); no RBAC acceptance claim.`);
    }
  });

  await check('native Directus file library selection and unlink retain the owned file', async () => {
    const fileId = randomUUID();
    const fileEntry = { collection: 'directus_files', id: fileId, kind: 'own-png', filename: `${marker}.png`, title: `${marker} owned image`, created: false, cleaned: false };
    owned.push(fileEntry); await durableJournal('before-owned-file-upload');
    const form = new FormData(); form.set('id', fileId); form.set('title', fileEntry.title); form.set('file', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZxkAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), fileEntry.filename);
    const upload = await fetch(`${origin}/files`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    assert.equal(upload.status, 200); assert.equal((await upload.json()).data.id, fileId); fileEntry.created = true; await durableJournal('owned-file-uploaded');
    await openCard(primary.id);
    const field = page.locator('.a1cat-editor [data-field="image"]').first();
    const picker = field.locator('.v-upload button').filter({ has: page.locator('[data-icon="folder_open"]') }); await picker.waitFor(); await picker.click();
    const dialog = page.locator('#dialog-outlet'); await dialog.getByText('Все файлы', { exact: true }).click();
    await dialog.locator('button').filter({ has: page.locator('[data-icon="search"]') }).click();
    await dialog.locator('input[type="search"]').fill(fileEntry.filename);
    const ownFile = dialog.locator('.card.select-mode').filter({ hasText: fileEntry.title }); await ownFile.waitFor(); await ownFile.click();
    await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await dialog.locator('.v-drawer').waitFor({ state: 'hidden' });
    await save().click(); await waitValue(primary.id, 'image', fileId);
    await screenshot('category-native-file-library.png', 1536, 1024);
    const imageFieldDom = await field.evaluate(element => ({
      outerHTML: element.outerHTML,
      buttons: [...element.querySelectorAll('button')].map((button, index) => ({
        index,
        ariaLabel: button.getAttribute('aria-label'),
        title: button.getAttribute('title'),
        dataIcon: button.querySelector('[data-icon]')?.getAttribute('data-icon') ?? button.getAttribute('data-icon'),
        classes: button.className,
        text: button.innerText,
        outerHTML: button.outerHTML,
      })),
    }));
    await writeFile(resolve(out, 'private-owned-image-field-before-unlink.json'), JSON.stringify(imageFieldDom, null, 2));
    const unlinkButtons = imageFieldDom.buttons.filter(button => button.dataIcon === 'close');
    assert.equal(unlinkButtons.length, 1, 'Expected exactly one observed close control in the owned image field; inspect private DOM evidence before adjusting');
    await field.locator('button').nth(unlinkButtons[0].index).click(); await save().click(); await waitValue(primary.id, 'image', null);
    assert.equal((await request(`/files/${fileId}?fields=id`)).id, fileId, 'Unlink must leave the Directus file intact');
  });

  await check('controlled empty collection is distinguished from no-results state', async () => {
    await openList();
    const listRequest = '**/items/categories?**';
    await page.route(listRequest, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { filter_count: 0 } }) }), { times: 1 });
    await page.reload(); await page.getByRole('heading', { name: 'Категорий пока нет', exact: true }).waitFor();
    await screenshot('controlled-empty-collection.png', 1536, 1024);
    await page.unroute(listRequest);
  });

  await check('only scoped own-fixture beforeunload dialogs were accepted', async () => {
    assert.deepEqual(unexpectedDialogs, [], 'Unexpected browser dialogs are not accepted during the probe');
  });

  await writeFile(resolve(out, 'private-requests.json'), JSON.stringify(requests, null, 2));
  await writeFile(resolve(out, 'private-browser-errors.json'), JSON.stringify({ pageErrors: errors, consoleErrors }, null, 2));
} catch (error) {
  results.push({ name: 'probe setup/execution', status: 'FAIL', error: error.message });
  console.log(`FAIL probe setup/execution: ${error.message}`);
  if (page) {
    await page.screenshot({ path: resolve(out, 'failure-final.png'), fullPage: true }).catch(() => {});
    await writeFile(resolve(out, 'failure-final-dom.txt'), await page.locator('body').innerText().catch(() => ''));
  }
} finally {
  await browser?.close().catch(() => {});
  if (token) {
    const cleanupOrder = [...owned.filter(entry => entry.collection !== 'directus_files').reverse(), ...owned.filter(entry => entry.collection === 'directus_files')];
    for (const entry of cleanupOrder) {
      if (entry.cleaned) continue;
      try {
        if (entry.collection === 'directus_files') {
          const files = await request(`/files?fields=id,title,filename_download&filter[id][_eq]=${encodeURIComponent(entry.id)}&limit=2`);
          assert.ok(Array.isArray(files) && files.length <= 1, 'Exact-ID file ownership query failed');
          if (files.length) {
            assert.equal(String(files[0].id), entry.id);
            assert.equal(files[0].title, entry.title, 'Refusing cleanup after file title ownership drift');
            assert.equal(files[0].filename_download, entry.filename, 'Refusing cleanup after file name ownership drift');
            const references = await request(`/items/categories?fields=id,image,icon,og_image&limit=2&filter[_or][0][image][_eq]=${encodeURIComponent(entry.id)}&filter[_or][1][icon][_eq]=${encodeURIComponent(entry.id)}&filter[_or][2][og_image][_eq]=${encodeURIComponent(entry.id)}`);
            assert.deepEqual(references, [], 'Refusing to delete own media while any category media field references it');
            await request(`/files/${entry.id}`, { method: 'DELETE' });
          }
          const remaining = await request(`/files?fields=id&filter[id][_eq]=${encodeURIComponent(entry.id)}&limit=2`);
          assert.deepEqual(remaining, []);
        } else {
          const currentRows = await request(`/items/categories?fields=${encodeURIComponent(fields)}&filter[id][_eq]=${encodeURIComponent(entry.id)}&limit=2`);
          assert.ok(Array.isArray(currentRows) && currentRows.length <= 1, 'Exact-ID ownership query failed');
          if (currentRows.length) {
            const current = currentRows[0];
            assert.equal(String(current.id), entry.id);
            if (entry.fields.slug) assert.equal(current.slug, entry.fields.slug, 'Refusing cleanup after slug ownership drift');
            assert.ok(String(current.title).startsWith(marker), 'Refusing cleanup of a foreign category');
            await request(`/commerce/mutations/categories/${encodeURIComponent(entry.id)}`, { method: 'POST', body: { expected: current, action: 'delete' } });
          }
          const remaining = await request(`/items/categories?fields=id&filter[id][_eq]=${encodeURIComponent(entry.id)}&limit=2`);
          assert.deepEqual(remaining, [], 'Exact owned category remains after cleanup');
        }
        entry.cleaned = true; await durableJournal(`exact-cleanup-verified:${entry.id}`);
        results.push({ name: `exact owned cleanup ${entry.collection}`, status: 'PASS' });
      } catch (error) {
        results.push({ name: `exact owned cleanup ${entry.collection}`, status: 'FAIL', error: error.message });
        console.error(`Exact cleanup failed for a journaled own ID; see private ledger ${out}`);
      }
    }
  }
  const sanitized = {
    run, target: origin, mode: 'installed candidate; no browser module substitution', hashes,
    runtimeTopology: {
      project,
      directusComposeCheckout: win32.basename(runtimeIdentity.directusComposeRoot),
      databaseComposeCheckout: win32.basename(runtimeIdentity.databaseComposeRoot),
      directusComposePath: 'dev/compose.yml',
      databaseComposePath: 'dev/compose.yml',
      composePathsDiffer: runtimeIdentity.composePathsDiffer,
      sameRepository: true,
      sharedProjectNetwork: true,
      dbHost: 'db',
      directusUploadsVolume: runtimeIdentity.directusUploadsVolume,
      postgresDataVolume: runtimeIdentity.postgresDataVolume,
    },
    results: results.map(({ name, status }) => ({ name, status })),
    notes,
    ...(siteEffectsOnly ? { siteEffects } : {}),
    pass: results.filter(row => row.status === 'PASS').length,
    fail: results.filter(row => row.status === 'FAIL').length,
    skipped: results.filter(row => row.status === 'SKIP').length,
    cleanup: owned.every(entry => entry.cleaned),
    pageErrorCount: errors.length, consoleErrorCount: consoleErrors.length,
  };
  await writeFile(resolve(out, 'results.json'), JSON.stringify(sanitized, null, 2));
  console.log(`Private artifacts: ${out}`);
  const publicResultPaths = siteEffectsOnly && only
    ? [resolve(root, 'docs/admin-sections/sections/categories/runtime/results-live-site.json')]
    : siteEffectsOnly
      ? [resolve(root, 'docs/admin-sections/sections/categories/runtime/results.json'), resolve(root, 'docs/admin-sections/sections/categories/runtime/results-live-site.json')]
      : only
        ? [resolve(root, 'docs/admin-sections/sections/categories/runtime/results-closure.json')]
      : [resolve(root, 'docs/admin-sections/sections/categories/runtime/results.json')];
  if (!results.some(row => row.status === 'FAIL') && sanitized.cleanup) {
    for (const publicResultPath of publicResultPaths) {
      await mkdir(dirname(publicResultPath), { recursive: true });
      await writeFile(publicResultPath, JSON.stringify(sanitized, null, 2));
    }
  }
  if (results.some(row => row.status === 'FAIL') || owned.some(entry => !entry.cleaned)) process.exitCode = 1;
  lockProc?.stdin.end('\n');
  if (lockProc) await new Promise(resolvePromise => lockProc.once('exit', resolvePromise)).catch(() => {});
}
