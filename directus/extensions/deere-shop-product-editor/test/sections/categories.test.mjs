import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Native rendering is exercised in real Directus by the opt-in runtime probe.
// These tests exercise the actual query/controller without installing another Vue.
const uri = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const vue = uri('export const defineComponent=x=>x; export const h=()=>{}; export const ref=x=>({value:x}); export const computed=x=>x; export const watch=()=>{}; export const onMounted=()=>{}; export const onUnmounted=()=>{}; export const resolveComponent=x=>x;');
const router = uri('export const onBeforeRouteLeave=()=>{}; export const onBeforeRouteUpdate=()=>{}; export const useRouter=()=>({});');
const sdk = uri('export const useApi=()=>({}); export const useStores=()=>({});');
const rewrite = s => s.replaceAll('"vue"', JSON.stringify(vue)).replaceAll('"vue-router"', JSON.stringify(router)).replaceAll('"@directus/extensions-sdk"', JSON.stringify(sdk));
const shell = uri(rewrite(await readFile(new URL('../../src/admin-shell.js', import.meta.url), 'utf8')));
const source = await readFile(new URL('../../src/sections/categories.js', import.meta.url), 'utf8');
const moduleUrl = uri(rewrite(source).replaceAll('"../admin-shell.js"', JSON.stringify(shell)).replaceAll('"../admin-state.mjs"', JSON.stringify(new URL('../../src/admin-state.mjs', import.meta.url).href)));
const { buildCategoriesQuery, categoryPermissions, validateCategory, categorySeoPreview, categoryReadonlySummary, comparisonValue, errorText, createCategoryController } = await import(moduleUrl);
const { buildNativeFieldProps } = await import(shell);
const fields = ['id','updated_at','created_at','title','slug','status','h1','image_alt','parent','seo','seo_title','seo_description','is_indexable','redirect_target','og_image','sort_order','translations','faq'].map(field => ({ field, type: ['seo','translations','faq'].includes(field) ? 'json' : field==='is_indexable'?'boolean':field==='sort_order'?'integer':'string', schema: { is_nullable: !['title','slug','status'].includes(field) }, meta: { required: ['title','slug','status'].includes(field), options: field === 'status' ? { choices: [{value:'draft'},{value:'published'},{value:'archived'}] } : null } }));
const record = { id:'own', updated_at:null, created_at:'date', title:'Before', slug:'before', status:'draft', h1:null, image_alt:null, parent:null, seo:{custom:{keep:1}}, seo_title:null, seo_description:null, is_indexable:true, redirect_target:null, og_image:null, sort_order:0, translations:null, faq:'old-invalid-json-string' };
function apiFixture({ update = true, post } = {}) {
  const calls=[];
  return { calls, async get(path, options) { calls.push(['GET',path,options]); if(path==='/fields/categories')return {data:{data:fields}}; if(path==='/permissions/me')return {data:{data:{categories:{read:{access:'full',fields:['*']},update:{access:update?'full':'none',fields:['*']},create:{access:'none',fields:[]}}}}}; if(path.startsWith('/permissions/me/categories/'))return {data:{data:{update:{access:update}}}}; return {data:{data:structuredClone(record)}}; }, async post(path, body) { calls.push(['POST',path,body]); return post ? post(path,body) : {data:{data:{...record,...body.changes,updated_at:'v2'}}}; } };
}

test('bounded server query searches title/slug/h1 and only composes effective filters', () => {
  const q=buildCategoriesQuery({page:3,search:' needle ',sort:'-title',filters:{status:'draft',parent:'parent-id',show_on_homepage:'false',is_indexable:'true'}});
  assert.equal(q.limit,25); assert.equal(q.offset,50); assert.equal(q.search,undefined); assert.equal(q.sort,'-title,id');
  assert.deepEqual(q.filter._and[0],{_or:[{title:{_icontains:'needle'}},{slug:{_icontains:'needle'}},{h1:{_icontains:'needle'}}]});
  assert.deepEqual(q.filter._and.slice(1),[{status:{_eq:'draft'}},{parent:{_eq:'parent-id'}},{is_indexable:{_eq:true}}]);
  for(const sort of ['title','-title','slug','-slug','sort_order','-sort_order','updated_at','-updated_at'])assert.doesNotThrow(()=>buildCategoriesQuery({sort}));
  for(const sort of ['parent','status','show_on_homepage','-show_on_homepage','secret'])assert.throws(()=>buildCategoriesQuery({sort}));
  assert.throws(()=>buildCategoriesQuery({page:0}));
});

test('unknown/partial permissions fail closed and item update is required', () => {
  assert.deepEqual(categoryPermissions({}),{read:[],update:[],create:[]});
  const p=categoryPermissions({categories:{read:{access:'partial',fields:['id','title']},update:{access:'partial',fields:['title']}}}, {update:{access:false}});
  assert.deepEqual(p.read,['id','title']); assert.deepEqual(p.update,[]);
});

test('validation uses live required and choices, rejects malformed slug and keeps JSON objects', () => {
  assert.equal(validateCategory(record,fields).length,0);
  const errors=validateCategory({...record,title:' ',slug:'bad slug',status:'unknown'},fields);
  assert.deepEqual(new Set(errors.map(e=>e.field)),new Set(['title','slug','status']));
});

test('SEO preview uses dirty scalar edits, falls back to readable saved JSON, and omits denied fields', () => {
  const values={title:'Category',seo_title:'',seo_description:null,seo:{title:'Saved SEO title',meta_description:'Saved description'}};
  const readable=['title','seo_title','seo_description','seo'];
  assert.deepEqual(categorySeoPreview(values,{},readable),{title:'Saved SEO title',description:'Saved description'});
  assert.deepEqual(categorySeoPreview({...values,seo_title:'Draft title',seo_description:'Draft description'},{seo_title:true,seo_description:true},readable),{title:'Draft title',description:'Draft description'});
  assert.deepEqual(categorySeoPreview({...values,seo_title:'Draft title'},{seo_title:true},['seo_title']),{title:'Draft title',description:null});
  assert.deepEqual(categorySeoPreview(values,{seo_title:true},[]),{title:null,description:null});
  assert.deepEqual(categorySeoPreview(values,{},['*']),{title:'Saved SEO title',description:'Saved description'});
  assert.deepEqual(categorySeoPreview({...values,seo_title:'Current scalar'},{},readable),{title:'Current scalar',description:'Saved description'});
  assert.deepEqual(categorySeoPreview(values,{seo_title:true},readable),{title:null,description:'Saved description'});
});

test('inactive saved settings use human readonly summaries without exposing their values', () => {
  assert.match(categoryReadonlySummary('og_image','private-asset-uuid'),/сохранено/i);
  assert.match(categoryReadonlySummary('faq',{private:'content'}),/Сохранено/i);
  assert.match(categoryReadonlySummary('show_on_homepage',false),/выключено/i);
});

test('ordinary edits retain an unknown saved status without failing validation or changing it', async () => {
  const api=apiFixture(); const get=api.get;
  api.get=async(path,options)=>{const r=await get(path,options);if(path==='/items/categories/own')r.data.data.status='paused';return r;};
  const c=createCategoryController(api);await c.open('own');c.change('title','Changed title');
  assert.equal((await c.save()).ok,true);
  assert.deepEqual(api.calls.find(x=>x[0]==='POST')[2].changes,{title:'Changed title'});
  assert.equal(c.snapshot().values.status,'paused');
});

test('controller sends only changed allowed fields and preserves other tabs and JSON', async () => {
  const api=apiFixture(); const c=createCategoryController(api); assert.equal((await c.open('own')).ok,true);
  assert.equal(c.change('title','Local'),true); assert.equal(c.change('h1','Heading'),true); assert.equal(c.change('image_alt','Category image description'),true);
  assert.equal(c.change('parent','child'),false); assert.equal(c.change('id','bad'),false); assert.equal(c.change('created_at','bad'),false);
  assert.equal(c.change('show_on_homepage',false),false); assert.equal(c.change('og_image','private-file-id'),false);
  assert.equal((await c.save()).ok,true);
  const call=api.calls.find(v=>v[0]==='POST'); assert.equal(call[1],'/commerce/mutations/categories/own');
  assert.deepEqual(call[2],{expected:{id:'own',updated_at:null,title:'Before',h1:null,image_alt:null},changes:{title:'Local',h1:'Heading',image_alt:'Category image description'}});
  assert.deepEqual(c.snapshot().values.seo,{custom:{keep:1}});
});

test('SEO scalar and indexability edits stay separate from saved unsupported settings', async () => {
  const api=apiFixture(); const c=createCategoryController(api); await c.open('own');
  c.changeTab(['seo_title','seo_description'],{seo_title:'Title'});
  c.changeTab(['seo_title','seo_description'],{seo_title:'Title',seo_description:'Description'});
  c.changeTab(['is_indexable','redirect_target','og_image'],{is_indexable:false});
  c.changeTab(['is_indexable','redirect_target','og_image'],{is_indexable:false,redirect_target:'/new'});
  c.changeTab(['seo'],{seo:{...record.seo,title:'Plugin title'}});
  assert.equal(c.snapshot().values.seo_title,'Title');
  assert.equal(c.snapshot().values.seo_description,'Description');
  assert.equal(c.snapshot().values.is_indexable,false);
  assert.equal(c.snapshot().values.redirect_target,null);
  assert.deepEqual(c.snapshot().values.seo,record.seo);
  c.changeTab(['seo_title','seo_description'],{});
  assert.equal(c.snapshot().values.seo_title,null);
  assert.equal(c.snapshot().values.seo_description,null);
  assert.equal(c.snapshot().values.is_indexable,false);
  assert.deepEqual(c.snapshot().values.seo,record.seo);
  assert.equal(c.change('og_image','asset-2'),false);
  assert.equal((await c.save()).ok,true);
  assert.deepEqual(api.calls.find(v=>v[0]==='POST')[2].changes,{is_indexable:false});
});

test('readonly identity never mutates; duplicate submit is blocked; 409 keeps local data', async () => {
  const denied=apiFixture({update:false}); const r=createCategoryController(denied); await r.open('own'); assert.equal(r.change('title','bad'),false); await r.save(); assert.equal(denied.calls.some(c=>c[0]==='POST'),false);
  let reject; const api=apiFixture({post:()=>new Promise((_,r)=>{reject=r;})}); const c=createCategoryController(api); await c.open('own'); c.change('title','Keep local'); const pending=c.save(); await c.save(); assert.equal(api.calls.filter(v=>v[0]==='POST').length,1);
  reject(Object.assign(Error('Conflict'),{response:{status:409}})); await pending;
  assert.equal(c.snapshot().values.title,'Keep local'); assert.equal(c.snapshot().conflict,true); await c.save(); assert.equal(api.calls.filter(v=>v[0]==='POST').length,1);
  await c.compare(); assert.equal(c.snapshot().values.title,'Keep local'); assert.equal(c.snapshot().conflict,true);
  await c.reconcile(true); assert.equal(c.snapshot().values.title,'Keep local'); assert.equal(api.calls.filter(v=>v[0]==='POST').length,1);
});

test('malformed acknowledgements block retry and preserve input until explicit reload', async () => {
  const api=apiFixture({post:async()=>({data:{data:{id:'own'}}})}); const c=createCategoryController(api); await c.open('own'); c.change('title','Keep local'); assert.equal((await c.save()).ok,false); assert.equal(c.snapshot().writeUncertain,true); assert.equal(c.snapshot().values.title,'Keep local'); await c.save(); assert.equal(api.calls.filter(v=>v[0]==='POST').length,1);
});

test('discarding category edits reloads the saved record without issuing a write', async () => {
  const api=apiFixture(); const c=createCategoryController(api); await c.open('own');
  c.change('title','Unsaved name');
  const result=await c.discardChanges();
  assert.equal(result.ok,true);
  assert.equal(c.snapshot().values.title,'Before');
  assert.equal(c.snapshot().dirty,false);
  assert.equal(api.calls.filter(call=>call[0]==='POST').length,0);
});

test('uncertain native create recovers by bounded exact slug read without retry or success claim', async () => {
  const api=apiFixture({post:async()=>{throw Error('Lost create response');}});
  const get=api.get;
  api.get=async(path,options)=>{
    if(path==='/fields/categories')return {data:{data:fields.map(f=>f.field==='status'?{...f,schema:{...f.schema,default_value:'draft'}}:f)}};
    if(path==='/permissions/me')return {data:{data:{categories:{read:{access:'full',fields:['*']},create:{access:'full',fields:['*']}}}}};
    if(path==='/items/categories'){api.calls.push(['GET',path,options]);return {data:{data:[{...record,slug:'new-draft',title:'Own candidate'}]}};}
    return get(path,options);
  };
  const c=createCategoryController(api);await c.open('+');c.change('title','Own candidate');c.change('slug','new-draft');
  assert.equal((await c.save()).ok,false);assert.equal(c.snapshot().saved,false);assert.equal(c.snapshot().writeUncertain,true);assert.equal(Boolean(c.snapshot().readError),false);
  assert.equal(api.calls.find(c=>c[0]==='POST')[2].status,'draft');
  assert.equal((await c.recoverCreate()).ok,true);assert.equal(c.snapshot().createRecovery.record.id,'own');assert.equal(c.snapshot().values.title,'Own candidate');assert.equal(c.snapshot().saved,false);
  await c.save();assert.equal(api.calls.filter(c=>c[0]==='POST').length,1);
  const query=api.calls.find(c=>c[0]==='GET'&&c[1]==='/items/categories')[2].params;
  assert.equal(query.limit,2);assert.deepEqual(query.filter,{slug:{_eq:'new-draft'}});
  assert.equal(api.calls.find(c=>c[0]==='POST')[1],'/items/categories');assert.equal(Object.hasOwn(api.calls.find(c=>c[0]==='POST')[2],'id'),false);
});

test('source and deployed artifacts match', async () => {
  for(const name of ['sections/categories.js','index.js'])assert.deepEqual(await readFile(new URL(`../../src/${name}`,import.meta.url)),await readFile(new URL(`../../dist/${name}`,import.meta.url)));
});


test('publication changes require explicit intent and new records remain drafts', async () => {
  const api=apiFixture(); const c=createCategoryController(api); await c.open('own');
  assert.equal(c.requestPublication('published').ok,true);
  assert.equal(c.snapshot().values.status,'draft');
  assert.equal(c.snapshot().pendingStatus,'published');
  assert.equal(c.snapshot().canSave,false);
  assert.equal(c.confirmPublication().ok,true);
  assert.equal(c.snapshot().values.status,'published');
  c.change('title','Edited'); await c.save();
  assert.equal(api.calls.find(x=>x[0]==='POST')[2].changes.status,'published');
});

test('failed category readback retains dirty values and does not report saved', async () => {
  const api=apiFixture(); const normal=api.get; let failRead=false;
  api.get=async(path,options)=>{if(path==='/items/categories/own'&&failRead)throw Error('readback offline');return normal(path,options);};
  const c=createCategoryController(api); await c.open('own'); c.change('title','Local value'); failRead=true;
  const result=await c.save();
  assert.equal(result.ok,false); assert.equal(c.snapshot().values.title,'Local value');
  assert.equal(c.snapshot().saved,false); assert.ok(c.snapshot().readError);
});

test('confirmed duplicate slug rejection keeps address editable without unsafe retry', async () => {
  const api=apiFixture({post:async()=>{throw Object.assign(Error('duplicate'),{response:{status:400,data:{errors:[{extensions:{code:'RECORD_NOT_UNIQUE'}}]}}});}});
  const c=createCategoryController(api); await c.open('own'); c.change('slug','taken');
  const result=await c.save(); assert.equal(result.ok,false);
  assert.equal(c.snapshot().values.slug,'taken'); assert.equal(c.snapshot().writeUncertain,false);
  assert.equal(c.canChange('slug'),true); c.change('slug','available');
  assert.equal(c.snapshot().values.slug,'available');
});


test('human errors and saved summaries avoid implementation details and asset identifiers', () => {
  assert.match(errorText({response:{data:{errors:[{extensions:{code:'RECORD_NOT_UNIQUE'}}]}}}),/адрес/i);
  for(const error of [errorText({response:{status:403}}),errorText({response:{status:409}})]) {
    assert.doesNotMatch(error,/Directus|slug|UUID|categories\./i);
  }
  assert.equal(categoryReadonlySummary('og_image','secret-file-uuid').includes('secret-file-uuid'),false);
});

test('ordinary status edits are rejected; publication intent is blocked while a save is in flight', async () => {
  let finish;
  const api=apiFixture({post:()=>new Promise(resolve=>{finish=resolve;})});
  const c=createCategoryController(api); await c.open('own');
  assert.equal(c.change('status','published'),false);
  assert.equal(c.requestPublication('draft').unchanged,true); assert.equal(c.snapshot().pendingStatus,null);
  assert.equal(c.requestPublication('published').ok,true); assert.equal(c.snapshot().pendingStatus,'published');
  assert.equal(c.requestPublication('draft').unchanged,true); assert.equal(c.snapshot().pendingStatus,null);
  c.change('title','Changed'); const pending=c.save();
  assert.equal(c.requestPublication('published').ok,false);
  finish({data:{data:{...record,title:'Changed',updated_at:'v2'}}});
  await pending;
  assert.equal(c.requestPublication('published').ok,true);
  assert.equal(c.confirmPublication().ok,true);
  assert.equal(c.snapshot().values.status,'published');
});

test('failed post-save readback retains edits until explicit successful recovery', async () => {
  const api=apiFixture(); const get=api.get; let fail=false;
  api.get=async(path,options)=>{if(path==='/items/categories/own'&&fail){fail=false;throw Error('temporary read error');}return get(path,options);};
  const c=createCategoryController(api); await c.open('own'); fail=true;
  c.change('title','Submitted title'); c.change('slug','submitted-address');
  const result=await c.save();
  assert.equal(result.readbackFailed,true); assert.equal(c.snapshot().saved,false);
  assert.equal(c.snapshot().values.title,'Submitted title'); assert.equal(c.snapshot().values.slug,'submitted-address');
  assert.equal(c.snapshot().canSave,false); assert.equal(api.calls.filter(x=>x[0]==='POST').length,1);
  assert.equal((await c.retryReadback()).ok,true);
  assert.equal(c.snapshot().values.title,'Submitted title'); assert.equal(c.snapshot().values.slug,'submitted-address');
  assert.equal(c.snapshot().canSave,true); assert.equal(api.calls.filter(x=>x[0]==='POST').length,1);
});

test('confirmed duplicate address on new category stays editable and is not uncertain', async () => {
  const api=apiFixture({post:async()=>{throw Object.assign(Error('duplicate'),{response:{status:400,data:{errors:[{extensions:{code:'RECORD_NOT_UNIQUE'}}]}}});}});
  const original=api.get;
  api.get=async(path,options)=>{
    if(path==='/fields/categories')return {data:{data:fields.map(f=>f.field==='status'?{...f,schema:{...f.schema,default_value:'draft'}}:f)}};
    if(path==='/permissions/me')return {data:{data:{categories:{read:{access:'full',fields:['*']},create:{access:'full',fields:['*']}}}}};
    return original(path,options);
  };
  const c=createCategoryController(api); await c.open('+'); c.change('title','New category'); c.change('slug','taken');
  const result=await c.save();
  assert.equal(result.duplicateRejected,true); assert.equal(c.snapshot().writeUncertain,false);
  assert.equal(c.snapshot().saved,false); assert.equal(c.snapshot().values.slug,'taken');
  const inline=buildNativeFieldProps({metadata:[{field:'slug',name:'Адрес категории'}],fieldSubset:['slug'],permissions:{read:true,update:true},readonly:false,validationErrors:c.snapshot().validation});
  assert.equal(inline.validationErrors[0].type,'unique'); assert.equal(inline.validationErrors[0].code,'RECORD_NOT_UNIQUE');
  assert.match(inline.validationErrors[0].message,/Адрес категории/);
  assert.equal(c.canChange('slug'),true); c.change('slug','available');
  assert.equal(c.snapshot().values.slug,'available'); assert.equal(api.calls.filter(x=>x[0]==='POST').length,1);
});



test('recovery keeps submitted SEO input but adopts fresh server JSON and normalized fields', async () => {
  const api=apiFixture(); const get=api.get; let failReadback=false; let afterWrite=false;
  api.get=async(path,options)=>{
    if(path==='/items/categories/own'&&failReadback){failReadback=false;throw Error('readback unavailable');}
    const response=await get(path,options);
    if(path==='/items/categories/own'&&afterWrite) response.data.data={...response.data.data,title:'Server normalized title',slug:'server-normalized',seo_title:'Server normalized SEO',seo:{title:'Server SEO JSON',custom:{keep:2}},updated_at:'v2'};
    return response;
  };
  const originalPost=api.post;
  api.post=async(path,body)=>{
    api.calls.push(['POST',path,body]);
    if(path==='/commerce/mutations/categories/own'){
      afterWrite=true; failReadback=true;
      return {data:{data:{...record,...body.changes,title:'Server normalized title',slug:'server-normalized',seo_title:'Server normalized SEO',updated_at:'v2'}}};
    }
    return originalPost(path,body);
  };
  const c=createCategoryController(api); await c.open('own');
  c.change('title','My title'); c.change('slug','my-address'); c.change('seo_title','My SEO title');
  const failed=await c.save();
  assert.equal(failed.readbackFailed,true);
  assert.equal(c.snapshot().values.title,'My title'); assert.equal(c.snapshot().values.slug,'my-address');
  assert.equal(c.snapshot().values.seo_title,'My SEO title');
  assert.equal((await c.retryReadback()).ok,true);
  assert.equal(c.snapshot().values.title,'My title'); assert.equal(c.snapshot().values.slug,'my-address');
  assert.equal(c.snapshot().values.seo_title,'My SEO title');
  assert.deepEqual(c.snapshot().values.seo,{title:'Server SEO JSON',custom:{keep:2}});
  assert.equal(api.calls.filter(x=>x[0]==='POST').length,1);
});

test('discard after failed readback clears retained overlay only after fresh record loads', async () => {
  const api=apiFixture(); const get=api.get; let fail=false;
  api.get=async(path,options)=>{if(path==='/items/categories/own'&&fail){fail=false;throw Error('readback offline');}return get(path,options);};
  const c=createCategoryController(api); await c.open('own'); c.change('title','Local title'); fail=true;
  assert.equal((await c.save()).readbackFailed,true);
  assert.equal(c.snapshot().values.title,'Local title');
  assert.equal((await c.discardChanges()).ok,true);
  assert.equal(c.snapshot().values.title,'Before'); assert.equal(c.snapshot().readbackFailed,false);
  assert.equal(c.snapshot().dirty,false); assert.equal(api.calls.filter(x=>x[0]==='POST').length,1);
});


test('malformed legacy content JSON cannot block an ordinary category title save', async () => {
  const api=apiFixture(); const c=createCategoryController(api); await c.open('own');
  c.change('title','Updated title');
  assert.equal((await c.save()).ok,true);
  assert.deepEqual(api.calls.find(x=>x[0]==='POST')[2].changes,{title:'Updated title'});
  assert.equal(api.calls.find(x=>x[0]==='POST')[2].changes.faq,undefined);
  assert.equal(c.snapshot().values.faq,'old-invalid-json-string');
});


test('comparison values humanize status and indexability without rewriting user text', () => {
  assert.equal(comparisonValue('status','draft'),'Черновик');
  assert.equal(comparisonValue('status','published'),'Опубликована');
  assert.equal(comparisonValue('status','archived'),'Архив');
  assert.equal(comparisonValue('status','retired'),'Другой статус');
  assert.equal(comparisonValue('status',null),null);
  assert.equal(comparisonValue('is_indexable',true),'Индексация разрешена');
  assert.equal(comparisonValue('is_indexable',false),'Индексация запрещена');
  assert.equal(comparisonValue('is_indexable',null),null);
  assert.equal(comparisonValue('title','My category title'),'My category title');
  assert.equal(comparisonValue('image','file-id'),'Файл выбран');
});


test('category required and address validation use native-supported inline error types', () => {
  const categoryErrors=validateCategory({...record,title:'',slug:'bad address'},fields);
  const native=buildNativeFieldProps({metadata:fields,fieldSubset:['title','slug'],permissions:{read:true,update:true},readonly:false,validationErrors:categoryErrors});
  const errors=Object.fromEntries(native.validationErrors.map(error=>[error.field,error]));
  assert.equal(errors.title.type,'required'); assert.equal(errors.title.code,'REQUIRED');
  assert.equal(errors.slug.type,'regex');
  assert.match(errors.slug.message,/Адрес категории/);
});
