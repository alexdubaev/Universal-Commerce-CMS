/**
 * Live A3 acceptance against the already-running, own loopback Directus.
 * Installed mode exercises the bind-mounted Directus bundle as served. The
 * optional expected-hashes manifest must come from the guarded installer.
 *
 * node --env-file=<own-dev-env> verification/a3-pages-runtime.mjs --synthetic-probe --installed --source-root=<checkout> --expected-hashes=<private-receipt.json>
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const argValue = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = resolve(argValue('source-root') ?? dirname(fileURLToPath(import.meta.url)));
const extension = resolve(root, 'directus/extensions/deere-shop-product-editor');
const require = createRequire(resolve(root, 'storefront/package.json'));
const { chromium } = require('playwright');
const origin = 'http://127.0.0.1:18056';
assert.equal(process.platform, 'win32', 'A3 acceptance requires the existing local Windows runtime; stop on other hosts');
assert.equal(process.env.DIRECTUS_URL ?? origin, origin, 'Only own local Directus is allowed');
assert.ok(process.argv.includes('--synthetic-probe'), 'Explicit synthetic probe flag required');
assert.ok(process.argv.includes('--installed'), 'Installed mode is required; candidate route injection is not accepted');
assert.ok(argValue('expected-hashes'), 'Pass the private installed artifact hash receipt');
assert.ok(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD, 'Load own dev credentials privately');

// A named Windows mutex serializes all cooperating acceptance probes on this host.
const mutexName = 'Global\\UniversalCommerceCMS-Directus-runtime-acceptance';
const ps = `$m=[Threading.Mutex]::new($false,'${mutexName}'); if(!$m.WaitOne(0)){exit 73}; try{[Console]::WriteLine('LOCKED'); [Console]::In.ReadLine()|Out-Null}finally{$m.ReleaseMutex();$m.Dispose()}`;
let lockProc;

const run = randomUUID(), marker = `a3-${run.slice(0, 8)}`;
const out = resolve(tmpdir(), 'a3-pages-runtime', run);
await mkdir(out, { recursive: true });
const journalPath = resolve(out, 'private-fixture-ledger.json');
const results = [], owned = [], requests = [], fatal = [], warnings = [];
let sourceHashes = {};
const focus = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
const selected = name => !focus || /installed bundle|native create journals|synthetic fixture|exact owned cleanup/.test(name) || new RegExp(focus).test(name);
let token, browser, context, page;
let loseNextCreate = false, dialogPolicy = 'accept';
const dialogMessages = [];
const modules = ['index.js', 'editor-state.mjs', 'admin-shell.js', 'admin-state.mjs', 'page-sections.js', 'sections/pages.js', 'sections/categories.js', 'sections/home_page.js'];
const equal = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const journal = async extra => writeFile(journalPath, JSON.stringify({ run, target: origin, marker, createdAt: new Date().toISOString(), owned, ...extra }, null, 2), { mode: 0o600 });
async function request(path, { method = 'GET', body, anonymous = false, headers = {} } = {}) {
  const response = await fetch(origin + path, {
    method,
    headers: { ...(!anonymous && token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status} ${method} ${path.split('?')[0]}`), { status: response.status, json });
  return json.data ?? json;
}
function record(collection, fields) {
  const id = randomUUID();
  const entry = { collection, id, marker, fields, created: false, cleaned: false };
  owned.push(entry);
  return entry;
}
async function createSynthetic(collection, fields) {
  const entry = record(collection, fields);
  await journal({ phase: `before-create-${collection}` }); // Durable exact ID before POST.
  const data = await request(`/items/${collection}`, { method: 'POST', body: { id: entry.id, ...fields } });
  assert.equal(String(data.id), entry.id);
  entry.created = true;
  await journal({ phase: `created-${collection}` });
  return data;
}
async function check(name, fn) {
  if (!selected(name)) return;
  try { await fn(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); }
  catch (error) {
    results.push({ name, status: 'FAIL', error: error.message });
    console.log(`FAIL ${name}: ${error.message}`);
    if (page) {
      await page.screenshot({ path: resolve(out, `failure-${results.length}.png`), fullPage: true }).catch(() => {});
      const body = await page.locator('body').innerText().catch(() => '');
      const controls = await page.locator('button').evaluateAll(nodes => nodes.map(node => ({ text: node.innerText, label: node.getAttribute('aria-label'), title: node.title }))).catch(() => []);
      await writeFile(resolve(out, `failure-${results.length}-dom.json`), JSON.stringify({ body: body.slice(0, 4000), controls }, null, 2));
    }
  }
}
async function checkRequired(name, fn) {
  if (!selected(name)) return;
  await check(name, fn);
  const result = results.at(-1);
  if (result?.status !== 'PASS') throw new Error(`Required prerequisite failed: ${name}`);
}
const screenshot = async (name, width = 1536, height = 1024) => {
  await page.setViewportSize({ width, height });
  await page.screenshot({ path: resolve(out, name), fullPage: false, animations: 'disabled' });
};
async function closeRightPanel() {
  const overlays=page.locator('#dialog-outlet .v-overlay.active .overlay');
  for(let i=0;i<await overlays.count();i++) {
    const overlay=overlays.nth(i);
    if(await overlay.isVisible()) {await overlay.click({position:{x:8,y:100}});await page.waitForTimeout(450);await overlay.waitFor({state:'hidden'});}
  }
  const close = page.locator('button').filter({ has: page.locator('[data-icon="right_panel_close"]') });
  if (await close.count() && await close.first().isVisible()) {await close.first().click();await page.waitForTimeout(450);}
}
const input = (field, tab = 'main') => page.locator(`.a3pages-tab--${tab} [data-field="${field}"] input, .a3pages-tab--${tab} [data-field="${field}"] textarea`).first();
const save = () => page.locator('.ac-shell__header').getByRole('button', { name: 'Сохранить страницу', exact: true });
async function openCard(id) {
  await page.goto(`${origin}/admin/product-editor/sections/pages/${id}`);
  await input('title').waitFor();
  await closeRightPanel();
}
async function waitRecord(id, field, value) {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (equal((await request(pagePath(id)))[field], value)) return;
    await new Promise(resolvePromise => setTimeout(resolvePromise, 100));
  }
  assert.deepEqual((await request(pagePath(id)))[field], value);
}
async function reconcile(keep = false) {
  await page.getByRole('button', { name: 'Сравнить изменения', exact: true }).click();
  await page.locator('.a3pages-actions').waitFor();
  await page.getByRole('button', { name: keep ? 'Оставить мои правки' : 'Загрузить сохранённые значения', exact: true }).click();
  if (!keep) {
    const confirm = page.getByRole('button', { name: 'Остаться', exact: true });
    const confirmationOpened = await confirm.waitFor({ state: 'visible', timeout: 2500 }).then(() => true, () => false);
    if (confirmationOpened)
      await page.getByRole('button', { name: 'Отменить мои правки', exact: true }).last().click();
  }
  await page.locator('.a3pages-conflict').waitFor({ state: 'hidden' });
}
const noOverflow = async () => {
  const size = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(size.scroll <= size.client + 1, JSON.stringify(size));
};
async function capturePagesStyleEvidence(view) {
  const evidence = await page.evaluate(() => {
    const rgb = value => {
      const rgba=value.match(/rgba?\(([^)]+)\)/);
      if(rgba){const parts=rgba[1].split(/[\s,/]+/).filter(Boolean).slice(0,4).map(Number);return parts.length>=3&&(!Number.isFinite(parts[3])||parts[3]>0)?parts.slice(0,3).map(v=>Math.round(v)):null;}
      const srgb=value.match(/color\(srgb\s+([^)]+)\)/);
      if(srgb){const parts=srgb[1].split(/[\s/]+/).filter(Boolean).slice(0,3).map(Number);return parts.length===3?parts.map(v=>Math.round(v*255)):null;}
      return null;
    };
    const luminance = c => c.map(v => { const x=v/255; return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4; }).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
    const contrast = (a,b) => { if(!a||!b)return null; const values=[luminance(a),luminance(b)].sort((x,y)=>y-x); return Number(((values[0]+0.05)/(values[1]+0.05)).toFixed(2)); };
    const resolvedBackground = el => { for(let p=el;p;p=p.parentElement){const color=rgb(getComputedStyle(p).backgroundColor);if(color)return color;}return [255,255,255]; };
    const styles=[];
    for(const selector of ['.a3pages-list th','.a3pages-list .a3pages-name','.a3pages-list .a3pages-slug','.a3pages-list .a3pages-badge','.a3pages-badge--draft','.a3pages-editor .field-label-content','.a3pages-editor .a3pages-muted','.a3pages-editor .a3pages-help','.a3pages-editor .a3pages-address','.a3pages-context-card dt','.a3pages-context-card dd','.a3pages-note','.a3pages-content-order small']){
      for(const el of document.querySelectorAll(selector)){
        if(el.getClientRects().length===0||el.closest('[hidden]')||el.closest('[aria-disabled="true"]'))continue;
        const style=getComputedStyle(el),foreground=rgb(style.color),background=resolvedBackground(el);
        styles.push({selector,className:String(el.className||''),label:el.classList.contains('field-label-content')?el.innerText.trim():undefined,color:style.color,background:style.backgroundColor,resolvedBackground:`rgb(${background.join(', ')})`,contrast:contrast(foreground,background),fontSize:style.fontSize,fontWeight:style.fontWeight});
      }
    }
    const layout=[];
    for(const field of ['title','slug','page_type','h1','intro','seo_text']){
      const root=document.querySelector(`.a3pages-editor [data-field="${field}"]`); if(!root||!root.getClientRects().length)continue;
      const label=root.querySelector('.field-label-content,label,.v-label')||root.previousElementSibling;
      const control=root.querySelector('input:not([type="hidden"]),textarea,select,.v-input,button');
      const rect=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)};};
      const ancestors=[];for(let p=root,i=0;p&&i<5;i++,p=p.parentElement){const s=getComputedStyle(p);ancestors.push({tag:p.tagName,className:String(p.className||'').slice(0,100),display:s.display,gap:s.gap,rowGap:s.rowGap,gridTemplateRows:s.gridTemplateRows,marginBlockStart:s.marginBlockStart,marginBlockEnd:s.marginBlockEnd,paddingBlockStart:s.paddingBlockStart,paddingBlockEnd:s.paddingBlockEnd});if(p.classList.contains('a3pages-tab'))break;}
      layout.push({name:field,label:rect(label),control:rect(control),box:rect(root),ancestors});
    }
    return {styles,layout};
  });
  const evidencePath=resolve(out,'pages-style-evidence.json');let all={};try{all=JSON.parse(await readFile(evidencePath,'utf8'));}catch{}
  all[view]=evidence;await writeFile(evidencePath,JSON.stringify(all,null,2));
}
const pagePath = id => `/items/pages/${encodeURIComponent(id)}?fields=id,status,title,slug,page_type,h1,eyebrow,intro,seo_title,seo_description,seo_text,og_image,canonical_url,is_indexable,seo,translations,created_at,updated_at`;
const syntheticPageFields = (i, status = 'draft') => ({
  status,
  title: `${marker} Синтетическая страница ${i}`,
  slug: `${marker}-${i}`,
  page_type: 'standard',
  h1: `${marker} H1 ${i}`,
  intro: i === 3 ? `${marker} ${'Длинный синтетический текст. '.repeat(30)}` : `${marker} описание ${i}`,
  seo_title: i === 3 ? null : `${marker} SEO ${i}`,
  seo_description: i === 3 ? null : `${marker} SEO описание ${i}`,
  seo_text: `${marker} SEO-текст ${i}`,
  canonical_url: null,
  is_indexable: i === 3 ? null : i !== 2,
  seo: i === 3 ? { title: `${marker} JSON fallback title`, meta_description: `${marker} JSON fallback description`, no_index: true, custom_unknown: `${marker} keep-me`, additional_fields: { custom_unknown: `${marker} nested-keep-me` } } : null,
  translations: null,
});
const apiPatch = async (id, current, changes) => request(`/commerce/mutations/pages/${id}`, {
  method: 'POST', body: { expected: { id, updated_at: current.updated_at, ...Object.fromEntries(Object.keys(changes).map(key => [key, current[key]])) }, changes },
});

try {
  lockProc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  await new Promise((resolvePromise, reject) => {
    let output = '';
    lockProc.stdout.setEncoding('utf8');
    lockProc.stdout.on('data', chunk => { output += chunk; if (output.includes('LOCKED')) resolvePromise(); });
    lockProc.once('exit', code => reject(new Error(code === 73 ? 'Another runtime writer owns the shared Directus lock' : `Mutex helper exited ${code}`)));
    lockProc.once('error', reject);
  });
  await journal({ phase: 'initialized' });
  token = (await request('/auth/login', { method: 'POST', body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } })).access_token;
  assert.ok(token, 'Local Directus login failed');

  const [pageFields, childFields, collections, permissions, livePages] = await Promise.all([
    request('/fields/pages'), request('/fields/page_sections'), request('/collections/pages'), request('/permissions/me'),
    request('/items/pages?fields=id,status,title,slug,page_type,updated_at&limit=25&page=1&sort=-updated_at,id'),
  ]);
  const pageCollection = Array.isArray(collections) ? collections.find(row => row.collection === 'pages') : collections;
  assert.equal(pageCollection?.collection, 'pages', 'Live pages collection metadata is missing');
  assert.notEqual(pageCollection?.meta?.singleton, true, 'Pages must be a collection');
  for (const field of ['id', 'status', 'title', 'slug', 'page_type', 'updated_at']) assert.ok(pageFields.some(row => row.field === field), `Missing live pages metadata ${field}`);
  assert.ok(childFields.some(row => row.field === 'page') && childFields.some(row => row.field === 'home_page'), 'Section ownership metadata is missing');
  assert.ok(Array.isArray(livePages), 'Live pages listing did not return an array');
  assert.ok(permissions?.pages?.read && permissions?.pages?.create && permissions?.pages?.update, 'The local acceptance administrator lacks pages read/create/update permissions');

  const bundleResponse = await fetch(`${origin}/extensions/sources/index.js`);
  assert.equal(bundleResponse.status, 200);
  const installedBundle = await bundleResponse.text();
  const installedHashes = JSON.parse(await readFile(argValue('expected-hashes'), 'utf8'));
  sourceHashes = {};
  for (const name of modules) {
    const source = await readFile(resolve(extension, 'dist', name), 'utf8');
    assert.equal(source, await readFile(resolve(extension, 'src', name), 'utf8'), `src/dist mismatch ${name}`);
    sourceHashes[name] = createHash('sha256').update(source).digest('hex');
  }
  const pagesArtifactPath = 'deere-shop-product-editor/dist/sections/pages.js';
  const receiptFiles = Array.isArray(installedHashes.files) ? installedHashes.files : Array.isArray(installedHashes.artifacts) ? installedHashes.artifacts : [];
  const receiptPagesEntry = receiptFiles.find(file => String(file.relative ?? file.path ?? file.file ?? file.name ?? '').replaceAll('\\','/').endsWith(pagesArtifactPath));
  const installedPagesHash = installedHashes['sections/pages.js']
    ?? installedHashes[pagesArtifactPath]
    ?? (typeof installedHashes.files?.[pagesArtifactPath] === 'string' ? installedHashes.files[pagesArtifactPath] : installedHashes.files?.[pagesArtifactPath]?.sha256)
    ?? receiptPagesEntry?.sha256
    ?? receiptPagesEntry?.hash;
  assert.equal(installedPagesHash, sourceHashes['sections/pages.js'], 'Installed pages module hash differs from approved source');
  await writeFile(resolve(out, 'installed-artifact-sha256.json'), JSON.stringify({ sourceHashes, installedHashes }, null, 2));
  const imports = {};
  for (const [key, needle] of [['vue', 'vue'], ['vue-router', 'vue-router'], ['@directus/extensions-sdk', '@directus_extensions-sdk']]) {
    const match = installedBundle.match(new RegExp(`['"]([^'"]*${needle}\\.[^'"]*entry\\.js)['"]`));
    assert.ok(match, `Installed ${key} runtime module is missing`);
    imports[key] = match[1];
  }
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1536, height: 1024 }, acceptDownloads: true });
  context.on('page', tab => {
    tab.on('pageerror', error => fatal.push(error.message));
    tab.on('console', message => { if (message.type() === 'error') warnings.push(message.text()); });
  });
  assert.match(installedBundle, /deere-shop-product-editor|product-editor/i, 'Served Directus extension registry is missing the expected editor extension');
  await context.route('**/items/pages', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const body = route.request().postDataJSON();
    const id = randomUUID();
    const entry = { collection: 'pages', id, marker, fields: { ...body, id }, created: false, createdBy: 'native-ui', cleaned: false };
    owned.push(entry);
    await journal({ phase: 'before-native-create-post' });
    if (loseNextCreate) {
      loseNextCreate = false;
      const response = await route.fetch({ postData: JSON.stringify({ ...body, id }) });
      assert.equal(response.status(), 200);
      entry.created = true; await journal({ phase: 'native-create-committed-lost-ack' });
      return route.abort('failed');
    }
    await route.continue({ postData: JSON.stringify({ ...body, id }) });
  });
  page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('dialog', dialog => { dialogMessages.push(dialog.message()); return dialogPolicy === 'cancel' ? dialog.dismiss() : dialog.accept(); });
  await page.addLocatorHandler(page.getByText('Have a license key?', { exact: true }), async () => {
    await page.getByRole('button', { name: 'Пропустить', exact: true }).click();
  });
  await page.addLocatorHandler(page.getByRole('button', { name: 'Remind Later', exact: true }), async () => {
    await page.getByRole('button', { name: 'Remind Later', exact: true }).click();
  });
  page.on('request', req => {
    const url = new URL(req.url());
    if (url.pathname.startsWith('/items/pages') || url.pathname.startsWith('/items/page_sections') || url.pathname.startsWith('/commerce/mutations/pages')) {
      requests.push({ method: req.method(), path: url.pathname, query: url.search });
    }
  });
  await page.goto(`${origin}/admin/login`);
  await page.locator('input[type=email]').fill(process.env.ADMIN_EMAIL);
  await page.locator('input[type=password]').fill(process.env.ADMIN_PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(url => !url.pathname.endsWith('/login'), { timeout: 30000 });

  await checkRequired('installed bundle and live list query render', async () => {
    await page.goto(`${origin}/admin/product-editor/sections/pages`);
    await page.getByRole('heading', { name: 'Страницы', exact: true }).first().waitFor({ timeout: 30000 });
    await page.getByRole('table').waitFor();
    await page.getByRole('columnheader', { name: 'Название и адрес', exact: true }).waitFor();
    await page.getByRole('searchbox', { name: 'Поиск страниц' }).waitFor();
    await closeRightPanel();
    await page.getByText("We'll remind you again on your next login.", { exact: true }).waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await capturePagesStyleEvidence('list-desktop');
    await screenshot('actual-pages-list-desktop-1536.png');
    await screenshot('actual-pages-list-mobile-390.png', 390, 844); await noOverflow();
    await screenshot('actual-pages-list-tablet-1024.png', 1024, 900); await noOverflow();
    await page.setViewportSize({ width: 320, height: 780 }); await noOverflow();
    await page.setViewportSize({ width: 430, height: 844 }); await noOverflow();
    await page.setViewportSize({ width: 1536, height: 1024 });
    const controls = await page.locator('button').evaluateAll(nodes => nodes.map(node => ({ text: node.innerText, label: node.getAttribute('aria-label'), title: node.title })));
    await writeFile(resolve(out, 'list-controls.json'), JSON.stringify(controls, null, 2));
  });
  await check('search/sort/pagination use the live Directus collection', async () => {
    const search = page.getByRole('searchbox', { name: 'Поиск страниц' });
    await search.fill('a3-no-such-page');
    await page.getByText(/не найдены|не найдено/i).waitFor();
    await screenshot('actual-pages-empty-desktop.png');
    await screenshot('actual-pages-empty-mobile-390.png',390,844); await noOverflow();
    await search.fill('');
    await page.locator('tbody tr').first().waitFor();
    const firstRow = page.locator('tbody tr').first();
    const contextTitle = (await firstRow.locator('.a3pages-name').innerText()).trim();
    const statusLabel = (await firstRow.locator('.a3pages-badge').innerText()).trim();
    const statusValue = { 'Черновик': 'draft', 'Опубликована': 'published', 'Опубликован': 'published', 'В архиве': 'archived' }[statusLabel];
    assert.ok(statusValue, `Unexpected status badge: ${statusLabel}`);
    await search.fill(contextTitle);
    await page.locator('tbody tr').filter({ hasText: contextTitle }).first().waitFor();
    await screenshot('actual-pages-search-context-desktop-1536.png');
    await screenshot('actual-pages-search-context-mobile-390.png',390,844); await noOverflow();
    await page.setViewportSize({width:1536,height:1024});
    const contextQuery = await search.inputValue();
    const contextStatus = page.getByLabel('Статус',{exact:true});
    const contextSort = page.getByLabel('Сортировка',{exact:true});
    await contextStatus.selectOption(statusValue); await contextSort.selectOption('title');
    await page.locator('tbody tr').filter({ hasText: contextTitle }).first().waitFor();
    await page.locator('.a3pages-name').first().click();
    await page.locator('[data-field="title"] input').waitFor();
    await page.getByRole('link', {name:'‹ Все страницы', exact:true}).click();
    assert.equal(await page.getByRole('searchbox', {name:'Поиск страниц'}).inputValue(),contextQuery,'Returning from a card must restore list search context');
    assert.equal(await page.getByLabel('Статус',{exact:true}).inputValue(),'draft','Returning from a card must restore status filter');
    assert.equal(await page.getByLabel('Сортировка',{exact:true}).inputValue(),'title','Returning from a card must restore sort');
    assert.ok(requests.some(row => row.path === '/items/pages' && row.query.includes('filter')));
    await page.getByLabel('Статус',{exact:true}).selectOption('');
    await page.getByLabel('Сортировка',{exact:true}).selectOption('-updated_at');
    await page.getByRole('searchbox', {name:'Поиск страниц'}).fill('');
    const sort = page.getByLabel('Сортировка', { exact: true });
    await sort.selectOption('title');
    await page.getByRole('table').waitFor();
    await page.screenshot({ path: resolve(out, 'actual-pages-sort-search.png'), fullPage: true });
    await page.getByRole('button', { name: /Следующая страница|Далее/ }).count().then(count => { if (count) assert.ok(count >= 1); });
  });
  await check('filter modal supports cancel, apply, escape, focus return', async () => {
    const opener = page.getByRole('button', { name: /Фильтры/ }).first();
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Фильтры страниц' }); await dialog.waitFor();
    await dialog.getByRole('button', {name:'Применить',exact:true}).focus();
    await page.keyboard.press('Tab');
    assert.equal(await dialog.getByRole('button',{name:'Закрыть фильтры',exact:true}).evaluate(el=>document.activeElement===el),true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await dialog.getByRole('button',{name:'Применить',exact:true}).evaluate(el=>document.activeElement===el),true);
    await screenshot('actual-pages-filters-desktop-1536.png');
    await screenshot('actual-pages-filters-mobile-390.png', 390, 844); await noOverflow();
    const type = dialog.getByLabel('Тип страницы'); await type.selectOption({ label: 'Обычная страница' });
    await page.keyboard.press('Escape');
    assert.equal(await opener.evaluate(el => document.activeElement === el), true, 'Focus did not return to filter opener');
    await opener.click(); await dialog.waitFor();
    assert.equal(await dialog.getByLabel('Тип страницы').inputValue(), '', 'Escape must discard pending filters');
    await dialog.getByLabel('Тип страницы').selectOption('standard');
    await dialog.getByRole('button', { name: 'Применить' }).click();
    await page.getByText(/Обычная страница ×/).waitFor();
    await page.getByRole('button', { name: 'Убрать фильтр типа страницы' }).click();
  });

  // Create one card via the actual native page editor. Its proposed UUID and
  // body are persisted before the request is allowed to leave the browser.
  await checkRequired('native create journals its exact UUID before POST and reloads', async () => {
    await page.goto(`${origin}/admin/product-editor/sections/pages/+`);
    await page.getByRole('heading', { name: /Новая страница|Создать страницу/ }).first().waitFor({ timeout: 30000 });
    const title = page.locator('[data-field="title"] input').first();
    await title.fill(`${marker} Страница для посетителя`);
    const slug = page.locator('[data-field="slug"] input').first();
    assert.ok(await slug.count(), 'Address input was not visible in content editor');
    const suggestedSlug = await slug.inputValue();
    assert.match(suggestedSlug, /stranitsa-dlya-posetitelya/, 'Russian title should suggest a readable address');
    await slug.fill(`${marker}-manual-address`);
    await title.fill(`${marker} Другое название`);
    assert.equal(await slug.inputValue(), `${marker}-manual-address`, 'Manual address must survive later title edits');
    const h1 = page.locator('[data-field="h1"] input').first();
    const createButton = page.getByRole('button', { name: 'Создать черновик', exact: true });
    const postsBeforeInvalid = requests.filter(row => row.method === 'POST' && row.path === '/items/pages').length;
    await createButton.click();
    await page.getByText(/Заголовок для посетителя: обязательное поле/i).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.closest('[data-field="h1"]') !== null), true, 'Missing public H1 must receive focus');
    assert.equal(await title.inputValue(), `${marker} Другое название`, 'Validation must preserve the manager title');
    assert.equal(requests.filter(row => row.method === 'POST' && row.path === '/items/pages').length, postsBeforeInvalid, 'Invalid create must not POST');
    if (await h1.count()) await h1.fill(`${marker} native H1`);
    await input('intro').fill(`${marker} public intro`);
    await input('seo_text').fill(`${marker} public body text`);
    await screenshot('actual-pages-create-desktop-1536.png');
    await screenshot('actual-pages-create-mobile-390.png', 390, 844); await noOverflow();
    await page.setViewportSize({ width: 1536, height: 1024 });
    const postObserved = page.waitForRequest(req => req.method() === 'POST' && new URL(req.url()).pathname === '/items/pages', { timeout: 30000 });
    await page.getByRole('button', { name: /Создать страницу|Создать/ }).last().click();
    const req = await postObserved; const body = req.postDataJSON();
    const entry = owned.find(row => row.createdBy === 'native-ui' && row.fields.slug === body.slug && row.fields.title === body.title);
    assert.ok(entry, 'Exact UI-created UUID was not journaled before POST');
    const response = await page.waitForResponse(res => res.request() === req, { timeout: 30000 });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok()) throw Object.assign(new Error(`Native create HTTP ${response.status()}`), { status: response.status(), json: payload });
    const created = payload.data ?? payload;
    assert.equal(String(created.id), String(entry.id)); entry.created = true; await journal({ phase: 'native-created' });
    await page.waitForURL(new RegExp(`/sections/pages/${entry.id}$`), { timeout: 30000 });
    await page.locator('[data-field="title"] input').waitFor();
    const reloaded = await request(pagePath(entry.id)); assert.equal(reloaded.slug, body.slug);
    await page.reload(); await page.locator('[data-field="title"] input').waitFor();
    assert.equal(await page.locator('[data-field="title"] input').inputValue(), body.title);
  });

  let seeded = [];
  await checkRequired('synthetic fixture creation and ownership relations', async () => {
    for (const i of [2, 3]) seeded.push(await createSynthetic('pages', syntheticPageFields(i)));
    for (const [index, row] of seeded.entries()) {
      const count = index === 1 ? 2 : 1;
      for (let childIndex = 0; childIndex < count; childIndex++) {
        const childFieldsValue = { page: row.id, home_page: null, status: 'draft', section_type: 'text', title: `${marker} section ${index + 1}-${childIndex + 1}`, text: `${marker} synthetic child content`, sort_order: 100000 + index * 10 + childIndex, is_visible: false };
        const child = await createSynthetic('page_sections', childFieldsValue);
        assert.equal(String(child.page), String(row.id)); assert.equal(child.home_page, null);
      }
    }
  });

  await check('source_page remains read-only', async () => {
    const home = await request('/items/home_page?fields=id,source_page');
    const sourceId = String(home?.source_page?.id ?? home?.source_page ?? '');
    assert.ok(sourceId, 'Configured home source page was not available to verify');
    await openCard(sourceId);
    await page.getByText(/служит источником главной страницы/i).waitFor();
    assert.equal(await input('title').isEditable(), false, 'source_page must remain protected');
    assert.equal(await save().isDisabled(), true);
  });

  const nativeId = () => owned.find(row => row.createdBy === 'native-ui' && row.created)?.id;
  await check('native page card main, sections and SEO use real fields', async () => {
    const id = nativeId(); assert.ok(id, 'Native create fixture missing');
    await openCard(id);
    await page.getByRole('heading').filter({ hasText: marker }).first().waitFor({ timeout: 30000 });
    await screenshot('actual-pages-editor-main-desktop-1536.png');
    await capturePagesStyleEvidence('editor-main-desktop');
    await page.getByRole('tab', { name: 'Блоки страницы' }).click();
    await page.getByRole('heading', { name: 'Блоки страницы', exact: true }).waitFor();
    await screenshot('actual-pages-sections-desktop-1536.png'); await screenshot('actual-pages-sections-mobile-390.png', 390, 844); await noOverflow();
    await page.setViewportSize({ width: 1536, height: 1024 });
    await page.getByRole('tab', { name: 'Поиск и ссылки' }).click();
    await page.locator('[data-field="seo_title"]').waitFor();
    await screenshot('actual-pages-seo-desktop-1536.png');
    await page.getByRole('tab', { name: 'Содержимое' }).click();
    await screenshot('actual-pages-editor-main-mobile-390.png', 390, 844); await noOverflow();
    await screenshot('actual-pages-editor-main-desktop-1536.png', 1536, 1024);
    await writeFile(resolve(out, 'native-metadata.json'), JSON.stringify({ pages: pageFields, sections: childFields }, null, 2));
  });

  await check('native parent save is a delta and real 409 retains input until explicit reconciliation', async () => {
    const id = nativeId(); await openCard(id);
    const before = await request(pagePath(id));
    await input('intro').fill(`${marker} native parent saved`);
    const response = page.waitForResponse(res => res.request().method() === 'POST' && new URL(res.url()).pathname === `/commerce/mutations/pages/${id}`);
    await save().click();
    const ack = await response; assert.equal(ack.status(), 200);
    assert.deepEqual(ack.request().postDataJSON().changes, { intro: `${marker} native parent saved` });
    await waitRecord(id, 'intro', `${marker} native parent saved`);
    assert.equal((await request(pagePath(id))).status, before.status);
    await save().waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('.ac-toolbar button')?.disabled);
    await input('title').fill(`${marker} retained local title`);
    const remote = await request(pagePath(id));
    await apiPatch(id, remote, { title: `${marker} concurrent title` });
    const rejected = page.waitForResponse(res => res.request().method() === 'POST' && new URL(res.url()).pathname === `/commerce/mutations/pages/${id}`);
    await save().click(); assert.equal((await rejected).status(), 409);
    await page.getByRole('heading', { name: 'Страница изменена в другом окне' }).waitFor();
    assert.equal(await input('title').inputValue(), `${marker} retained local title`);
    assert.equal(await save().isDisabled(), true);
    await page.getByRole('button', { name: 'Сравнить изменения' }).click();
    await page.locator('.a3pages-diff').waitFor();
    await screenshot('actual-pages-conflict-desktop-1536.png');
    await page.getByRole('button', { name: 'Оставить мои правки', exact: true }).click();
    await page.locator('.a3pages-conflict').waitFor({ state: 'hidden' });
    assert.equal(await input('title').inputValue(), `${marker} retained local title`);
    await save().click(); await waitRecord(id, 'title', `${marker} retained local title`);
  });

  await check('committed save with lost acknowledgement stays locked and retains input', async () => {
    const id = nativeId(); await openCard(id);
    await input('intro').fill(`${marker} lost acknowledgement`);
    let committed;
    await page.route(`**/commerce/mutations/pages/${id}`, async route => {
      const response = await route.fetch(); committed = response.status(); await route.abort('failed');
    }, { times: 1 });
    await save().click();
    await page.getByRole('heading', { name: 'Результат сохранения нужно проверить' }).waitFor();
    assert.equal(committed, 200);
    await waitRecord(id, 'intro', `${marker} lost acknowledgement`);
    assert.equal(await input('intro').inputValue(), `${marker} lost acknowledgement`);
    assert.equal(await save().isDisabled(), true);
    await screenshot('actual-pages-uncertain-desktop-1536.png');
    await reconcile(false);
  });

  await check('native child save checks page owner, advances parent and preserves staged parent edits', async () => {
    const parent = await request(pagePath(seeded[1].id));
    const childEntry = owned.find(row => row.collection === 'page_sections' && row.fields?.page === seeded[1].id);
    assert.ok(childEntry);
    const child = await request(`/items/page_sections/${childEntry.id}?fields=id,page,home_page,title,updated_at,status,section_type,text,sort_order,is_visible`);
    assert.equal(String(child.page), String(parent.id)); assert.equal(child.home_page, null);
    await openCard(parent.id);
    await input('intro').fill(`${marker} parent local edit`);
    await screenshot('actual-pages-long-desktop-1536.png');
    await page.getByRole('tab', { name: 'Блоки страницы' }).click();
    await page.locator('.page-sections-list > button').filter({ hasText: child.title }).click();
    await input('title', 'sections').waitFor();
    await screenshot('actual-pages-sections-clean-desktop.png');
    await screenshot('actual-pages-sections-clean-mobile.png',390,844); await noOverflow();
    await page.setViewportSize({width:1536,height:1024});
    const children = owned.filter(row => row.collection === 'page_sections' && row.fields?.page === parent.id);
    assert.equal(children.length, 2, 'Two independent child buffers must be present');
    const firstChildTitle = `${marker} pending child one`;
    await input('title', 'sections').fill(firstChildTitle);
    const secondChild = children[1];
    await page.locator('.page-sections-list > button').filter({ hasText: secondChild.fields.title }).click();
    await input('title', 'sections').fill(`${marker} saved child`);
    const before = await request(pagePath(parent.id));
    const secondChildAck = page.waitForResponse(res => res.request().method() === 'POST' && new URL(res.url()).pathname === `/commerce/mutations/page_sections/${secondChild.id}`, { timeout: 20000 }).catch(error => ({ waitError: error.message }));
    const secondChildSave = page.getByRole('button', { name: 'Сохранить блок', exact: true });
    assert.equal(await secondChildSave.isEnabled(), true, 'Changed second child must have an enabled save action');
    await secondChildSave.click();
    const secondResponse = await secondChildAck;
    assert.ok(!secondResponse.waitError, `Second child save request did not complete: ${secondResponse.waitError}`);
    assert.equal(secondResponse.status(), 200);
    await page.getByRole('heading', { name: 'После сохранения блока сверьте страницу' }).waitFor();
    const after = await request(pagePath(parent.id));
    assert.notEqual(after.updated_at, before.updated_at);
    assert.equal(after.intro, before.intro);
    const childAfter = await request(`/items/page_sections/${secondChild.id}`);
    assert.equal(childAfter.title, `${marker} saved child`); assert.equal(childAfter.page, parent.id); assert.equal(childAfter.home_page, null);
    await reconcile(true);
    const firstChild = children[0];
    await page.locator('.page-sections-list > button').filter({ hasText: firstChild.fields.title }).click();
    assert.equal(await input('title','sections').inputValue(),firstChildTitle,'Unsaved edits in the first child must survive saving the second');
    const firstChildAck = page.waitForResponse(res => res.request().method() === 'POST' && new URL(res.url()).pathname === `/commerce/mutations/page_sections/${firstChild.id}`, { timeout: 20000 }).catch(error => ({ waitError: error.message }));
    const firstChildSave = page.getByRole('button', { name: 'Сохранить блок', exact: true });
    assert.equal(await firstChildSave.isEnabled(), true, 'Changed first child must have an enabled save action');
    await firstChildSave.click();
    const firstResponse = await firstChildAck;
    assert.ok(!firstResponse.waitError, `First child save request did not complete: ${firstResponse.waitError}`);
    assert.equal(firstResponse.status(),200);
    assert.equal((await request(`/items/page_sections/${firstChild.id}`)).title,firstChildTitle);
    await screenshot('actual-pages-blocks-populated-desktop-1536.png');
    await screenshot('actual-pages-blocks-populated-mobile-390.png', 390, 844); await noOverflow();
    await page.setViewportSize({ width: 1536, height: 1024 });
    await page.getByRole('tab', { name: 'Содержимое' }).first().click();
    assert.equal(await input('intro').inputValue(), `${marker} parent local edit`);
    assert.equal(await save().isDisabled(), true);
    await reconcile(true);
    await save().click(); await waitRecord(parent.id, 'intro', `${marker} parent local edit`);
  });

  await check('status is an explicit status-only CAS, with confirmation for published saves', async () => {
    const id = nativeId(); await openCard(id);
    assert.equal(await page.locator('.a3pages-context-card a').count(), 0, 'Draft must not expose a public link');
    assert.equal(await page.getByText(/черновик не опубликован/i).count(), 1);
    await page.getByRole('button', { name: 'Изменить публикацию', exact: true }).click();
    await page.getByLabel('Новый статус').selectOption('published');
    const statusResponse = page.waitForResponse(res => res.request().method() === 'POST' && new URL(res.url()).pathname === `/commerce/mutations/pages/${id}`);
    await page.getByRole('button', { name: 'Подтвердить изменение', exact: true }).click();
    const response = await statusResponse; assert.equal(response.status(), 200);
    assert.deepEqual(response.request().postDataJSON().changes, { status: 'published' });
    await waitRecord(id, 'status', 'published');
    await openCard(id); await input('h1').fill(`${marker} published H1`);
    dialogPolicy = 'cancel';
    const postsBefore = requests.filter(row => row.method === 'POST').length;
    await save().click();
    assert.equal(requests.filter(row => row.method === 'POST').length, postsBefore);
    assert.match(dialogMessages.at(-1), /опубликованной страницы/);
    assert.notEqual((await request(pagePath(id))).h1, `${marker} published H1`);
    dialogPolicy = 'accept';
    await save().click(); await waitRecord(id, 'h1', `${marker} published H1`);
    assert.equal((await request(pagePath(id))).status, 'published');
    const publishedIntro = `${marker} published intro for visitors`;
    await input('intro').fill(publishedIntro);
    await save().click(); await waitRecord(id, 'intro', publishedIntro);
    const storefrontConfig = await request('/commerce/config/storefront');
    const publicBase = storefrontConfig?.public_base_url ?? storefrontConfig?.data?.public_base_url;
    assert.ok(publicBase, 'The authenticated storefront configuration must provide the verified local base URL');
    const saved = await request(pagePath(id));
    const configuredBase = new URL(publicBase);
    const basePrefix = configuredBase.pathname.replace(/\/+$/, '');
    const publicUrl = `${configuredBase.origin}${basePrefix}/${saved.slug}`;
    const openLink = page.locator('.a3pages-context-card a').filter({ hasText: 'Открыть страницу на сайте' });
    assert.equal(await openLink.getAttribute('href'), publicUrl, 'Open link must use configured storefront origin and saved published slug');
    await input('slug').fill(`${marker}-unsaved-route`);
    assert.equal(await openLink.getAttribute('href'), publicUrl, 'Unsaved route edits must not alter the public link');
    await input('slug').fill(saved.slug);
    const publicResponse = await fetch(publicUrl);
    assert.equal(publicResponse.status, 200, `Public storefront route should load: ${publicUrl}`);
    const publicHtml = await publicResponse.text();
    assert.match(publicHtml, new RegExp(`${marker} published H1`));
    assert.match(publicHtml, new RegExp(publishedIntro));
    assert.match(publicHtml, new RegExp(`${marker} public body text`), 'Saved page body must render its visible lower-page content');
    await writeFile(resolve(out, 'public-page-check.json'), JSON.stringify({ configuredBase: publicBase, savedSlug: saved.slug, publicUrl, responseStatus: publicResponse.status }, null, 2));
    await screenshot('actual-pages-publication-desktop-1536.png');
    await screenshot('actual-pages-publication-mobile-390.png',390,844); await noOverflow();
  });

  await check('controlled missing storefront config has no public link and retries', async () => {
    const id = nativeId();
    await page.route('**/commerce/config/storefront', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { public_base_url: null } }) }), { times: 1 });
    await openCard(id);
    await page.getByText(/адрес сайта пока не настроен/i).waitFor();
    assert.equal(await page.locator('.a3pages-context-card a').count(), 0);
    await screenshot('actual-pages-storefront-config-missing-1536.png');
    await page.goto(origin+'/admin/product-editor/sections/pages');
    await page.route('**/commerce/config/storefront', route => route.abort('failed'), { times: 1 });
    await openCard(id);
    await page.getByRole('button', { name: 'Повторить загрузку адреса сайта' }).waitFor();
    await page.getByRole('button', { name: 'Повторить загрузку адреса сайта' }).click();
    await page.locator('.a3pages-context-card a').waitFor();
  });

  await check('controlled update denial renders populated readonly native fields', async () => {
    const id = nativeId();
    const permPath = `**/permissions/me/pages/${id}`;
    await page.route(permPath, async route => { const response = await route.fetch(); const json = await response.json(); json.data.update.access = false; await route.fulfill({ response, json }); });
    await openCard(id);
    assert.equal(await input('title').isEditable(), false);
    await screenshot('actual-pages-controlled-readonly-desktop-1536.png');
    await page.unrouteAll();
  });

  await check('native OG relation interface can select and unlink an owned file without deleting it', async () => {
    const fileEntry = record('directus_files', { title: `${marker} own image` });
    await journal({ phase: 'before-native-file-upload' });
    const form = new FormData(); form.set('id', fileEntry.id); form.set('title', fileEntry.fields.title);
    form.set('file', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZxkAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), `${marker}.png`);
    const response = await fetch(origin + '/files', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    assert.equal(response.status, 200); const uploaded = (await response.json()).data;
    assert.equal(uploaded.id, fileEntry.id); fileEntry.created = true; await journal({ phase: 'own-file-uploaded' });
    const id = seeded[1].id; await openCard(id);
    await page.getByRole('tab', { name: 'Поиск и ссылки', exact: true }).click();
    const field = page.locator('[data-field="og_image"]'); await field.waitFor();
    await writeFile(resolve(out, 'native-og-field.html'), await field.evaluate(el => el.outerHTML));
    await field.locator('.many-to-one > button').click();
    await screenshot('actual-pages-native-file-chooser.png');
    await writeFile(resolve(out, 'native-file-menu.html'), await page.locator('body').evaluate(el => el.innerHTML));
    await page.getByText(fileEntry.fields.title, { exact: true }).click();
    await page.locator('#dialog-outlet').getByRole('button',{name:'Сохранить',exact:true}).click();
    await page.locator('#dialog-outlet .v-drawer').waitFor({state:'hidden'});
    await save().click(); await waitRecord(id, 'og_image', fileEntry.id);
    await writeFile(resolve(out, 'native-og-selected.html'), await field.evaluate(el => el.outerHTML));
    await field.locator('button.v-icon').filter({ has: page.locator('[data-icon="close"]') }).click();
    await save().click(); await waitRecord(id, 'og_image', null);
    assert.equal((await request(`/files/${fileEntry.id}`)).id, fileEntry.id);
  });

  await check('single SEO surface hydrates JSON fallback and preserves unknown keys', async () => {
    const id = seeded[1].id; await openCard(id);
    await page.getByRole('tab', { name: 'Поиск и ссылки' }).click();
    await page.locator('[data-field="seo_title"]').waitFor();
    const baseline = await request(pagePath(id));
    assert.equal(await page.locator('[data-field="seo_title"] input').inputValue(), baseline.seo_title ?? baseline.seo?.title ?? '');
    assert.equal(await input('seo_description','seo').inputValue(), baseline.seo_description ?? baseline.seo?.meta_description ?? '');
    const indexationCheckbox = page.locator('[data-field="is_indexable"]').getByRole('checkbox');
    assert.equal(await indexationCheckbox.count(), 1, 'The public indexation control must be an accessible checkbox');
    assert.equal(await indexationCheckbox.isChecked(), false, 'JSON no_index fallback should project to unchecked indexation');
    assert.equal(await save().isDisabled(), true, 'Hydrating JSON SEO fallback must not dirty the form');
    const fallbackLabel = await page.locator('[data-field="seo_title"] label').innerText().catch(() => '');
    await writeFile(resolve(out, 'native-seo-fallback.json'), JSON.stringify({ scalar: baseline.seo_title, projected: baseline.seo?.title, fieldLabel: fallbackLabel }, null, 2));
    await screenshot('actual-pages-seo-desktop-1536.png');
    await input('seo_description','seo').fill(`${marker} edited description`);
    await save().click(); await waitRecord(id, 'seo_description', `${marker} edited description`);
    const saved = await request(pagePath(id));
    assert.equal(saved.seo?.meta_description, `${marker} edited description`);
    assert.equal(saved.seo?.custom_unknown, baseline.seo?.custom_unknown, 'Unknown SEO JSON keys must survive scalar projection writes');
    assert.equal(saved.seo?.additional_fields?.custom_unknown, baseline.seo?.additional_fields?.custom_unknown);
  });

  await check('server pagination, modified-click navigation and all mobile panel widths are usable', async () => {
    for (let i=4;i<29;i++) await createSynthetic('pages', syntheticPageFields(i));
    await page.goto(origin + '/admin/product-editor/sections/pages');
    await page.getByRole('table').waitFor(); await closeRightPanel();
    const search = page.getByRole('searchbox', {name:'Поиск страниц'}); await search.fill(marker);
    await page.getByRole('button', {name:'Следующая страница'}).waitFor();
    const next = page.getByRole('button', {name:'Следующая страница'});
    await page.waitForFunction(() => !document.querySelector('[aria-label="Следующая страница"]')?.disabled);
    await next.click();
    await page.waitForFunction(() => document.querySelector('.a3pages-pagination')?.textContent.includes('2 из'));
    assert.ok(await page.locator('tbody tr').count() < 25);
    const link = page.locator('.a3pages-name').first(); const href = await link.getAttribute('href');
    assert.ok(owned.some(row => href.endsWith('/'+row.id)));
    const opened = context.waitForEvent('page'); await link.click({modifiers:['Control']});
    const popup = await opened; await popup.waitForURL(origin+href); await popup.locator('[data-field="title"] input').waitFor(); await popup.close();
    await page.getByRole('button', {name:'Предыдущая страница'}).click();
    await page.waitForFunction(() => document.querySelector('.a3pages-pagination')?.textContent.includes('1 из'));
    for(const width of [320,390,430]) {
      await page.setViewportSize({width,height:844}); await page.waitForTimeout(450); await closeRightPanel(); await noOverflow();
      await screenshot(`actual-pages-list-closed-${width}.png`, width, 844);
      const toggle = page.locator('button').filter({has:page.locator('[data-icon="right_panel_open"]')});
      if(await toggle.count()) {await toggle.first().click();await page.locator('#dialog-outlet .v-overlay.active .overlay').last().waitFor();await page.waitForTimeout(450);}
      await screenshot(`actual-pages-list-open-${width}.png`, width, 844); await noOverflow();
      await closeRightPanel();
    }
    await page.setViewportSize({width:1536,height:1024});
    await screenshot('actual-pages-list-desktop-1536.png');
  });

  await check('dirty navigation cancel retains input and uncertain create never retries or adopts', async () => {
    const id = seeded[1].id; await openCard(id);
    await input('title').fill(`${marker} ${'Очень длинный заголовок страницы '.repeat(4)}`);
    dialogPolicy='cancel'; await page.getByRole('link', {name:'‹ Все страницы',exact:true}).click();
    assert.ok(page.url().endsWith('/'+id)); assert.ok((await input('title').inputValue()).includes('Очень длинный'));
    await screenshot('actual-pages-long-mobile-390.png',390,844); await noOverflow();
    dialogPolicy='accept'; await page.goto(origin+'/admin/product-editor/sections/pages/+');
    await input('title').fill(`${marker} uncertain create`); await input('slug').fill(`${marker}-uncertain`); await input('h1').fill(`${marker} uncertain H1`);
    loseNextCreate=true; await page.getByRole('button',{name:'Создать черновик',exact:true}).click();
    await page.getByRole('heading',{name:'Создание не подтверждено',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Создать черновик',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:'Проверить точный адрес',exact:true}).click();
    await page.getByText(/Они не присвоены вашему запросу/).waitFor();
    assert.ok(page.url().endsWith('/+'));
    await screenshot('actual-pages-uncertain-create-390.png',390,844);
  });

  await check('final native card tabs and desktop panel evidence', async () => {
    await openCard(nativeId());
    await capturePagesStyleEvidence('native-editor-final');
    await screenshot('actual-pages-editor-final-desktop-1536.png');
    await screenshot('actual-pages-main-tablet-1024.png',1024,900); await noOverflow();
    await page.setViewportSize({width:1536,height:1024});await closeRightPanel();
    const toggle=page.locator('button').filter({has:page.locator('[data-icon="right_panel_open"]')});
    if(await toggle.count()) {await toggle.first().click();await page.waitForTimeout(450);}
    await screenshot('actual-pages-main-panel-open-1536.png');await noOverflow();await closeRightPanel();
    await page.getByRole('tab',{name:'Дополнительно',exact:true}).click();
    await page.getByText('Переводы', {exact:true}).waitFor();
    await page.getByText('Переводы не заданы.', {exact:true}).waitFor();
    await page.getByText('Системные сведения', {exact:true}).waitFor();
    assert.equal(await page.locator('[data-field="id"] input').count(),0);
    assert.equal(await save().isDisabled(),true);
    await screenshot('actual-pages-additional-desktop.png');
    await screenshot('actual-pages-additional-mobile.png',390,844);await noOverflow();
    assert.deepEqual(fatal,[]);
  });

  await check('existing commerce routes remain readable without writes', async () => {
    await page.goto(origin+'/admin/product-editor/sections/home_page');
    await page.locator('[data-field="hero_title"]').waitFor();
    for (const [path, heading] of [['/admin/product-editor/sections/categories', 'Категории'], ['/admin/product-editor', 'Товары'], ['/admin/product-editor/+','Новый товар']]) {
      await page.goto(origin + path); await page.getByRole('heading', { name: heading, exact: true }).first().waitFor({ timeout: 30000 });
    }
    await assert.rejects(request('/items/pages?fields=id', { anonymous: true }), error => [401, 403].includes(error.status));
    await assert.rejects(request('/commerce/config/storefront', { anonymous: true }), error => [401, 403].includes(error.status));
    await assert.rejects(request(`/commerce/mutations/pages/${nativeId()}`, { method:'POST',body:{expected:{id:nativeId()},changes:{}},anonymous:true }), error=>[401,403].includes(error.status));
  });

  await check('controlled list loading/error/retry use distinct states', async () => {
    let release, entered;
    const held=new Promise(resolvePromise=>release=resolvePromise), observed=new Promise(resolvePromise=>entered=resolvePromise);
    const match='**/items/pages?**';
    await page.route(match,async route=>{entered();await held;await route.continue();},{times:1});
    await page.goto(origin+'/admin/product-editor/sections/pages');await observed;
    try {await page.getByText('Загружаем страницы…',{exact:true}).waitFor();await screenshot('actual-pages-controlled-loading.png');} finally {release();}
    await page.getByRole('table').waitFor();
    await page.route(match,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({errors:[{message:'Synthetic outage'}]})}));
    await page.reload();await page.getByRole('heading',{name:'Не удалось загрузить страницы',exact:true}).waitFor();
    await screenshot('actual-pages-controlled-error.png');await page.unroute(match);
    await page.getByRole('button',{name:'Повторить',exact:true}).click();await page.getByRole('table').waitFor();
    await page.route(match, async route => {
      const response = await route.fetch(); const json = await response.json();
      json.data = []; json.meta = { ...(json.meta ?? {}), filter_count: 0, total_count: 0 };
      await route.fulfill({ response, json });
    }, { times: 1 });
    await page.reload(); await page.getByRole('heading',{name:'Страниц пока нет',exact:true}).waitFor();
    await screenshot('actual-pages-collection-empty-1536.png');
    await page.route(match, route => route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({data:[],meta:{filter_count:0,total_count:17}}) }), { times:1 });
    await page.getByRole('searchbox',{name:'Поиск страниц'}).fill('a3-no-such-page');
    await page.getByRole('heading',{name:'По этим условиям страницы не найдены',exact:true}).waitFor();
    assert.equal(await page.getByRole('heading',{name:'Страниц пока нет',exact:true}).count(),0);
    await screenshot('actual-pages-search-empty-1536.png');
    await page.unroute(match);
    await page.reload(); await page.getByRole('table').waitFor();
    assert.deepEqual(fatal,[],'Uncaught Vue/browser errors');
  });
} catch (error) {
  results.push({ name: 'probe setup/execution', status: 'FAIL', error: error.message });
  console.log(`FAIL probe setup/execution: ${error.message}`);
} finally {
  await browser?.close().catch(() => {});
  // Remove only rows whose exact id was journaled by this process. Never query
  // or adopt a matching slug and never touch the pre-existing ownership manifest.
  if (token) {
    let childrenClean = true;
    for (const entry of [...owned].reverse().sort((a,b) => ({page_sections:0,pages:1,directus_files:2}[a.collection] - {page_sections:0,pages:1,directus_files:2}[b.collection]))) {
      if (entry.cleaned) continue;
      if (entry.collection === 'pages' && !childrenClean) {
        results.push({ name: `skip parent cleanup while owned child remains ${entry.id}`, status: 'FAIL', error: 'Child cleanup did not verify absence.' });
        continue;
      }
      await check(`exact owned cleanup ${entry.collection} ${entry.id}`, async () => {
        const collectionPath = entry.collection === 'directus_files' ? '/files' : `/items/${entry.collection}`;
        const columns = entry.collection === 'pages' ? 'id,updated_at,title,slug,status' : entry.collection === 'page_sections' ? 'id,updated_at,page,home_page,title' : 'id,title';
        const found = await request(`${collectionPath}?filter[id][_eq]=${encodeURIComponent(entry.id)}&fields=${columns}&limit=2`);
        assert.ok(Array.isArray(found), 'Collection-level exact ownership verification failed');
        assert.ok(found.length <= 1, 'Unexpected duplicate fixture identity result');
        if (found.length) {
          const current = found[0]; assert.equal(String(current.id), entry.id);
          if (entry.collection === 'pages') {
            assert.equal(current.slug, entry.fields.slug, 'Refusing cleanup after ownership drift');
            assert.ok(current.title?.includes(marker), 'Refusing cleanup of a non-synthetic page');
          } else if(entry.collection === 'page_sections') {
            assert.equal(String(current.page), String(entry.fields.page)); assert.equal(current.home_page, null);
            assert.ok(current.title?.includes(marker), 'Refusing cleanup of a non-synthetic section');
          } else {
            assert.equal(current.title, entry.fields.title);
          }
          if (entry.collection === 'page_sections' || entry.collection === 'pages') {
            const expected = entry.collection === 'pages' ? current : { id: entry.id, updated_at: current.updated_at, page: current.page, home_page: current.home_page, title: current.title };
            await request(`/commerce/mutations/${entry.collection}/${entry.id}`, { method: 'POST', body: { expected, action: 'delete' } });
          } else {
            await request(`/files/${entry.id}`, { method: 'DELETE' });
          }
        }
        const remaining = await request(`${collectionPath}?filter[id][_eq]=${encodeURIComponent(entry.id)}&fields=id&limit=2`);
        assert.deepEqual(remaining, [], 'Exact fixture still exists after cleanup');
        entry.cleaned = true; await journal({ phase: 'cleanup-progress' });
      });
      if (entry.collection === 'page_sections' && results.at(-1)?.status !== 'PASS') childrenClean = false;
    }
  }
  await writeFile(resolve(out, 'served-module-sha256.json'), JSON.stringify(sourceHashes, null, 2));
  await writeFile(resolve(out, 'requests.json'), JSON.stringify(requests, null, 2));
  await writeFile(resolve(out, 'results.json'), JSON.stringify({ run, target: origin, mode: 'installed Directus bundle; no candidate-module route override', results, pass: results.filter(row => row.status === 'PASS').length, fail: results.filter(row => row.status === 'FAIL').length, fatal, warnings }, null, 2));
  console.log(`Artifacts: ${out}`);
  if (results.some(result => result.status === 'FAIL') || owned.some(entry => entry.created && !entry.cleaned)) process.exitCode = 1;
  lockProc?.stdin.end();
  if (lockProc) await once(lockProc, 'exit').catch(() => {});
}
