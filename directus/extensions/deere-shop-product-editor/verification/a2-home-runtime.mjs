/** Explicit own-fixture acceptance. No installed bundle, schema or permissions change.
 * node --env-file=<own-dev-env> <this-file> --synthetic-probe --ownership-manifest=<private-exact-ownership-manifest>
 * Only :18056. Journals before writes; restores current singleton content by CAS.
 * Existing acceptance singleton and its manifest are NEVER deleted or modified.
 */
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const extension = resolve(root, 'directus/extensions/deere-shop-product-editor');
const require = createRequire(resolve(root, 'storefront/package.json'));
const { chromium } = require('playwright');
const origin = 'http://127.0.0.1:18056';
assert.equal(process.env.DIRECTUS_URL ?? origin, origin, 'Only the approved own loopback instance');
assert.ok(process.argv.includes('--synthetic-probe'), 'Explicit synthetic probe flag required');
assert.ok(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD, 'Load own dev credentials privately');
const manifestPath = process.argv.find(arg => arg.startsWith('--ownership-manifest='))?.slice('--ownership-manifest='.length);
assert.ok(manifestPath, 'An exact pre-existing synthetic ownership manifest is required');
const oldManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
assert.equal(oldManifest.target, origin);
assert.equal(oldManifest.phase, 'active');
const recoveryPath=process.argv.find(arg=>arg.startsWith('--cleanup-ledger='))?.slice('--cleanup-ledger='.length);
const recovery=recoveryPath?JSON.parse(await readFile(recoveryPath,'utf8')):null;
if(recovery){assert.equal(recovery.target,origin);assert.match(recovery.run,/^[0-9a-f-]{36}$/);assert.ok(recovery.baseline?.id);}
const run = recovery?.run ?? randomUUID(), tag = `a2-${run}`, marker = `A2 ${run.slice(0,6)}`;
const out = recoveryPath?dirname(resolve(recoveryPath)):resolve(tmpdir(), 'universal-cms-a2', tag);
await mkdir(out, { recursive: true });
const results = [], owned = recovery?.owned ?? [], servedHashes = {}, requests = [], fatal = [], warnings = [];
let token, browser, page, home, baseline=recovery?.baseline, lastKnown=recovery?.lastKnown, pendingHome = recovery?.pendingHome ?? null, imageFixture = null, restored = false;
let loseNextAcknowledgement = false;
let holdNextAcknowledgement = null;
const modules = ['index.js','editor-state.mjs','admin-shell.js','admin-state.mjs','page-sections.js','sections/categories.js','sections/home_page.js'];
const equal = (a,b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const specification = JSON.parse(await readFile(resolve(root, 'docs/admin-sections/sections/home_page/fields.json'), 'utf8'));
const fields = Object.keys(specification.fields).filter(field => field !== 'sections');
const writable = fields.filter(field => !['id','status','source_page','created_at','updated_at'].includes(field));
const ledger = async (extra = {}) => writeFile(resolve(out,'owned-fixtures.json'), JSON.stringify({run,target:origin,baseline,lastKnown,pendingHome,owned,...extra},null,2));
async function request(path, {method='GET',body,anonymous=false}={}) {
  const response = await fetch(origin+path,{method,headers:{...(!anonymous&&token?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const json=await response.json().catch(()=>({}));
  if(!response.ok) throw Object.assign(Error(`HTTP ${response.status} ${method} ${path.split('?')[0]}`),{status:response.status});
  return json.data ?? json;
}
const readHome = () => request(`/items/home_page?fields=${fields.join(',')}`);
async function check(name, fn) {
  try { await fn(); results.push({name,status:'PASS'}); console.log(`PASS ${name}`); }
  catch(error) { results.push({name,status:'FAIL',error:error.message}); console.log(`FAIL ${name}: ${error.message}`); await page?.screenshot({path:resolve(out,`failure-${results.length}.png`)}).catch(()=>{}); }
}
async function remoteHome(changes) {
  const current=await readHome();
  assert.equal(current.id,home.id); assert.equal(current.status,baseline.status); assert.equal(current.source_page,baseline.source_page);
  assert.ok(Object.keys(changes).every(field=>writable.includes(field)));
  pendingHome={expected:{id:home.id,updated_at:current.updated_at,...Object.fromEntries(Object.keys(changes).map(field=>[field,current[field]]))},changes}; await ledger();
  try { return await request(`/commerce/mutations/home_page/${home.id}`,{method:'POST',body:pendingHome}); }
  finally { lastKnown=await readHome();pendingHome=null;await ledger(); }
}
async function createChild(index, type='text') {
  const id=randomUUID(), title=`Секция ${String(index+1).padStart(2,'0')} · ${marker}`;
  const entry={collection:'page_sections',id,title,created:false,cleaned:false};owned.push(entry);await ledger();
  const row=await request('/items/page_sections',{method:'POST',body:{id,home_page:home.id,page:null,title,text:'Синтетический текст секции для отдельного сохранения.',section_type:type,status:'draft',is_visible:false,sort_order:-100000+index}});
  entry.created=true;await ledger();return row;
}
async function childSave(row, changes) {
  const current=await request(`/items/page_sections/${row.id}`);
  return request(`/commerce/mutations/page_sections/${row.id}`,{method:'POST',body:{expected:{id:row.id,updated_at:current.updated_at,page:current.page,home_page:current.home_page,...Object.fromEntries(Object.keys(changes).map(field=>[field,current[field]]))},changes}});
}
const input = name => page.locator(`[data-field="${name}"] input, [data-field="${name}"] textarea`).first();
const saveButton = () => page.getByRole('button',{name:'Сохранить',exact:true});
const tab = name => page.getByRole('tab',{name,exact:true}).first().click();
async function screenshot(name,width=1536,height=1024) { await page.setViewportSize({width,height});await page.screenshot({path:resolve(out,name)}); }
async function assertNoOverflow() { const dimensions=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(dimensions.scroll<=dimensions.client,JSON.stringify(dimensions)); }

try {
  token=(await request('/auth/login',{method:'POST',body:{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD}})).access_token;
  if(recovery){
    home=await readHome();assert.equal(home.id,baseline.id);
    const ownership=oldManifest.ownership?.home_page?.[home.id];assert.ok(oldManifest.created?.home_page?.includes(home.id));assert.ok(ownership&&Object.entries(ownership).every(([field,value])=>equal(baseline[field],value)),'Recovery baseline must match the prior exact synthetic ownership');
  }else{
  home=await readHome();baseline=structuredClone(home);lastKnown=structuredClone(home);
  const ownership=oldManifest.ownership?.home_page?.[home.id];
  assert.ok(oldManifest.created?.home_page?.includes(home.id),'Singleton is not a journaled synthetic creation');
  assert.ok(ownership && Object.entries(ownership).every(([field,value])=>equal(home[field],value)),'Synthetic ownership values no longer match; no writes permitted');
  await ledger({provenanceVerified:true});
  await check('live singleton, all 34 business fields and native interfaces',async()=>{
    const metadata=await request('/fields/home_page');
    for(const [field,spec]of Object.entries(specification.fields)){const actual=metadata.find(row=>row.field===field);assert.ok(actual,field);assert.equal(actual.type,spec.schema.type,field);assert.equal(Boolean(actual.meta.required),Boolean(spec.schema.required),field);}
    const count=await request('/items/home_page?aggregate%5Bcount%5D=id');assert.equal(Number(count.count.id),1);
    assert.equal(metadata.find(row=>row.field==='hero_image').meta.interface,'file-image');
    assert.equal(metadata.find(row=>row.field==='seo').meta.interface,'seo-interface');
    assert.equal(metadata.find(row=>row.field==='og_image').meta.interface,'select-dropdown-m2o');
    const item=await request(`/permissions/me/home_page/${home.id}`);assert.equal(item.update.access,true);
  });
  await check('exact source/dist parity of every candidate module',async()=>{for(const name of modules) assert.ok((await readFile(resolve(extension,'src',name))).equals(await readFile(resolve(extension,'dist',name))),name);});
  if(results.some(result=>result.status==='FAIL'))throw Error('Preflight failed before any data mutation');
  const children=[];
  const bundle=await (await fetch(origin+'/extensions/sources/index.js')).text();
  const imports={};for(const [key,name]of [['vue','vue'],['vue-router','vue-router'],['@directus/extensions-sdk','@directus_extensions-sdk']]){const match=bundle.match(new RegExp(`['"]([^'"]*${name}\\.[^'"]*entry\\.js)['"]`));assert.ok(match,`Installed ${key} import`);imports[key]=match[1];}
  browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1536,height:1024}});
  await context.route('**/extensions/sources/index.js*',async route=>{const candidate=bundle.replace(/const modules = \[[^\]]*\];/,'const modules = [a2Candidate];');assert.notEqual(candidate,bundle);await route.fulfill({contentType:'application/javascript',body:`import a2Candidate from '/__a2_candidate__/index.js';\n${candidate}`});});
  await context.route('**/__a2_candidate__/**',async route=>{const name=new URL(route.request().url()).pathname.replace('/__a2_candidate__/','');assert.ok(modules.includes(name));let source=await readFile(resolve(extension,'dist',name),'utf8');servedHashes[name]=createHash('sha256').update(source).digest('hex');for(const [key,path]of Object.entries(imports))source=source.replaceAll(`from "${key}"`,`from "${path}"`);await route.fulfill({contentType:'application/javascript',body:source});});
  await context.route('**/commerce/mutations/home_page/**',async route=>{
    const payload=route.request().postDataJSON();assert.equal(new URL(route.request().url()).pathname,`/commerce/mutations/home_page/${home.id}`);
    assert.ok(Object.keys(payload.changes??{}).every(field=>writable.includes(field)),'UI attempted a protected parent field');
    pendingHome=payload;await ledger();const response=await route.fetch();lastKnown=await readHome();pendingHome=null;await ledger();
    if(holdNextAcknowledgement){const gate=holdNextAcknowledgement;holdNextAcknowledgement=null;gate.entered();await gate.released;}
    if(loseNextAcknowledgement&&response.ok()){loseNextAcknowledgement=false;await route.abort('failed');}else await route.fulfill({response});
  });
  page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',error=>fatal.push(error.message));page.on('console',message=>{if(['warning','error'].includes(message.type())&&/Failed to resolve component|Invalid prop|Unhandled error/.test(message.text()))warnings.push(message.text());});
  page.on('request',req=>{if(req.url().includes('/commerce/mutations/')||req.url().includes('/items/page_sections')||new URL(req.url()).pathname==='/files')requests.push({method:req.method(),path:new URL(req.url()).pathname,query:new URL(req.url()).search,body:req.postDataJSON()});});
  await page.addLocatorHandler(page.getByText('Have a license key?',{exact:true}),async()=>page.getByRole('button',{name:'Пропустить',exact:true}).click());
  await page.addLocatorHandler(page.getByRole('button',{name:'Remind Later',exact:true}),async()=>page.getByRole('button',{name:'Remind Later',exact:true}).click());
  await page.goto(origin+'/admin/login');await page.locator('input[type=email]').fill(process.env.ADMIN_EMAIL);await page.locator('input[type=password]').fill(process.env.ADMIN_PASSWORD);await page.locator('button[type=submit]').click();await page.waitForURL(url=>!url.pathname.endsWith('/login'),{timeout:30000});
  await page.goto(origin+'/admin/product-editor/sections/home_page');
  const closePanel=page.locator('button').filter({has:page.locator('[data-icon="right_panel_close"]')});
  if(await closePanel.count())await closePanel.click();
  await check('native singleton opens in hero tab with native file interface and five tabs',async()=>{await input('hero_title').waitFor();assert.equal(await page.getByRole('tab',{name:'Первый экран',exact:true}).getAttribute('aria-selected'),'true');for(const name of ['Основное','Первый экран','Секции','SEO','Дополнительно'])assert.equal(await page.getByRole('tab',{name,exact:true}).count(),1);await page.locator('[data-field="hero_image"]').waitFor();await assertNoOverflow();});
  if(results.at(-1).status==='FAIL')throw Error('Native editor did not open; further browser writes stopped');
  if(await closePanel.count())await closePanel.click();
  assert.equal(await saveButton().isDisabled(),true,'Fresh native forms must not create incidental edits');
  if(process.argv.includes('--inspect-only')) {
    await screenshot('actual-hero-1536.png');await screenshot('actual-hero-390.png',390,844);
    await page.setViewportSize({width:1536,height:1024});
    await check('main, advanced hero and additional native fields are reachable without incidental writes',async()=>{
      await tab('Основное');await page.locator('[data-field="h1"]').waitFor({state:'visible'});await page.locator('[data-field="source_page"]').waitFor({state:'visible'});await screenshot('actual-overview-1536.png');
      await tab('Первый экран');await page.locator('.home-page-advanced summary').click();
      for(const name of ['hero_search_label','hero_search_placeholder','hero_search_button_text','hero_bulk_prompt','hero_bulk_link_text','hero_bulk_link_url','hero_excel_link_text','hero_excel_link_url','hero_photo_link_text','hero_photo_link_url'])await page.locator(`[data-field="${name}"]`).waitFor({state:'visible'});
      await screenshot('actual-search-expanded-1536.png');await assertNoOverflow();
      await tab('Дополнительно');await page.locator('[data-field="translations"]').waitFor({state:'visible'});await screenshot('actual-additional-1536.png');assert.equal(await saveButton().isDisabled(),true);assert.equal(requests.filter(row=>row.method==='POST').length,0);
    });
    await check('long local hero copy remains readable on mobile without a write',async()=>{
      await tab('Первый экран');await input('hero_title').fill('Длинный синтетический заголовок для проверки чтения и прокрутки поля на узком экране. '.repeat(2));await input('hero_text').fill('Подробное синтетическое описание для проверки длинного текста в нативном поле Directus. '.repeat(8));
      await screenshot('actual-long-copy-390.png',390,844);await assertNoOverflow();assert.equal(requests.filter(row=>row.method==='POST').length,0);
      page.once('dialog',dialog=>dialog.accept());await page.reload();await input('hero_title').waitFor();await page.setViewportSize({width:1536,height:1024});
    });
    await writeFile(resolve(out,'native-fields.html'),await page.locator('[data-field="hero_title"], [data-field="hero_text"], [data-field="hero_image"]').evaluateAll(elements=>elements.map(element=>element.outerHTML).join('\n')));
    await writeFile(resolve(out,'ui-metrics.json'),JSON.stringify(await page.locator('[data-field="hero_title"] input, [data-field="hero_text"] .v-textarea, [data-field="hero_text"] textarea, [data-field="hero_image"], [data-field="hero_image"] .image, [data-field="hero_image"] .image-preview, [data-field="hero_image"] .info, [data-field="hero_image_alt"], .home-page-hero-layout').evaluateAll(elements=>elements.map(element=>{const style=getComputedStyle(element);return {tag:element.tagName,class:element.className,rect:element.getBoundingClientRect().toJSON(),height:style.height,minHeight:style.minHeight,maxHeight:style.maxHeight,paddingTop:style.paddingTop,paddingBottom:style.paddingBottom,position:style.position,overflow:style.overflow,aspectRatio:style.aspectRatio};})),null,2));
    await tab('SEO');await screenshot('actual-seo-1536.png');
    await tab('Секции');const first=page.locator('.page-sections-list > button').first();if(await first.count())await first.click();await screenshot('actual-sections-1536.png');await screenshot('actual-sections-390.png',390,844);
  } else {
  for(let index=0;index<26;index++)children.push(await createChild(index));
  // Select an existing exact-ID synthetic image from the same approved fixture
  // manifest. Neither its bytes nor its metadata are changed or deleted.
  for(const id of oldManifest.created?.directus_files??[]){
    if(id===baseline.hero_image)continue;const expected=oldManifest.ownership?.directus_files?.[id];if(!expected)continue;
    const file=await request(`/files/${id}`);if(!file.type?.startsWith('image/'))continue;
    assert.ok(Object.entries(expected).every(([field,value])=>equal(file[field],value)),'Alternate synthetic image ownership mismatch');imageFixture=file;break;
  }
  assert.ok(imageFixture,'An existing manifest-owned alternate image is required for native picker acceptance');
  await page.reload();await input('hero_title').waitFor();
  if(await closePanel.count())await closePanel.click();
  await check('actual hero screenshots desktop, 1024 and mobile have no document overflow or media overlap',async()=>{
    await page.locator('[data-field="hero_image"] .info').waitFor();
    await screenshot('actual-hero-1536.png');await assertNoOverflow();
    const metrics=await page.evaluate(()=>{const rect=selector=>document.querySelector(selector)?.getBoundingClientRect().toJSON();return {input:rect('[data-field="hero_title"] .v-input'),textarea:rect('[data-field="hero_text"] .v-textarea'),image:rect('[data-field="hero_image"] .image-preview'),caption:rect('[data-field="hero_image"] .info'),alt:rect('[data-field="hero_image_alt"]'),copy:rect('.home-page-hero-copy'),media:rect('.home-page-hero-media')};});
    await writeFile(resolve(out,'ui-metrics.json'),JSON.stringify(metrics,null,2));assert.ok(Math.abs(metrics.input.height-40)<=1,JSON.stringify(metrics.input));assert.ok(metrics.textarea.height>=78&&metrics.textarea.height<=84,JSON.stringify(metrics.textarea));assert.ok(metrics.image.bottom<=metrics.alt.top,'Native image must not overlap alt field');assert.ok(metrics.caption.bottom<=metrics.alt.top,'Native caption must not overlap alt field');const share=metrics.copy.width/(metrics.copy.width+metrics.media.width);assert.ok(share>=.54&&share<=.58,`Hero copy ratio ${share}`);
    await screenshot('actual-hero-1024.png',1024,900);await assertNoOverflow();await screenshot('actual-hero-390.png',390,844);await assertNoOverflow();await page.setViewportSize({width:1536,height:1024});
  });
  await check('parent hero CAS persists without status change or child writes; saving visibly guards fields and tabs',async()=>{
    const before=requests.filter(row=>row.method==='POST').length;await input('hero_title').fill(`Главная страница · ${marker}`);
    let entered,release;const observed=new Promise(resolve=>entered=resolve),released=new Promise(resolve=>release=resolve);holdNextAcknowledgement={entered,released};
    const acknowledgement=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname===`/commerce/mutations/home_page/${home.id}`);
    await saveButton().click();await observed;
    try{assert.equal(await saveButton().isDisabled(),true);assert.equal(await input('hero_title').isEditable(),false);assert.equal(await page.getByRole('tab',{name:'Секции',exact:true}).isDisabled(),true);}finally{release();}
    assert.equal((await acknowledgement).status(),200);const fresh=await readHome();assert.equal(fresh.hero_title,`Главная страница · ${marker}`);assert.equal(fresh.status,baseline.status);const writes=requests.filter(row=>row.method==='POST').slice(before);assert.equal(writes.length,1);assert.ok(writes[0].path.includes('/home_page/'));assert.deepEqual(Object.keys(writes[0].body.changes),['hero_title']);
  });
  await check('sections use independent native child CAS and bounded 25-row paging',async()=>{await tab('Секции');await page.locator('.page-sections-list > button').filter({hasText:children[0].title}).click();await input('title').waitFor();await screenshot('actual-sections-1536.png');await assertNoOverflow();await screenshot('actual-sections-390.png',390,844);await assertNoOverflow();await page.setViewportSize({width:1536,height:1024});const before=(await readHome()).hero_title;await input('title').fill(`${marker} · Изменённая секция`);await page.getByRole('button',{name:'Сохранить секцию',exact:true}).click();await page.getByText('Секция сохранена.',{exact:true}).waitFor();const saved=await request(`/items/page_sections/${children[0].id}`);assert.equal(saved.title,`${marker} · Изменённая секция`);assert.equal((await readHome()).hero_title,before);const queries=requests.filter(row=>row.path==='/items/page_sections');assert.ok(queries.some(row=>{const params=new URLSearchParams(row.query);return params.get('limit')==='25';}));});
  await check('native section paging requests page two and restores page one without accumulating rows',async()=>{const list=page.locator('.page-sections-list');await list.getByRole('button',{name:'Далее',exact:true}).click();await list.getByRole('button').filter({hasText:children[25].title}).waitFor();assert.ok(await list.locator(':scope > button').count()<=25);await list.getByRole('button',{name:'Назад',exact:true}).click();await list.getByRole('button').filter({hasText:`${marker} · Изменённая секция`}).waitFor();assert.ok(await list.locator(':scope > button').count()<=25);});
  await check('SEO uses installed native plugin and marked local snippet',async()=>{await tab('SEO');await page.locator('[data-field="seo"]').waitFor();await screenshot('actual-seo-1536.png');await assertNoOverflow();});
  await check('real parent 409 retains input and blocks another write',async()=>{await tab('Первый экран');await input('hero_title').fill(`${marker} · Локальная правка`);await remoteHome({hero_title:`${marker} · Конкурентная правка`});await saveButton().click();await page.getByRole('heading',{name:'Запись изменилась в другом окне',exact:true}).waitFor();assert.equal(await input('hero_title').inputValue(),`${marker} · Локальная правка`);assert.equal(await saveButton().isDisabled(),true);await page.locator('.home-page-conflict').getByRole('button',{name:'Сравнить текущую версию',exact:true}).click();await page.locator('.home-page-conflict-diff').waitFor();await screenshot('actual-conflict-1536.png');});
  await check('explicit conflict discard reloads current values',async()=>{await page.getByRole('button',{name:'Загрузить текущие значения',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-field="hero_title"] input')?.value.endsWith('Конкурентная правка'));assert.equal(await input('hero_title').inputValue(),`${marker} · Конкурентная правка`);});
  await check('unknown acknowledgement keeps input and prevents blind repeat after actual commit',async()=>{await input('hero_title').fill(`${marker} · Потерянный ответ`);loseNextAcknowledgement=true;await saveButton().click();await page.getByText(/не подтверждён/).first().waitFor();assert.equal(await input('hero_title').inputValue(),`${marker} · Потерянный ответ`);assert.equal((await readHome()).hero_title,`${marker} · Потерянный ответ`);assert.equal(await saveButton().isDisabled(),true);await screenshot('actual-uncertain-1536.png');});
  // Recover through the actual explicit reconcile action. A full reload below is
  // intentionally confirmed only after the retained-input assertions above.
  await page.getByRole('button',{name:/Загрузить актуальные данные|Загрузить текущие значения/,exact:true}).first().click();
  await check('native media unlink is local, required validation blocks save, and file remains',async()=>{
    const field=page.locator('[data-field="hero_image"]');await field.locator('.image-preview').hover();await field.locator('button').filter({has:page.locator('[data-icon="close"]')}).click();
    const before=requests.filter(row=>row.method==='POST').length;await saveButton().click();await page.getByText(/Обязательное поле|обязательное/).first().waitFor();assert.equal(requests.filter(row=>row.method==='POST').length,before);assert.equal((await request(`/files/${baseline.hero_image}`)).id,baseline.hero_image);
    await field.locator('.v-upload button').filter({has:page.locator('[data-icon="folder_open"]')}).click();await page.locator('#dialog-outlet').getByText('Все файлы',{exact:true}).click();
    await page.locator('#dialog-outlet button').filter({has:page.locator('[data-icon="search"]')}).click();
    await page.locator('#dialog-outlet input[type="search"]').fill(imageFixture.filename_download);
    const own=page.locator('#dialog-outlet .card.select-mode').filter({hasText:imageFixture.title});
    try{await own.waitFor();await own.click();}catch(error){await writeFile(resolve(out,'native-file-library.html'),await page.locator('#dialog-outlet').innerHTML());throw error;}
    await page.screenshot({path:resolve(out,'actual-native-file-library.png')});await page.locator('#dialog-outlet').getByRole('button',{name:'Сохранить',exact:true}).click();await own.waitFor({state:'hidden'});
    await page.waitForFunction(id=>document.querySelector('[data-field="hero_image"] img')?.src.includes(id),imageFixture.id);
    const ack=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname===`/commerce/mutations/home_page/${home.id}`);await saveButton().click();assert.equal((await ack).status(),200);assert.equal((await readHome()).hero_image,imageFixture.id);
    await remoteHome({hero_image:baseline.hero_image});await page.reload();await input('hero_title').waitFor();
  });
  await check('child 409 retains staged section edits and can reconcile',async()=>{
    await tab('Секции');const selectedChild=await request(`/items/page_sections/${children[0].id}`);await page.locator('.page-sections-list > button').filter({hasText:selectedChild.title}).click();await input('title').fill(`${marker} · Локальная секция`);await childSave(children[0],{title:`${marker} · Конкурентная секция`});await page.getByRole('button',{name:'Сохранить секцию',exact:true}).click();await page.getByText('Сохранение нужно сверить с текущей версией перед новой попыткой.',{exact:true}).waitFor();assert.equal(await input('title').inputValue(),`${marker} · Локальная секция`);await page.getByRole('button',{name:'Загрузить текущие значения',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-field="title"] input')?.value.endsWith('Конкурентная секция'));
  });
  await check('child dirty state survives tab switches and blocks cancelled route departure',async()=>{
    await input('title').fill(`${marker} · Несохранённая секция`);await tab('Первый экран');await tab('Секции');assert.equal(await input('title').inputValue(),`${marker} · Несохранённая секция`);
    let prompted=false;page.once('dialog',async dialog=>{prompted=true;await dialog.dismiss();});await page.locator('.ac-shell__header .ac-toolbar').getByRole('button',{name:'Назад',exact:true}).click();assert.equal(prompted,true);await page.waitForURL('**/sections/home_page');assert.equal(await input('title').inputValue(),`${marker} · Несохранённая секция`);
    // Explicitly discard via native route reload after verifying the cancelled guard.
    page.once('dialog',dialog=>dialog.accept());await page.reload();await input('hero_title').waitFor();
  });
  await check('controlled update denial renders populated readonly state',async()=>{
    const path=`**/permissions/me/home_page/${home.id}`;await page.route(path,async route=>{const response=await route.fetch();const json=await response.json();json.data.update.access=false;await route.fulfill({response,json});});await page.reload();await input('hero_title').waitFor();assert.equal(await input('hero_title').isEditable(),false);assert.equal(await saveButton().isDisabled(),true);await screenshot('actual-readonly-1536.png');await page.unroute(path);await page.reload();await input('hero_title').waitFor();
  });
  await check('controlled missing singleton blocks editing and offers retry without create',async()=>{
    const pattern='**/items/home_page?*';await page.route(pattern,async route=>{const url=new URL(route.request().url());if(url.searchParams.get('aggregate[count]')==='id')return route.fulfill({contentType:'application/json',body:JSON.stringify({data:{count:{id:'0'}}})});await route.continue();});await page.reload();await page.getByRole('button',{name:'Повторить загрузку',exact:true}).waitFor();assert.equal(await saveButton().isDisabled(),true);await screenshot('actual-empty-1536.png');await page.unroute(pattern);await page.getByRole('button',{name:'Повторить загрузку',exact:true}).click();await input('hero_title').waitFor();
  });
  await check('existing product and category routes remain usable in the same candidate',async()=>{await page.goto(origin+'/admin/product-editor/sections/categories');await page.getByRole('heading',{name:'Категории',exact:true}).first().waitFor();await page.screenshot({path:resolve(out,'actual-categories-regression.png')});await page.goto(origin+'/admin/product-editor');await page.getByRole('heading',{name:'Товары',exact:true}).first().waitFor();await page.goto(origin+'/admin/product-editor/+');await page.getByRole('heading',{name:'Новый товар',exact:true}).first().waitFor();});
  await check('anonymous read and guarded update are denied by actual API',async()=>{await assert.rejects(request('/items/home_page?fields=id',{anonymous:true}),error=>[401,403].includes(error.status));await assert.rejects(request(`/commerce/mutations/home_page/${home.id}`,{method:'POST',anonymous:true,body:{expected:{id:home.id},changes:{}}}),error=>[401,403].includes(error.status));});
  await check('no uncaught native Vue errors or unresolved components',async()=>{assert.deepEqual(fatal,[]);assert.deepEqual(warnings,[]);});
  }
  }
} catch(error) { results.push({name:'probe execution',status:'FAIL',error:error.message});console.log(`FAIL probe execution: ${error.message}`); }
finally {
  await browser?.close();
  for(const entry of owned.filter(row=>row.collection==='page_sections'&&!row.cleaned).reverse()) await check(`exact owned child cleanup ${entry.id}`,async()=>{
    let row;try{row=await request(`/items/page_sections/${entry.id}`);}catch(error){if(!entry.created&&[403,404].includes(error.status)){entry.cleaned=true;await ledger();return;}throw error;}
    assert.equal(row.id,entry.id);assert.equal(row.home_page,home.id);assert.equal(row.page,null);assert.ok(String(row.title).includes(marker));
    await request(`/commerce/mutations/page_sections/${entry.id}`,{method:'POST',body:{expected:{id:row.id,updated_at:row.updated_at,title:row.title,home_page:home.id,page:null},action:'delete'}});
    await assert.rejects(request(`/items/page_sections/${entry.id}`),error=>[403,404].includes(error.status));entry.cleaned=true;await ledger();
  });
  if(baseline&&home&&token) await check('CAS restores exact original singleton content; existing singleton preserved',async()=>{
    const current=await readHome();assert.equal(current.id,baseline.id);assert.equal(current.status,baseline.status);assert.equal(current.source_page,baseline.source_page);
    const changes=Object.fromEntries(writable.filter(field=>!equal(current[field],baseline[field])).map(field=>[field,baseline[field]]));
    for(const field of Object.keys(changes))assert.ok(equal(current[field],lastKnown?.[field]),`Concurrent change prevents restore: ${field}`);
    if(Object.keys(changes).length)await request(`/commerce/mutations/home_page/${home.id}`,{method:'POST',body:{expected:{id:home.id,updated_at:current.updated_at,...Object.fromEntries(Object.keys(changes).map(field=>[field,current[field]]))},changes}});
    const restored=await readHome();for(const field of fields.filter(field=>field!=='updated_at'))assert.ok(equal(restored[field],baseline[field]),`Restore ${field}`);
    lastKnown=restored;await ledger({restored:true});
  });
  restored=Boolean(baseline&&lastKnown&&fields.filter(field=>field!=='updated_at').every(field=>equal(lastKnown[field],baseline[field])));
  for(const entry of owned.filter(row=>row.collection==='directus_files'&&!row.cleaned))await check(`exact owned file cleanup ${entry.id}`,async()=>{
    assert.ok(restored,'Do not remove fixture file before restoring the existing parent');
    let file;try{file=await request(`/files/${entry.id}`);}catch(error){if(!entry.created&&[403,404].includes(error.status)){entry.cleaned=true;await ledger();return;}throw error;}
    assert.equal(file.id,entry.id);assert.equal(file.title,entry.title);await request(`/files/${entry.id}`,{method:'DELETE'});await assert.rejects(request(`/files/${entry.id}`),error=>[403,404].includes(error.status));entry.cleaned=true;await ledger({restored:true});
  });
  await writeFile(resolve(out,'served-hashes.json'),JSON.stringify(servedHashes,null,2));
  await writeFile(resolve(out,'browser-errors.json'),JSON.stringify({fatal,warnings},null,2));
  await writeFile(resolve(out,'requests.json'),JSON.stringify(requests,null,2));
  await writeFile(resolve(out,'results.json'),JSON.stringify({run,target:origin,mode:'browser-only candidate; installed bundle unchanged',results,pass:results.filter(row=>row.status==='PASS').length,fail:results.filter(row=>row.status==='FAIL').length},null,2));
  console.log(`Artifacts: ${out}`);if(results.some(row=>row.status==='FAIL'))process.exitCode=1;
}
