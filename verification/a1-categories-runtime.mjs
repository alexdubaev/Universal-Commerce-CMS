/** Opt-in acceptance against ONLY the approved own loopback Directus.
 * node --env-file=<own-dev-env> verification/a1-categories-runtime.mjs --synthetic-probe
 * Browser-only module substitution avoids modifying the unrelated mounted worktree.
 * Exact IDs are journaled before writes; cleanup never searches by a prefix.
 */
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(root,'storefront/package.json'));
const {chromium}=require('playwright');
const origin='http://127.0.0.1:18056';
assert.equal(process.env.DIRECTUS_URL??origin,origin);
assert.ok(process.argv.includes('--synthetic-probe'));
assert.ok(process.env.ADMIN_EMAIL&&process.env.ADMIN_PASSWORD,'Load the approved own dev credentials privately');
const run=randomUUID(),tag=`a1-${run}`,out=resolve(tmpdir(),'universal-cms-a1',tag);
await mkdir(out,{recursive:true});
const results=[],owned=[],hashes={};let token,browser,page;
const journal=()=>writeFile(resolve(out,'owned-fixtures.json'),JSON.stringify({run,target:origin,owned},null,2));
async function request(path,{method='GET',body,anonymous=false}={}) {
  const r=await fetch(origin+path,{method,headers:{...(!anonymous&&token?{Authorization:`Bearer ${token}`}:{}) ,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(Error(`HTTP ${r.status} ${method} ${path}`),{status:r.status,code:j.errors?.[0]?.extensions?.code??j.errors?.[0]?.code});
  return j.data??j;
}
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});console.log(`PASS ${name}`);}catch(e){results.push({name,status:'FAIL',error:e.message});console.log(`FAIL ${name}: ${e.message}`);if(page)await page.screenshot({path:resolve(out,`failure-${results.length}.png`),fullPage:true}).catch(()=>{});}}
async function create(collection,values){const id=randomUUID();owned.push({collection,id,slug:values.slug,title:values.title,created:false});await journal();const row=await request(`/items/${collection}`,{method:'POST',body:{...values,id}});owned.at(-1).created=true;await journal();return row;}
async function save(collection,id,changes){const current=await request(`/items/${collection}/${id}`);const expected={id,updated_at:current.updated_at,...Object.fromEntries(Object.keys(changes).map(k=>[k,current[k]]))};return request(`/commerce/mutations/${collection}/${id}`,{method:'POST',body:{expected,changes}});}
async function cleanup(entry){
  const path=entry.collection==='directus_files'?`/files/${entry.id}`:`/items/${entry.collection}/${entry.id}`;
  let row;try{row=await request(path);}catch(e){if(e.status===403||e.status===404){assert.equal(entry.created,false,'A created fixture must remain readable until cleanup');entry.cleaned=true;return;}throw e;}
  assert.ok(entry.collection==='directus_files'?row.title===entry.title:row.slug===entry.slug,'Exact fixture ownership must match');
  if(entry.collection==='directus_files')await request(path,{method:'DELETE'});
  else await request(`/commerce/mutations/${entry.collection}/${entry.id}`,{method:'POST',body:{expected:row,action:'delete'}});
  await assert.rejects(request(path),e=>[403,404].includes(e.status));entry.cleaned=true;await journal();
}
try {
  token=(await request('/auth/login',{method:'POST',body:{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD}})).access_token;
  const metadata=await request('/fields/categories'),perms=await request('/permissions/me');
  await check('live schema matches 27 physical documented fields and draft native create permissions',async()=>{
    const spec=JSON.parse(await readFile(resolve(root,'docs/admin-sections/sections/categories/fields.json'),'utf8'));
    for(const [name,f]of Object.entries(spec.fields)){const live=metadata.find(m=>m.field===name);assert.ok(live,name);assert.equal(live.type,f.schema.type);assert.equal(Boolean(live.meta.required),Boolean(f.schema.required));}
    assert.equal(metadata.find(f=>f.field==='status').schema.default_value,'draft');assert.equal(perms.categories.create.access,'full');assert.equal(perms.categories.update.access,'full');
    assert.equal(metadata.find(f=>f.field==='seo').meta.interface,'seo-interface');
  });
  const a=await create('categories',{slug:tag,title:`Synthetic ${tag}`,h1:`Heading ${tag}`,status:'draft',seo:{title:'Original SEO',custom:{keep:'opaque'}}});
  const child=await create('categories',{slug:`${tag}-child`,title:`Child ${tag}`,parent:a.id,status:'draft'});
  for(let i=0;i<24;i++)await create('categories',{slug:`${tag}-${i}`,title:`Pagination ${tag} ${i}`,status:'draft'});
  const product=await create('products',{slug:`${tag}-product`,title:`Product ${tag}`,brand:'Synthetic A1',sku:tag,category:a.id,status:'draft',price_status:'hidden',availability_status:'on_request',currency:'RUB'});
  await check('native create gives draft, nullable initial version, required fields and unique slug',async()=>{
    assert.equal(a.status,'draft');assert.ok(Object.hasOwn(a,'updated_at'));
    await assert.rejects(create('categories',{slug:tag,title:'Duplicate own fixture',status:'draft'}),e=>['RECORD_NOT_UNIQUE','CONFLICT'].includes(e.code)||[400,409].includes(e.status));
    const access=await request(`/permissions/me/categories/${a.id}`);assert.equal(access.update.access,true);
  });
  await check('guarded category update, true 409 and forbidden technical fields; anonymous denied',async()=>{
    const base=await request(`/items/categories/${a.id}`);
    const expected={id:a.id,updated_at:base.updated_at,title:base.title};
    await request(`/commerce/mutations/categories/${a.id}`,{method:'POST',body:{expected,changes:{title:`Remote ${tag}`}}});
    await assert.rejects(request(`/commerce/mutations/categories/${a.id}`,{method:'POST',body:{expected,changes:{title:'stale'}}}),e=>e.status===409);
    await assert.rejects(request(`/commerce/mutations/categories/${a.id}`,{method:'POST',body:{expected:{id:a.id},changes:{id:randomUUID()}}}),e=>e.status===400);
    await assert.rejects(request(`/commerce/mutations/categories/${a.id}`,{method:'POST',body:{expected,changes:{title:'anonymous'}},anonymous:true}),e=>[401,403].includes(e.status));
  });
  await check('server parent-cycle protection is absent: editor must keep parent readonly',async()=>{
    await save('categories',a.id,{parent:child.id});
    assert.equal((await request(`/items/categories/${a.id}`)).parent,child.id);
    await save('categories',a.id,{parent:null});
  });
  const mediaField=(await request('/fields/products')).find(f=>f.field==='main_image');
  const fileId=randomUUID();owned.push({collection:'directus_files',id:fileId,title:tag,created:false});await journal();
  const upload=new FormData();upload.set('id',fileId);upload.set('title',tag);if(mediaField.meta.options?.folder)upload.set('folder',mediaField.meta.options.folder);
  upload.set('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6d3sAAAAASUVORK5CYII=','base64')],{type:'image/png'}),`${tag}.png`);
  const uploaded=await fetch(origin+'/files',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:upload});assert.ok(uploaded.ok);const image=(await uploaded.json()).data;assert.equal(image.id,fileId,'Native file upload must preserve the reserved fixture UUID');owned.at(-1).created=true;await journal();

  const bundle=await(await fetch(origin+'/extensions/sources/index.js')).text();
  const imports={};for(const [key,name]of [['vue','vue'],['vue-router','vue-router'],['@directus/extensions-sdk','@directus_extensions-sdk']]){const match=bundle.match(new RegExp(`['"]([^'"]*${name}\\.[^'"]*entry\\.js)['"]`));assert.ok(match);imports[key]=match[1];}
  browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1536,height:1024}});page=await context.newPage();page.setDefaultTimeout(14000);
  // Replace only this browser's module registration. API/hooks remain the running
  // real instance. No container config, mounted files or other sessions change.
  await context.route('**/extensions/sources/index.js*',async route=>{
    const replaced=bundle.replace(/const modules = \[[^\]]*\];/,'const modules = [a1Candidate];');assert.notEqual(replaced,bundle);
    await route.fulfill({contentType:'application/javascript',body:`import a1Candidate from '/__a1_candidate__/index.js';\n${replaced}`});
  });
  await context.route('**/__a1_candidate__/**',async route=>{
    const name=new URL(route.request().url()).pathname.replace('/__a1_candidate__/','');assert.ok(['index.js','editor-state.mjs','admin-shell.js','admin-state.mjs','page-sections.js','sections/categories.js'].includes(name));
    const source=await readFile(resolve(root,'directus/extensions/deere-shop-product-editor/dist',name),'utf8');hashes[name]=createHash('sha256').update(source).digest('hex');let text=source;
    for(const [key,path]of Object.entries(imports))text=text.replaceAll(`from "${key}"`,`from "${path}"`);
    await route.fulfill({contentType:'application/javascript',body:text});
  });
  const fatal=[],warnings=[],requests=[];page.on('pageerror',e=>fatal.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type())&&/Failed to resolve component|Invalid prop|Unhandled error/i.test(m.text()))warnings.push(m.text());});
  page.on('request',r=>{if(r.url().includes('/items/categories')||r.url().includes('/commerce/mutations/categories'))requests.push({method:r.method(),url:r.url(),body:r.postDataJSON()});});
  // Reserve the test fixture ID before the UI native create reaches the server.
  // Only this test's own create is augmented; the editor's production payload
  // has no technical fields. This allows cleanup even after a lost response.
  await page.route('**/items/categories',async route=>{
    if(route.request().method()!=='POST')return route.continue();
    const body=route.request().postDataJSON();assert.ok([`${tag}-ui`,`${tag}-uncertain-ui`].includes(body.slug));const id=randomUUID();owned.push({collection:'categories',id,slug:body.slug,created:false});await journal();
    if(body.slug===`${tag}-uncertain-ui`){const response=await route.fetch({postData:JSON.stringify({...body,id})});assert.equal(response.status(),200);owned.find(e=>e.id===id).created=true;await journal();await route.abort('failed');}
    else await route.continue({postData:JSON.stringify({...body,id})});
  });
  page.on('response',async r=>{if(r.url().endsWith('/items/categories')&&r.request().method()==='POST'&&r.ok()){const row=(await r.json()).data;const entry=owned.find(e=>e.id===row?.id);if(entry){entry.created=true;await journal();}}});
  await page.addLocatorHandler(page.getByText('Have a license key?',{exact:true}),async()=>{await page.getByRole('button',{name:'Пропустить',exact:true}).click();});
  await page.addLocatorHandler(page.getByRole('button',{name:'Remind Later',exact:true}),async()=>{await page.getByRole('button',{name:'Remind Later',exact:true}).click();});
  await page.goto(origin+'/admin/login');await page.locator('input[type=email]').fill(process.env.ADMIN_EMAIL);await page.locator('input[type=password]').fill(process.env.ADMIN_PASSWORD);await page.locator('button[type=submit]').click();await page.waitForURL(u=>!u.pathname.endsWith('/login'),{timeout:30000});
  const go=path=>page.goto(origin+'/admin/product-editor'+path);
  const title=()=>page.locator('[data-field="title"] input').first();
  const saveButton=()=>page.locator('.ac-toolbar').getByRole('button',{name:'Сохранить',exact:true});

  await check('list entry, bounded search/status/sort/pagination and existing card navigation',async()=>{
    await save('categories',a.id,{title:`A1 ${tag} Длинное название родительской категории для проверки двух строк и доступности полного значения`});
    await save('categories',child.id,{title:`B1 ${tag} Длинное название дочерней категории для проверки мобильного списка`});
    await go('');await page.getByRole('button',{name:'Категории',exact:true}).click();await page.locator('.ac-shell').getByRole('heading',{name:'Категории',exact:true}).waitFor();
    assert.equal(await page.getByText('Режим просмотра.',{exact:true}).count(),0);assert.equal(await page.getByText('Все изменения сохранены.',{exact:true}).count(),0);
    await page.getByRole('searchbox',{name:'Поиск категорий',exact:true}).fill(tag);await page.waitForFunction(()=>document.querySelectorAll('.ac-list tbody tr').length===25);
    await page.getByRole('button',{name:'Следующая страница',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.ac-list tbody tr').length===1);
    await page.getByRole('combobox',{name:'Статус',exact:true}).selectOption('draft');await page.waitForFunction(()=>document.querySelectorAll('.ac-list tbody tr').length===25);
    await page.getByRole('combobox',{name:'Сортировка',exact:true}).selectOption('title');
    assert.equal(await page.getByRole('combobox',{name:'Сортировка',exact:true}).locator('option').count(),14);
    assert.ok(requests.filter(r=>r.method==='GET').every(r=>new URL(r.url).searchParams.get('limit')==='25'));
    const link=page.locator('tbody .a1cat-name').filter({hasText:'A1 '+tag});
    const [popup]=await Promise.all([context.waitForEvent('page'),link.click({modifiers:['Control']})]);await popup.waitForURL(u=>u.pathname.endsWith(a.id));await popup.locator('[data-field="title"] input').first().waitFor();assert.ok(page.url().endsWith('/sections/categories'));await popup.close();
    await link.click();await page.waitForURL(u=>u.pathname.endsWith(a.id));await title().waitFor();
    await go('/sections/categories');await page.getByRole('searchbox',{name:'Поиск категорий',exact:true}).fill(tag);await page.waitForFunction(()=>document.querySelectorAll('.ac-list tbody tr').length===25);await page.getByRole('combobox',{name:'Сортировка',exact:true}).selectOption('title');
  });
  await check('filter drafts, bounded parent UUID selection, apply, chips, reset and keyboard modal behavior',async()=>{
    const open=()=>page.getByRole('button',{name:/^Фильтры/}).click();const dlg=page.getByRole('dialog',{name:'Фильтры категорий'});
    const mainRequests=()=>requests.filter(r=>r.method==='GET'&&new URL(r.url).searchParams.get('fields')?.includes('slug')).length;
    await open();await dlg.getByRole('combobox',{name:'На главной странице',exact:true}).selectOption('true');const count=mainRequests();await page.keyboard.press('Escape');await dlg.waitFor({state:'hidden'});assert.equal(mainRequests(),count);assert.equal(await page.getByRole('button',{name:/^Фильтры/}).evaluate(el=>el===document.activeElement),true);
    await open();assert.equal(await dlg.getByRole('combobox',{name:'На главной странице',exact:true}).inputValue(),'');
    await dlg.getByRole('button',{name:'Закрыть фильтры',exact:true}).focus();await page.keyboard.press('Shift+Tab');assert.equal(await dlg.getByRole('button',{name:'Применить',exact:true}).evaluate(el=>el===document.activeElement),true);
    for(let i=0;i<14;i++){await page.keyboard.press('Tab');assert.ok(await dlg.evaluate(el=>el.contains(document.activeElement)));}
    await dlg.getByRole('button',{name:/^Родительская категория/}).click();await dlg.getByRole('searchbox',{name:'Найти родительскую категорию',exact:true}).fill(tag);await page.waitForFunction(()=>document.querySelectorAll('.a1cat-parent-option').length===27);
    await dlg.getByRole('button',{name:'Показать ещё',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.a1cat-parent-option').length===3);
    await dlg.getByRole('button',{name:'Назад',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.a1cat-parent-option').length===27);
    await page.screenshot({path:resolve(out,'ui-filters-parent-options-1536.png')});
    await dlg.getByRole('button',{name:new RegExp('^A1 '+tag)}).click();await dlg.getByRole('combobox',{name:'На главной странице',exact:true}).selectOption('false');await dlg.getByRole('combobox',{name:'Индексация',exact:true}).selectOption('true');await dlg.getByRole('button',{name:'Применить',exact:true}).click();await dlg.waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelectorAll('.ac-list tbody tr').length===1);
    assert.equal(await page.locator('.a1cat-chip').count(),3);assert.equal(await page.getByRole('button',{name:/^Фильтры/}).evaluate(el=>el===document.activeElement),true);
    const filtered=requests.filter(r=>r.method==='GET'&&new URL(r.url).searchParams.get('fields')?.includes('slug')).at(-1);assert.ok(JSON.stringify(filtered.url).includes(a.id));
    await page.getByRole('button',{name:/Убрать фильтр Родитель:/}).click();await page.waitForFunction(()=>document.querySelectorAll('.ac-list tbody tr').length===25);assert.equal(await page.locator('.a1cat-chip').count(),2);
    await page.getByRole('button',{name:'Сбросить фильтры',exact:true}).click();assert.equal(await page.getByRole('searchbox',{name:'Поиск категорий',exact:true}).inputValue(),'');assert.equal(await page.locator('.a1cat-chip').count(),0);
    await page.getByRole('searchbox',{name:'Поиск категорий',exact:true}).fill(tag);await page.waitForFunction(()=>document.querySelectorAll('.ac-list tbody tr').length===25);
  });
  await check('late parent-search response never replaces the current query',async()=>{
    let release,entered;const held=new Promise(r=>release=r),started=new Promise(r=>entered=r);
    const pattern='**/items/categories?**';await page.route(pattern,async route=>{const q=new URL(route.request().url()).searchParams;const f=decodeURIComponent(route.request().url());if(q.get('fields')==='id,title'&&f.includes('late-'+tag)){entered();await held;}await route.continue();});
    await page.getByRole('button',{name:/^Фильтры/}).click();const dlg=page.getByRole('dialog',{name:'Фильтры категорий'});await dlg.getByRole('button',{name:/^Родительская категория/}).click();
    const input=dlg.getByRole('searchbox',{name:'Найти родительскую категорию',exact:true});await input.fill('late-'+tag);await started;await input.fill(tag);await page.waitForFunction(()=>document.querySelectorAll('.a1cat-parent-option').length===27);const late=page.waitForResponse(r=>r.url().includes('late-')&&r.url().includes('items/categories'));release();await late;assert.equal(await page.locator('.a1cat-parent-option').count(),27);await page.keyboard.press('Escape');await dlg.waitFor({state:'hidden'});await page.unroute(pattern);
  });
  await check('actual Directus screenshots match reference layout at desktop/mobile and both right-panel states',async()=>{
    const close=page.locator('button').filter({has:page.locator('[data-icon="right_panel_close"]')});if(await close.count())await close.click();await page.setViewportSize({width:1536,height:1024});await page.waitForFunction(()=>document.querySelector('.ac-shell')?.getBoundingClientRect().width>1100);
    await page.getByRole('combobox',{name:'Сортировка',exact:true}).selectOption('title');await page.locator('.ac-list tbody tr').first().waitFor();
    const toast=page.getByText("We'll remind you again on your next login.",{exact:true});await toast.waitFor({state:'hidden',timeout:15000});
    const metrics=await page.evaluate(()=>({firstRowY:document.querySelector('.ac-list tbody tr').getBoundingClientRect().y,heights:[...document.querySelectorAll('.a1cat-controls>.a1cat-search,.a1cat-controls>.a1cat-control,.a1cat-controls>.a1cat-btn')].map(e=>e.getBoundingClientRect().height),rows:[...document.querySelectorAll('.ac-list tbody tr')].slice(0,5).map(e=>e.getBoundingClientRect().height),contentWidth:document.querySelector('.ac-shell__main').getBoundingClientRect().width}));
    assert.ok(metrics.firstRowY<=250,JSON.stringify(metrics));assert.ok(metrics.heights.every(h=>h===40),JSON.stringify(metrics));assert.ok(metrics.rows.every(h=>h<100),JSON.stringify(metrics));
    await writeFile(resolve(out,'ui-metrics.json'),JSON.stringify(metrics,null,2));await page.screenshot({path:resolve(out,'ui-after-desktop.png')});
    await page.locator('button').filter({has:page.locator('[data-icon="right_panel_open"]')}).click();await page.waitForFunction(()=>document.querySelector('.ac-shell')?.getBoundingClientRect().width<1100);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:resolve(out,'ui-after-desktop-open-panel.png')});
    await page.locator('button').filter({has:page.locator('[data-icon="right_panel_close"]')}).click();await page.waitForFunction(()=>document.querySelector('.ac-shell')?.getBoundingClientRect().width>1100);
    await page.getByRole('button',{name:/^Фильтры/}).click();await page.screenshot({path:resolve(out,'ui-after-filters-desktop.png')});await page.keyboard.press('Escape');await page.locator('.a1cat-dialog').waitFor({state:'hidden'});
    await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await page.locator('.a1cat-search').first().evaluate(el=>el.getBoundingClientRect().height),44);assert.equal(await page.getByRole('combobox',{name:'Статус',exact:true}).evaluate(el=>el.getBoundingClientRect().height),44);
    assert.equal(await page.locator('tbody tr').first().locator('td:nth-child(4)').isVisible(),false);await page.screenshot({path:resolve(out,'ui-after-mobile.png')});
    await page.locator('tbody .a1cat-parent .a1cat-full').first().focus();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.getByRole('button',{name:/^Фильтры/}).click();await page.screenshot({path:resolve(out,'ui-after-filters-mobile.png')});await page.keyboard.press('Escape');await page.locator('.a1cat-dialog').waitFor({state:'hidden'});await page.setViewportSize({width:1536,height:1024});
  });
  await check('real empty/loading/anonymous read error and exact create-permission message',async()=>{
    await page.getByRole('searchbox',{name:'Поиск категорий',exact:true}).fill('no-match-'+tag);await page.getByRole('heading',{name:'Категории не найдены',exact:true}).waitFor();await page.screenshot({path:resolve(out,'ui-empty.png')});await page.getByRole('button',{name:'Сбросить фильтры',exact:true}).click();await page.locator('.ac-list tbody tr').first().waitFor();
    let release;const gate=new Promise(r=>release=r);await page.route('**/items/categories?**',async route=>{await gate;await route.continue();});await go('/sections/categories');await page.getByText('Загрузка категорий…',{exact:true}).waitFor();await page.screenshot({path:resolve(out,'ui-loading.png')});release();await page.locator('.ac-list tbody tr').first().waitFor();await page.unroute('**/items/categories?**');
    await page.route('**/items/categories?**',async route=>{const r=await fetch(route.request().url());assert.equal(r.status,403);await route.fulfill({status:r.status,contentType:'application/json',body:await r.text()});});await page.reload();await page.getByRole('heading',{name:'Не удалось загрузить категории',exact:true}).waitFor();await page.getByText('Недостаточно прав. Запрос отклонён Directus.',{exact:true}).waitFor();await page.screenshot({path:resolve(out,'ui-real-anonymous-denial.png')});await page.unroute('**/items/categories?**');await page.getByRole('button',{name:'Повторить',exact:true}).click();await page.locator('.ac-list tbody tr').first().waitFor();
    await page.route('**/permissions/me',async route=>{const r=await route.fetch(),j=await r.json();j.data.categories.create={access:'none',fields:[]};await route.fulfill({response:r,json:j});});await page.reload();await page.getByText('Создание категорий недоступно по текущим правам.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Создать категорию',exact:true}).count(),0);assert.equal(await page.getByText('Режим просмотра.',{exact:true}).count(),0);await page.screenshot({path:resolve(out,'ui-create-denied.png')});await page.unroute('**/permissions/me');
  });
  await check('all tabs retain input; required/choices/slug validation; parent readonly and no delete',async()=>{
    await go(`/sections/categories/${a.id}`);await title().waitFor();await title().fill(`Browser ${tag}`);
    await page.getByRole('tab',{name:'Содержание',exact:true}).click();await page.locator('[data-field="h1"] input').fill(`Browser heading ${tag}`);
    await page.getByRole('tab',{name:'SEO',exact:true}).click();await page.locator('[data-field="seo"]').waitFor();
    await page.getByRole('tab',{name:'Дополнительно',exact:true}).click();await page.getByText('Идентификатор',{exact:true}).waitFor();
    await page.getByRole('tab',{name:'Основное',exact:true}).click();assert.equal(await title().inputValue(),`Browser ${tag}`);
    const before=requests.filter(r=>r.method==='POST').length;await page.locator('[data-field="slug"] input').fill('bad slug');await saveButton().click();await page.getByText(/используйте строчные латинские/).first().waitFor();assert.equal(requests.filter(r=>r.method==='POST').length,before);
    await page.locator('[data-field="slug"] input').fill(tag);await title().fill('');await saveButton().click();await page.getByText(/обязательное поле/).first().waitFor();await title().fill(`Browser ${tag}`);
    await page.locator('[data-field="status"] input').fill('invalid-choice');await saveButton().click();await page.getByText(/выберите допустимое значение/).first().waitFor();await page.locator('[data-field="status"] input').fill('draft');
    assert.equal(await page.locator('.ac-shell').getByRole('button',{name:/Удалить/}).count(),0);
    const parent=page.locator('[data-field="parent"]');assert.equal(await parent.locator('input:not([disabled]):not([readonly])').count(),0);
    page.once('dialog',d=>d.dismiss());await page.locator('.ac-toolbar').getByRole('button',{name:'Назад',exact:true}).click();assert.ok(page.url().endsWith(a.id));
    const response=page.waitForResponse(r=>r.url().endsWith(`/commerce/mutations/categories/${a.id}`)&&r.request().method()==='POST');await saveButton().click();assert.equal((await response).status(),200);await page.getByText('Изменения сохранены.',{exact:true}).first().waitFor();
    const stored=await request(`/items/categories/${a.id}`);assert.equal(stored.title,`Browser ${tag}`);assert.equal(stored.h1,`Browser heading ${tag}`);assert.deepEqual(stored.seo.custom,{keep:'opaque'});
  });
  await check('real browser CAS 409 retains input and comparison never auto-writes',async()=>{
    await title().fill(`Conflict local ${tag}`);await save('categories',a.id,{title:`Conflict remote ${tag}`});
    const response=page.waitForResponse(r=>r.url().endsWith(`/commerce/mutations/categories/${a.id}`)&&r.request().method()==='POST');await saveButton().click();assert.equal((await response).status(),409);assert.equal(await title().inputValue(),`Conflict local ${tag}`);
    await page.getByRole('button',{name:'Сохранить мои изменения',exact:true}).click();await page.getByRole('heading',{name:'Сравнение перед повторным сохранением',exact:true}).waitFor();const count=requests.filter(r=>r.method==='POST').length;
    await page.getByRole('button',{name:'Применить актуальную версию и оставить мой ввод',exact:true}).click();assert.equal(await title().inputValue(),`Conflict local ${tag}`);assert.equal(requests.filter(r=>r.method==='POST').length,count);
    await saveButton().click();await page.getByText('Изменения сохранены.',{exact:true}).first().waitFor();
  });
  await check('native MediaPicker selects own PNG and detach keeps file',async()=>{
    const field=page.locator('[data-field="image"]');
    await writeFile(resolve(out,'media-buttons.json'),JSON.stringify(await field.locator('.v-upload button').evaluateAll(buttons=>buttons.map(b=>({label:b.getAttribute('aria-label'),icon:b.querySelector('[data-icon]')?.getAttribute('data-icon'),text:b.textContent}))),null,2));
    await field.locator('.v-upload button').filter({has:page.locator('[data-icon="folder_open"]')}).click();await page.locator('#dialog-outlet').getByText('Все файлы',{exact:true}).click();const own=page.locator('#dialog-outlet').getByText(tag,{exact:true});await own.waitFor();await own.click();await page.screenshot({path:resolve(out,'categories-native-files.png'),fullPage:true});
    await page.locator('#dialog-outlet').getByRole('button',{name:'Сохранить',exact:true}).click();await saveButton().click();await page.getByText('Изменения сохранены.',{exact:true}).first().waitFor();assert.equal((await request(`/items/categories/${a.id}`)).image,image.id);
    await page.route(`**/files/${image.id}?fields=id`,r=>r.fulfill({status:403,json:{errors:[{message:'Synthetic missing/denied asset'}]}}));await page.reload();await page.getByText('Связанный файл отсутствует или недоступен. Связь сохранена до вашего явного изменения.',{exact:true}).waitFor();assert.equal((await request(`/items/categories/${a.id}`)).image,image.id);await page.unroute(`**/files/${image.id}?fields=id`);await page.reload();await title().waitFor();
    await field.locator('button').filter({has:page.locator('[data-icon="close"]')}).click();await saveButton().click();await page.getByText('Изменения сохранены.',{exact:true}).first().waitFor();assert.equal((await request(`/items/categories/${a.id}`)).image,null);assert.equal((await request(`/files/${image.id}`)).id,image.id);
  });
  await check('browser duplicate slug rejection and lost save response retain edits without automatic retry',async()=>{
    const slug=page.locator('[data-field="slug"] input');await slug.fill(child.slug);
    const conflict=page.waitForResponse(r=>r.url().endsWith(`/commerce/mutations/categories/${a.id}`)&&r.request().method()==='POST');await saveButton().click();const rejected=await conflict;assert.equal(rejected.status(),400);assert.equal((await rejected.json()).errors[0].code,'RECORD_NOT_UNIQUE');assert.equal(await slug.inputValue(),child.slug);
    await page.getByRole('button',{name:'Сравнить с актуальными данными',exact:true}).click();await page.getByRole('button',{name:'Применить актуальную версию и оставить мой ввод',exact:true}).click();await slug.fill(tag);
    await title().fill(`Offline local ${tag}`);await page.route(`**/commerce/mutations/categories/${a.id}`,r=>r.abort('failed'));await saveButton().click();await page.getByRole('button',{name:'Сравнить с актуальными данными',exact:true}).waitFor();assert.equal(await title().inputValue(),`Offline local ${tag}`);assert.equal(await saveButton().isEnabled(),false);await page.unroute(`**/commerce/mutations/categories/${a.id}`);
    await page.getByRole('button',{name:'Сравнить с актуальными данными',exact:true}).click();await page.getByRole('button',{name:'Применить актуальную версию и оставить мой ввод',exact:true}).click();await saveButton().click();await page.getByText('Изменения сохранены.',{exact:true}).first().waitFor();
  });
  await check('native create route creates own draft and navigates to editing',async()=>{
    await go('/sections/categories/+');await title().waitFor();await title().fill(`UI ${tag}`);await page.locator('[data-field="slug"] input').fill(`${tag}-ui`);await saveButton().click();await page.waitForURL(u=>/\/sections\/categories\/[0-9a-f-]{36}$/.test(u.pathname));const id=page.url().split('/').pop();assert.equal((await request(`/items/categories/${id}`)).status,'draft');
  });
  await check('committed native create with lost response has bounded recovery and no duplicate POST',async()=>{
    await go('/sections/categories/+');await title().waitFor();await title().fill(`Uncertain UI ${tag}`);await page.locator('[data-field="slug"] input').fill(`${tag}-uncertain-ui`);await saveButton().click();await page.getByRole('button',{name:'Проверить результат создания',exact:true}).waitFor();assert.equal(await title().inputValue(),`Uncertain UI ${tag}`);assert.equal(await saveButton().isEnabled(),false);const count=requests.filter(r=>r.method==='POST'&&r.url.endsWith('/items/categories')).length;
    await page.getByRole('button',{name:'Проверить результат создания',exact:true}).click();await page.getByRole('button',{name:'Открыть найденную категорию',exact:true}).waitFor();assert.equal(requests.filter(r=>r.method==='POST'&&r.url.endsWith('/items/categories')).length,count);assert.equal(await page.getByText('Изменения сохранены.',{exact:true}).count(),0);
    page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Открыть найденную категорию',exact:true}).click();await page.waitForURL(u=>/\/sections\/categories\/[0-9a-f-]{36}$/.test(u.pathname));assert.equal((await request(`/items/categories/${page.url().split('/').pop()}`)).status,'draft');
  });
  await check('network loss read error and retry; readonly and denied UI contracts',async()=>{
    await page.route(`**/items/categories/${a.id}?**`,r=>r.abort('failed'));await go(`/sections/categories/${a.id}`);await page.getByText('Не удалось загрузить данные.',{exact:true}).first().waitFor();await page.unroute(`**/items/categories/${a.id}?**`);await page.getByRole('button',{name:'Повторить',exact:true}).click();await title().waitFor();
    await page.route(`**/permissions/me/categories/${a.id}`,r=>r.fulfill({json:{data:{update:{access:false}}}}));await page.reload();await title().waitFor();assert.ok(await title().isDisabled()||await title().getAttribute('readonly')!==null);assert.equal(await saveButton().isEnabled(),false);await page.unroute(`**/permissions/me/categories/${a.id}`);
    await page.route(`**/items/categories/${a.id}?**`,r=>r.fulfill({status:403,json:{errors:[{message:'denied'}]}}));await page.reload();await page.getByText('Недостаточно прав. Запрос отклонён Directus.',{exact:true}).waitFor();await page.unroute(`**/items/categories/${a.id}?**`);await page.reload();await title().waitFor();
  });
  for(const viewport of [{width:1536,height:1024},{width:390,height:844}])await check(`categories desktop/mobile ${viewport.width}x${viewport.height} no horizontal overflow`,async()=>{
    await page.setViewportSize(viewport);await page.screenshot({path:resolve(out,`categories-editor-${viewport.width}.png`),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await go('/sections/categories');await page.locator('.ac-list tbody tr').first().waitFor();await page.screenshot({path:resolve(out,`categories-list-${viewport.width}.png`),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await go(`/sections/categories/${a.id}`);await title().waitFor();
  });
  await check('product list/create/edit and unavailable other section routes retain behavior',async()=>{
    await page.setViewportSize({width:1536,height:1024});await go('');await page.getByRole('heading',{name:'Товары',exact:true}).waitFor();await go('/+');await title().waitFor();await go(`/${product.id}`);await title().waitFor();assert.equal(await title().inputValue(),`Product ${tag}`);await go('/sections/pages');await page.getByRole('heading',{name:'Раздел недоступен',exact:true}).first().waitFor();
  });
  await check('no native PATCH/delete category requests; all updates use guarded endpoint',async()=>{assert.equal(requests.some(r=>['PATCH','DELETE'].includes(r.method)),false);for(const r of requests.filter(r=>r.method==='POST'&&r.url.includes('/commerce/'))){assert.deepEqual(Object.keys(r.body).sort(),['changes','expected']);assert.equal(Object.keys(r.body.changes).some(f=>['id','parent','created_at','updated_at'].includes(f)),false);}});
  await check('no uncaught Vue exceptions or unresolved native components',async()=>{assert.deepEqual(fatal,[]);assert.deepEqual(warnings,[]);});
} finally {
  if(browser)await browser.close();
  // Remove only recorded IDs: products, then child categories, roots, then files.
  const sorted=[...owned].sort((a,b)=>(a.collection==='products'?0:a.collection==='directus_files'?3:a.slug?.endsWith('-child')?1:2)-(b.collection==='products'?0:b.collection==='directus_files'?3:b.slug?.endsWith('-child')?1:2));
  for(const entry of sorted)await check(`cleanup exact owned ${entry.collection} ${entry.id}`,()=>cleanup(entry));
  await journal();await writeFile(resolve(out,'results.json'),JSON.stringify({target:origin,run,results,hashes,limitations:['Browser session serves exact candidate dist with runtime import rewrites; running container remains unchanged.','Authenticated runtime uses existing Administrator. Readonly/field denial is a controlled HTTP UI scenario; real anonymous denial is tested.','Parent cycles are accepted by the current server; parent is locked in this editor.']},null,2));
  console.log(`Artifacts: ${out}`);if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
}
