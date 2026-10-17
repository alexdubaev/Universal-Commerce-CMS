/** Opt-in own-instance A0 smoke. Never part of the routine local gate.
 * Run from the repository root, loading its approved dev env privately:
 * node --env-file=dev/.env directus/extensions/deere-shop-product-editor/verification/a0-runtime.mjs --synthetic-probe
 * Requires ADMIN_EMAIL/ADMIN_PASSWORD and installed storefront Playwright/Chromium.
 * Uses only http://127.0.0.1:18056; creates/deletes exact synthetic draft fixtures.
 * Harness mounts exported components in the real authenticated Directus Vue app
 * context. It is isolated verification, not an active specialized editor.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { createEditorState } from '../src/admin-state.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const extension = resolve(root, 'directus/extensions/deere-shop-product-editor');
const require = createRequire(resolve(root, 'storefront/package.json'));
const { chromium } = require('playwright');
const origin = 'http://127.0.0.1:18056';
assert.equal(process.env.DIRECTUS_URL ?? origin, origin, 'Only the approved isolated loopback instance is allowed');
assert.ok(process.argv.includes('--synthetic-probe'), 'Explicit --synthetic-probe is required before own development content writes');
assert.ok(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD, 'Load own development credentials privately');
const run = randomUUID();
const tag = `a0-${run}`;
const out = resolve(tmpdir(), 'universal-cms-a0', tag);
await mkdir(out, { recursive: true });
const results = [], owned = [];
let token, browser;
async function request(path, { method = 'GET', body, anonymous = false } = {}) {
  const response = await fetch(`${origin}${path}`, { method, headers: { ...(token && !anonymous ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status} ${method} ${path}: ${json.errors?.[0]?.extensions?.code ?? json.errors?.[0]?.code ?? 'error'}`), { status: response.status });
  return json.data ?? json;
}
async function check(name, fn) { try { await fn(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); } catch (error) { results.push({ name, status: 'FAIL', error: error.message }); console.log(`FAIL ${name}: ${error.message}`); } }
async function create(collection, data) { const row = await request(`/items/${collection}`, { method: 'POST', body: data }); owned.push({ collection, id: row.id, tagField: collection === 'page_sections' ? 'title' : 'slug', tagValue: collection === 'page_sections' ? data.title : data.slug }); await writeFile(resolve(out, 'owned-fixtures.json'), JSON.stringify({ run, target: origin, owned }, null, 2)); return row; }
const load = (collection) => (id, fields) => request(`/items/${collection}/${id}?fields=${encodeURIComponent(fields.join(','))}`);
const save = (collection, id, body) => request(`/commerce/mutations/${collection}/${id}`, { method: 'POST', body });

try {
  token = (await request('/auth/login', { method: 'POST', body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } })).access_token;
  const server = await request('/server/info');
  console.log(`Target: ${origin}; own draft fixtures; runtime ${server.directus?.version ?? 'version checked by host deployment'}`);
  const product = await create('products', { id: randomUUID(), slug: tag, title: `Synthetic ${tag}`, sku: tag, brand: 'Synthetic A0', currency: 'RUB', price_status: 'hidden', availability_status: 'on_request', status: 'draft' });
  const pageRecord = await create('pages', { id: randomUUID(), slug: `${tag}-page`, title: `Synthetic ${tag}`, h1: 'Synthetic A0', page_type: 'standard', status: 'draft' });
  const child = await create('page_sections', { id: randomUUID(), page: pageRecord.id, title: `Synthetic ${tag}-child`, section_type: 'text', text: 'Synthetic A0 section', status: 'draft', is_visible: false, sort_order: 1 });
  const otherPage = await create('pages', { id: randomUUID(), slug: `${tag}-other-page`, title: `Synthetic alternate ${tag}`, h1: 'Synthetic A0', page_type: 'standard', status: 'draft' });

  await check('src/dist exact artifact parity', async () => { for (const name of ['index.js','editor-state.mjs','admin-shell.js','admin-state.mjs','page-sections.js']) assert.ok((await readFile(resolve(extension,'src',name))).equals(await readFile(resolve(extension,'dist',name))),name); });
  await check('real guarded CAS conflict retains A0 local edits; reconciliation saves', async () => {
    const state = createEditorState({ collection: 'products', editableFields: ['title','brand'], permissions: { read: true, update: true }, guardedContract: true });
    assert.equal((await state.load(load('products'), product.id)).ok, true);
    const old = state.baseline; assert.equal(state.change('title', `Local ${tag}`), true);
    await save('products', product.id, { expected: { id: old.id, updated_at: old.updated_at, title: old.title }, changes: { title: `Remote ${tag}` } });
    const conflict = await state.save(save); assert.equal(conflict.ok, false); assert.equal(state.conflict,true); assert.equal(state.values.title,`Local ${tag}`); assert.equal(state.baseline.title,old.title);
    assert.equal((await state.reconcile(load('products'), product.id, { keepEdits: true })).ok,true);
    assert.equal(state.values.title,`Local ${tag}`); assert.equal((await state.save(save)).ok,true);
    assert.equal((await load('products')(product.id,['id','title'])).title,`Local ${tag}`);
  });
  await check('real concurrent writes admit one winner and one HTTP 409', async () => {
    const base = await load('products')(product.id,['id','updated_at','brand']);
    const writes = await Promise.allSettled(['A','B'].map(v=>save('products',product.id,{expected:base,changes:{brand:`Synthetic A0 ${v}`}})));
    assert.equal(writes.filter(v=>v.status==='fulfilled').length,1); assert.equal(writes.find(v=>v.status==='rejected')?.reason.status,409);
  });
  await check('late real HTTP read cannot overwrite a newer record identity', async () => {
    const state = createEditorState({ collection:'products', editableFields:['title'],permissions:{read:true,update:true},guardedContract:true });
    let release; const hold = new Promise(r=>release=r);
    const slow=state.load(async(id,fields)=>{const row=await load('products')(id,fields);await hold;return row;},product.id);
    assert.equal((await state.load(load('pages'),pageRecord.id)).ok,true); release(); assert.equal((await slow).stale,true);assert.equal(state.identity,pageRecord.id);
  });
  await check('anonymous guarded write and direct draft mutation are forbidden', async () => {
    for(const [path,method,body] of [[`/commerce/mutations/products/${product.id}`,'POST',{expected:{id:product.id},changes:{title:'forbidden'}}],[`/items/products/${product.id}`,'PATCH',{title:'forbidden'}]]) {
      await assert.rejects(request(path,{method,body,anonymous:true}), e=>[401,403].includes(e.status));
    }
  });
  await check('guarded system-field mutation is forbidden even to admin', async()=>{
    await assert.rejects(save('products',product.id,{expected:{id:product.id},changes:{id:randomUUID()}}),e=>e.status===400);
  });
  const mediaMetadata=(await request('/fields/products')).find(f=>f.field==='main_image');
  const upload=new FormData();upload.set('title',tag);if(mediaMetadata?.meta?.options?.folder)upload.set('folder',mediaMetadata.meta.options.folder);upload.set('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6d3sAAAAASUVORK5CYII=','base64')],{type:'image/png'}),`${tag}.png`);
  const uploaded=await fetch(`${origin}/files`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:upload});assert.ok(uploaded.ok,'Own synthetic image upload');const image=(await uploaded.json()).data;owned.push({collection:'directus_files',id:image.id,tagField:'title',tagValue:tag});await writeFile(resolve(out,'owned-fixtures.json'),JSON.stringify({run,target:origin,owned},null,2));
  browser = await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1536,height:1024}}); const page=await context.newPage();page.setDefaultTimeout(12000);
  await page.addLocatorHandler(page.getByText('Have a license key?',{exact:true}),async()=>{await page.getByRole('button',{name:'Пропустить',exact:true}).click();});
  await page.addLocatorHandler(page.getByRole('button',{name:'Remind Later',exact:true}),async()=>{await page.getByRole('button',{name:'Remind Later',exact:true}).click();});
  const dismissLicense=async()=>{const skip=page.locator('#dialog-outlet').getByRole('button',{name:'Пропустить',exact:true});try{await skip.waitFor({state:'visible',timeout:1500});}catch{return;}await skip.click();};
  const fatal=[],warnings=[]; page.on('pageerror',e=>fatal.push(e.message));page.on('console',m=>{if(m.type()==='warning'&&/Failed to resolve component|Invalid prop|Unhandled error/i.test(m.text()))warnings.push(m.text());});
  await page.goto(`${origin}/admin/login`); await page.locator('input[type=email]').fill(process.env.ADMIN_EMAIL);await page.locator('input[type=password]').fill(process.env.ADMIN_PASSWORD);await page.locator('button[type=submit]').click();await page.waitForURL(u=>!u.pathname.endsWith('/login'),{timeout:30000});
  await check('real Directus product list and create routes remain available',async()=>{
    await page.goto(`${origin}/admin/product-editor`);await page.getByRole('heading',{name:'Товары',exact:true}).waitFor();await dismissLicense();
    await page.goto(`${origin}/admin/product-editor/+`);await page.getByRole('heading',{name:'Новый товар',exact:true}).waitFor();await page.locator('[data-field="title"] input').waitFor();
  });
  await check('actual native product create saves an owned draft and changes to its edit route',async()=>{
    await dismissLicense();for(const [field,value]of Object.entries({title:`Synthetic UI ${tag}`,brand:'Synthetic A0',sku:`${tag}-ui`,slug:`${tag}-ui`}))await page.locator(`[data-field="${field}"] input`).fill(value);
    const response=page.waitForResponse(r=>r.url().endsWith('/items/products')&&r.request().method()==='POST');await page.getByRole('button',{name:'Сохранить черновик',exact:true}).click();const created=await response;assert.equal(created.status(),200);const row=(await created.json()).data;assert.ok(row?.id,'UI create acknowledgement has an identity');
    owned.push({collection:'products',id:row.id,tagField:'slug',tagValue:`${tag}-ui`});await writeFile(resolve(out,'owned-fixtures.json'),JSON.stringify({run,target:origin,owned},null,2));await page.waitForURL(u=>u.pathname===`/admin/product-editor/${row.id}`);const stored=await request(`/items/products/${row.id}?fields=id,slug,title,status`);assert.equal(stored.status,'draft');assert.equal(stored.slug,`${tag}-ui`);assert.equal(stored.title,`Synthetic UI ${tag}`);
  });
  await check('product native form edits survive tab switches and persist through guarded save',async()=>{
    await page.goto(`${origin}/admin/product-editor/${product.id}`);const title=page.locator('[data-field="title"] input');await title.waitFor();await dismissLicense();await title.fill(`Browser ${tag}`);
    await page.getByRole('tab',{name:'SEO',exact:true}).click();await page.getByRole('tab',{name:'Основное',exact:true}).click();assert.equal(await title.inputValue(),`Browser ${tag}`);
    page.once('dialog',async d=>{assert.equal(d.type(),'confirm');await d.dismiss();});await page.getByRole('button',{name:'К списку',exact:true}).click();assert.ok(page.url().endsWith(product.id));assert.equal(await title.inputValue(),`Browser ${tag}`);
    const saved=page.waitForResponse(r=>r.url().endsWith(`/commerce/mutations/products/${product.id}`)&&r.request().method()==='POST');await page.getByRole('button',{name:'Сохранить черновик',exact:true}).click();assert.equal((await saved).status(),200);await page.waitForFunction(()=>!document.querySelector('.product-editor__success')?.textContent?.includes('Сохранение'));
    assert.equal((await load('products')(product.id,['id','title'])).title,`Browser ${tag}`);
  });
  await check('product browser HTTP 409 preserves visible local form values',async()=>{
    const title=page.locator('[data-field="title"] input');await title.fill(`Browser conflict ${tag}`);const baseline=await load('products')(product.id,['id','updated_at','title']);await save('products',product.id,{expected:baseline,changes:{title:`Remote conflict ${tag}`}});
    const response=page.waitForResponse(r=>r.url().endsWith(`/commerce/mutations/products/${product.id}`)&&r.request().method()==='POST');await page.getByRole('button',{name:'Сохранить черновик',exact:true}).click();assert.equal((await response).status(),409);assert.equal(await title.inputValue(),`Browser conflict ${tag}`);await page.getByText('Товар изменился после загрузки. Локальные изменения сохранены; перезагрузите товар перед повтором.',{exact:true}).waitFor();
    page.once('dialog',d=>d.accept());await page.reload();await title.waitFor();
  });
  for(const viewport of [{width:1536,height:1024},{width:390,height:844}]) await check(`product desktop/mobile ${viewport.width}x${viewport.height} no document overflow`,async()=>{
    await page.setViewportSize(viewport);await page.screenshot({path:resolve(out,`product-${viewport.width}.png`),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  });
  await check('new section route is registered and empty registry stays unavailable',async()=>{
    await page.goto(`${origin}/admin/product-editor/sections/categories`);await page.getByRole('heading',{name:'Раздел недоступен',exact:true}).first().waitFor();await dismissLicense();await page.getByText('Раздел «categories» недоступен.',{exact:true}).waitFor();
  });
  // Serve reviewed source through an isolated browser-only route. Imports reuse
  // Directus' shipped runtime rather than a second Vue instance or fake native UI.
  const bundle=await (await fetch(`${origin}/extensions/sources/index.js`)).text();
  const entry=(name)=>{const match=bundle.match(new RegExp(`['"]([^'"]*${name}\\.[^'"]*entry\\.js)['"]`));assert.ok(match,`${name} runtime export entry`);return match[1];};
  const imports={'@directus/extensions-sdk':entry('@directus_extensions-sdk'),vue:entry('vue'),'vue-router':entry('vue-router')};
  await page.route('**/__a0_probe__/*',async route=>{
    const name=new URL(route.request().url()).pathname.split('/').pop();assert.ok(['index.js','editor-state.mjs','admin-shell.js','admin-state.mjs','page-sections.js'].includes(name));let source=await readFile(resolve(extension,'src',name),'utf8');for(const [key,path] of Object.entries(imports))source=source.replaceAll(`from "${key}"`,`from "${path}"`);await route.fulfill({status:200,contentType:'application/javascript',body:source});
  });
  await check('A0 exports register in actual Vue app; isolated native field/tab/media/section harness',async()=>{
    const metadata=await request('/fields/products');const sectionMetadata=await request('/fields/page_sections');
    await page.evaluate(async({metadata,sectionMetadata,productId,pageId,token,vueEntry})=>{
      const vue=await import(vueEntry);const a0=await import('/__a0_probe__/index.js');
      const required=['AdminShell','SectionTabs','EditorToolbar','NativeFieldGroup','CollectionList','MediaPicker','ReadonlyDetails','createEditorState','PageSectionEditor','createPageSectionController'];for(const name of required)if(!a0[name])throw Error(`Missing ${name}`);if(Object.keys(a0.sectionRegistry).length)throw Error('A0 activated specialized sections');
      const app=document.querySelector('#app').__vue_app__;if(!Object.keys(app?._context.components??{}).some(k=>k.toLowerCase().replaceAll('-','')==='vform'))throw Error('Real Directus v-form is not registered');
      const data=vue.reactive({tab:'main',delta:{},media:null,denied:false,listPage:1,selected:null});const title=metadata.find(f=>f.field==='title');const sku=metadata.find(f=>f.field==='sku');const image=metadata.find(f=>f.field==='main_image');
      const api={get:async(path,{params}={})=>{const query=new URLSearchParams();for(const[k,v]of Object.entries(params??{}))query.set(k,typeof v==='object'&&!Array.isArray(v)?JSON.stringify(v):String(v));const r=await fetch(`${path}?${query}`,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw Object.assign(Error('HTTP '+r.status),{status:r.status});return{data:await r.json()};},post:async(path,payload)=>{const r=await fetch(path,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw Object.assign(Error('HTTP '+r.status),{status:r.status});return{data:await r.json()};}};
      const host=document.createElement('div');host.id='a0-isolated-harness';document.querySelector('.ac-shell__main').replaceChildren(host);
      const probe={setup(){return()=>vue.h('div',[
        vue.h('h2','Isolated A0 harness'),
        vue.h(a0.EditorToolbar,{title:'Probe toolbar',readonly:true,state:{canSave:false}}),
        vue.h(a0.CollectionList,{rows:[{id:'synthetic',title:'Synthetic controlled row'}],columns:[{field:'title',label:'Probe title'}],page:data.listPage,pageSize:1,total:2,onSelect:v=>data.selected=v,'onUpdate:page':v=>data.listPage=v}),
        vue.h(a0.ReadonlyDetails,{values:{id:'synthetic'},fields:[{field:'id',label:'Probe identity'}]}),
        vue.h(a0.SectionTabs,{tabs:[{id:'main',label:'Probe main'},{id:'other',label:'Probe other'}],modelValue:data.tab,'onUpdate:modelValue':v=>data.tab=v}),
        vue.h(a0.NativeFieldGroup,{metadata:[title,sku],fieldSubset:data.tab==='main'?['title']:['sku'],primaryKey:productId,initialValues:{title:'Baseline title',sku:'Baseline sku'},modelValue:data.delta,permissions:{read:true,update:data.denied?false:true},readonly:false,'onUpdate:modelValue':v=>data.delta=v}),
        vue.h(a0.MediaPicker,{field:image,primaryKey:productId,initialValue:{main_image:null},modelValue:data.media,permissions:{read:true,update:true},readonly:false,allowSelect:true,allowUpload:false,'onUpdate:modelValue':v=>data.media=v}),
        vue.h(a0.PageSectionEditor,{parentCollection:'pages',parentId:pageId,metadata:Object.fromEntries(sectionMetadata.map(f=>[f.field,f])),editableFields:['title','text'],permissions:{read:true,update:true},guardedContract:true,readonly:false,api}),
      ]);}};
      const vnode=vue.h(probe);vnode.appContext=app._context;vue.render(vnode,host);window.__a0Probe={data,api,a0,vue,host,unmount:()=>vue.render(null,host)};
    },{metadata,sectionMetadata,productId:product.id,pageId:pageRecord.id,token,vueEntry:imports.vue});
    const host=page.locator('#a0-isolated-harness');await host.locator('[data-field="title"] input').first().fill('Local harness title');
    await host.getByRole('tab',{name:'Probe other',exact:true}).click();await host.locator('[data-field="sku"] input').fill('Local harness sku');await host.getByRole('tab',{name:'Probe main',exact:true}).click();assert.equal(await host.locator('[data-field="title"] input').first().inputValue(),'Local harness title');
    assert.deepEqual(await page.evaluate(()=>({...window.__a0Probe.data.delta})),{title:'Local harness title',sku:'Local harness sku'});assert.match(await host.locator('[data-field="title"]').first().innerText(),/title/);
    await host.locator('[data-field="title"] input').first().fill('Baseline title');assert.deepEqual(await page.evaluate(()=>({...window.__a0Probe.data.delta})),{sku:'Local harness sku'});await host.locator('[data-field="title"] input').first().fill('Local harness title');
    await host.getByRole('button',{name:`Synthetic ${tag}-child`,exact:true}).click();await host.locator('.page-section-editor [data-field="title"] input').fill(`Harness ${tag}-child`);await host.locator('.page-section-editor').getByRole('button',{name:'Сохранить',exact:true}).click();await host.getByText('Section saved.',{exact:true}).waitFor();
    assert.equal((await load('page_sections')(child.id,['id','title'])).title,`Harness ${tag}-child`);
  });
  await check('controlled A0 list selection/pagination and native field permission denial',async()=>{
    const host=page.locator('#a0-isolated-harness');await host.getByText('Synthetic controlled row',{exact:true}).click();await host.getByRole('button',{name:'Дальше',exact:true}).click();assert.equal(await page.evaluate(()=>window.__a0Probe.data.listPage),2);assert.equal(await page.evaluate(()=>window.__a0Probe.data.selected?.id),'synthetic');
    await page.evaluate(()=>window.__a0Probe.data.denied=true);await page.waitForFunction(()=>document.querySelector('#a0-isolated-harness [data-field=title] input')?.disabled===true||document.querySelector('#a0-isolated-harness [data-field=title] input')?.readOnly===true);
    await page.evaluate(()=>window.__a0Probe.data.denied=false);
  });
  await check('live child reparent race conflicts and retains independent local section data',async()=>{
    await page.evaluate(async({pageId,childId,otherPageId,tag})=>{
      const {a0,api}=window.__a0Probe;const controller=a0.createPageSectionController({parentCollection:'pages',parentId:pageId,editableFields:['title','text'],permissions:{read:true,update:true},guardedContract:true,readonly:false,api});
      if(!(await controller.list()).ok||!(await controller.select(childId)).ok)throw Error('Live owned child was not loaded');
      if(!controller.change(childId,'title',`Race local ${tag}`))throw Error('Child local edit unavailable');
      const base=(await api.get(`/items/page_sections/${childId}`)).data.data;await api.post(`/commerce/mutations/page_sections/${childId}`,{expected:{id:base.id,updated_at:base.updated_at,page:base.page},changes:{page:otherPageId}});
      const result=await controller.save(childId);const row=controller.getRow(childId);if(result.ok||!row.conflict||row.values.title!==`Race local ${tag}`)throw Error('Child owner race overwrote local section data');
      const current=(await api.get(`/items/page_sections/${childId}`)).data.data;await api.post(`/commerce/mutations/page_sections/${childId}`,{expected:{id:current.id,updated_at:current.updated_at,page:current.page},changes:{page:pageId}});controller.dispose();
    },{pageId:pageRecord.id,childId:child.id,otherPageId:otherPage.id,tag});
    const parent=await request(`/items/pages/${pageRecord.id}?fields=id,title,status`);assert.equal(parent.title,pageRecord.title);assert.equal(parent.status,'draft');
  });
  await check('A0 MediaPicker selects and clears only own PNG through actual Directus file manager',async()=>{
    const host=page.locator('#a0-isolated-harness');const select=host.locator('[data-field="main_image"] .v-upload').getByRole('button').last();
    await select.click();const own=page.locator('#dialog-outlet').getByText(tag,{exact:true});await own.waitFor();await own.click();await page.screenshot({path:resolve(out,'a0-native-files.png'),fullPage:true});
    await page.locator('#dialog-outlet button').filter({has:page.locator('[data-icon="check"]')}).click();await page.waitForFunction(id=>window.__a0Probe.data.media===id,image.id);await page.screenshot({animations:'disabled',path:resolve(out,'a0-native-selected.png'),fullPage:true});
    await host.locator('[data-field="main_image"] button').filter({has:page.locator('[data-icon="close"]')}).click();await page.waitForFunction(()=>window.__a0Probe.data.media===null);
  });
  for(const viewport of [{width:1536,height:1024},{width:390,height:844}])await check(`isolated A0 harness ${viewport.width}x${viewport.height} no document overflow`,async()=>{await page.setViewportSize(viewport);await page.screenshot({path:resolve(out,`a0-harness-${viewport.width}.png`),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));});
  await check('actual browser has no uncaught runtime exceptions',async()=>assert.deepEqual(fatal,[]));
  await check('actual native components emit no unresolved-component/invalid-prop warnings',async()=>assert.deepEqual(warnings,[]));
} finally {
  if(browser)await browser.close();
  // Guard ownership by exact run tag, then use the current complete record as CAS
  // baseline. Children are deleted before parents. No list-wide cleanup occurs.
  const cleanupOrder={page_sections:0,directus_files:1,pages:2,products:3};
  for(const entry of [...owned].sort((a,b)=>cleanupOrder[a.collection]-cleanupOrder[b.collection]))await check(`cleanup owned ${entry.collection}`,async()=>{
    const endpoint=entry.collection==='directus_files'?'/files':`/items/${entry.collection}`;const current=await request(`${endpoint}/${entry.id}`);
    const belongs=current[entry.tagField]===entry.tagValue || entry.collection==='page_sections'&&current.title===`Harness ${tag}-child`;
    assert.ok(belongs,'Ownership changed; refuse cleanup');if(entry.collection==='directus_files')await request(`/files/${entry.id}`,{method:'DELETE'});else await request(`/commerce/mutations/${entry.collection}/${entry.id}`,{method:'POST',body:{expected:current,action:'delete'}});
  });
  await writeFile(resolve(out,'results.json'),JSON.stringify({target:origin,run,scope:'own synthetic draft content; real Directus; isolated A0 harness; no production acceptance',results,limitations:['Authenticated tests use existing admin only; no existing restricted account credentials are assumed and no roles/users/permissions are created.','Anonymous permission denial is real; field-level UI denial is covered by controlled contracts, not proof of a restricted identity.']},null,2));
  console.log(JSON.stringify({pass:results.filter(r=>r.status==='PASS').length,fail:results.filter(r=>r.status==='FAIL').length,artifacts:out}));
  if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
}
