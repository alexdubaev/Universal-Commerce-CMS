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
const { buildCategoriesQuery, categoryPermissions, validateCategory, categorySeoPreview, createCategoryController } = await import(moduleUrl);
const fields = ['id','updated_at','created_at','title','slug','status','h1','parent','seo','seo_title','seo_description','is_indexable','redirect_target','og_image','sort_order','translations'].map(field => ({ field, type: ['seo','translations'].includes(field) ? 'json' : field==='is_indexable'?'boolean':field==='sort_order'?'integer':'string', schema: { is_nullable: !['title','slug','status'].includes(field) }, meta: { required: ['title','slug','status'].includes(field), options: field === 'status' ? { choices: [{value:'draft'},{value:'published'},{value:'archived'}] } : null } }));
const record = { id:'own', updated_at:null, created_at:'date', title:'Before', slug:'before', status:'draft', h1:null, parent:null, seo:{custom:{keep:1}}, seo_title:null, seo_description:null, is_indexable:true, redirect_target:null, og_image:null, sort_order:0, translations:null };
function apiFixture({ update = true, post } = {}) {
  const calls=[];
  return { calls, async get(path, options) { calls.push(['GET',path,options]); if(path==='/fields/categories')return {data:{data:fields}}; if(path==='/permissions/me')return {data:{data:{categories:{read:{access:'full',fields:['*']},update:{access:update?'full':'none',fields:['*']},create:{access:'none',fields:[]}}}}}; if(path.startsWith('/permissions/me/categories/'))return {data:{data:{update:{access:update}}}}; return {data:{data:structuredClone(record)}}; }, async post(path, body) { calls.push(['POST',path,body]); return post ? post(path,body) : {data:{data:{...record,...body.changes,updated_at:'v2'}}}; } };
}

test('bounded server query searches exactly title/slug/h1 and composes all filters', () => {
  const q=buildCategoriesQuery({page:3,search:' needle ',sort:'-title',filters:{status:'draft',parent:'parent-id',show_on_homepage:'false',is_indexable:'true'}});
  assert.equal(q.limit,25); assert.equal(q.offset,50); assert.equal(q.search,undefined); assert.equal(q.sort,'-title,id');
  assert.deepEqual(q.filter._and[0],{_or:[{title:{_icontains:'needle'}},{slug:{_icontains:'needle'}},{h1:{_icontains:'needle'}}]});
  assert.deepEqual(q.filter._and.slice(1),[{status:{_eq:'draft'}},{parent:{_eq:'parent-id'}},{show_on_homepage:{_eq:false}},{is_indexable:{_eq:true}}]);
  assert.throws(()=>buildCategoriesQuery({page:0})); assert.throws(()=>buildCategoriesQuery({sort:'secret'}));
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

test('controller sends only changed allowed fields and preserves other tabs and JSON', async () => {
  const api=apiFixture(); const c=createCategoryController(api); assert.equal((await c.open('own')).ok,true);
  assert.equal(c.change('title','Local'),true); assert.equal(c.change('h1','Heading'),true);
  assert.equal(c.change('parent','child'),false); assert.equal(c.change('id','bad'),false); assert.equal(c.change('created_at','bad'),false);
  assert.equal((await c.save()).ok,true);
  const call=api.calls.find(v=>v[0]==='POST'); assert.equal(call[1],'/commerce/mutations/categories/own');
  assert.deepEqual(call[2],{expected:{id:'own',updated_at:null,title:'Before',h1:null},changes:{title:'Local',h1:'Heading'}});
  assert.deepEqual(c.snapshot().values.seo,{custom:{keep:1}});
});

test('separate SEO field groups retain edits and reset independently', async () => {
  const api=apiFixture(); const c=createCategoryController(api); await c.open('own');
  c.changeTab(['seo_title','seo_description'],{seo_title:'Title'});
  c.changeTab(['seo_title','seo_description'],{seo_title:'Title',seo_description:'Description'});
  c.changeTab(['is_indexable','redirect_target','og_image'],{is_indexable:false});
  c.changeTab(['is_indexable','redirect_target','og_image'],{is_indexable:false,redirect_target:'/new'});
  c.changeTab(['seo'],{seo:{...record.seo,title:'Plugin title'}});
  assert.equal(c.snapshot().values.seo_title,'Title');
  assert.equal(c.snapshot().values.seo_description,'Description');
  assert.equal(c.snapshot().values.is_indexable,false);
  assert.equal(c.snapshot().values.redirect_target,'/new');
  assert.deepEqual(c.snapshot().values.seo,{...record.seo,title:'Plugin title'});
  c.changeTab(['seo_title','seo_description'],{});
  assert.equal(c.snapshot().values.seo_title,null);
  assert.equal(c.snapshot().values.seo_description,null);
  assert.equal(c.snapshot().values.is_indexable,false);
  assert.deepEqual(c.snapshot().values.seo,{...record.seo,title:'Plugin title'});
  c.change('og_image','asset-2');
  assert.equal((await c.save()).ok,true);
  assert.deepEqual(api.calls.find(v=>v[0]==='POST')[2].changes,{is_indexable:false,redirect_target:'/new',og_image:'asset-2',seo:{...record.seo,title:'Plugin title'}});
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
  assert.equal((await c.save()).ok,false);assert.equal(c.snapshot().saved,false);assert.equal(c.snapshot().writeUncertain,true);
  assert.equal((await c.recoverCreate()).ok,true);assert.equal(c.snapshot().createRecovery.record.id,'own');assert.equal(c.snapshot().values.title,'Own candidate');assert.equal(c.snapshot().saved,false);
  await c.save();assert.equal(api.calls.filter(c=>c[0]==='POST').length,1);
  const query=api.calls.find(c=>c[0]==='GET'&&c[1]==='/items/categories')[2].params;
  assert.equal(query.limit,2);assert.deepEqual(query.filter,{slug:{_eq:'new-draft'}});
  assert.equal(api.calls.find(c=>c[0]==='POST')[1],'/items/categories');assert.equal(Object.hasOwn(api.calls.find(c=>c[0]==='POST')[2],'id'),false);
});

test('source and deployed artifacts match', async () => {
  for(const name of ['sections/categories.js','index.js'])assert.deepEqual(await readFile(new URL(`../../src/${name}`,import.meta.url)),await readFile(new URL(`../../dist/${name}`,import.meta.url)));
});
