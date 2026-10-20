import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Exercise production controllers and the real A0 state without a second Vue runtime.
const uri = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const vue = uri('export const defineComponent=x=>x; export const h=(type,props,children)=>({type,props:props&&typeof props==="object"&&!Array.isArray(props)?props:{},children:children??props}); export const ref=x=>({value:x}); export const computed=x=>({get value(){return x();}}); export const watch=(getter,callback,options)=>{if(options?.immediate)callback(getter());}; export const onMounted=()=>{}; export const onUnmounted=()=>{}; export const onBeforeUnmount=()=>{}; export const resolveComponent=x=>x;');
const router = uri('export const onBeforeRouteLeave=()=>{}; export const onBeforeRouteUpdate=()=>{}; export const useRouter=()=>({});');
const sdk = uri('export const useApi=()=>globalThis.__a3Api;');
const rewrite = source => source.replaceAll('"vue"',JSON.stringify(vue)).replaceAll('"vue-router"',JSON.stringify(router)).replaceAll('"@directus/extensions-sdk"',JSON.stringify(sdk));
const shell = uri(rewrite(await readFile(new URL('../../src/admin-shell.js',import.meta.url),'utf8')));
const source = await readFile(new URL('../../src/sections/pages.js',import.meta.url),'utf8');
const { PagesSection, PAGE_FIELDS, buildPagesQuery, pagePermissions, validatePage, pageRouteContext, createPageListController, createPageController, pageSeoInterfaceInitialValues } = await import(uri(rewrite(source).replaceAll('"../admin-shell.js"',JSON.stringify(shell)).replaceAll('"../admin-state.mjs"',JSON.stringify(new URL('../../src/admin-state.mjs',import.meta.url).href)).replaceAll('"../page-sections.js"',JSON.stringify(uri('export const PageSectionEditor={name:"PageSectionEditor"};')))));
const response = data => ({data:{data}});
const permit = (fields=['*'],access='full') => ({access,fields});
const permissions = { pages:{read:permit(),update:permit(),create:permit()},home_page:{read:permit(['id','source_page'])},page_sections:{read:permit(),update:permit()},directus_files:{read:permit()} };
const metadata = ['id','status','title','slug','page_type','h1','eyebrow','intro','seo_title','seo_description','seo_text','og_image','canonical_url','is_indexable','seo','translations','created_at','updated_at'].map(field=>({field,type:['seo','translations'].includes(field)?'json':field==='is_indexable'?'boolean':'string',schema:{is_nullable:!['title','slug','status','page_type','h1'].includes(field),default_value:field==='status'?'draft':field==='is_indexable'?true:null},meta:{required:['title','slug','status','page_type','h1'].includes(field),readonly:['id','created_at','updated_at'].includes(field),options:field==='status'?{choices:['draft','published','archived'].map(value=>({value}))}:field==='page_type'?{choices:['standard','about','delivery','contacts','privacy_policy','thank_you','home','catalog','articles'].map(value=>({value}))}:null}}));
const initial = {id:'own-page',updated_at:null,created_at:null,status:'draft',title:'Before',slug:'own-page',page_type:'standard',h1:'Heading',eyebrow:null,intro:null,seo_title:null,seo_description:null,seo_text:null,og_image:null,canonical_url:null,is_indexable:true,seo:{unknown:{keep:true}},translations:null};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function fixture(options={}) {
  let record={...structuredClone(initial),...options.record}; const calls=[];
  const api={calls,get record(){return record;},set record(v){record=v;},async get(path,config={}) {
    calls.push({method:'GET',path,config});
    if(options.get){const r=await options.get(path,config);if(r!==undefined)return r;}
    if(path==='/collections/pages')return response({collection:'pages',meta:{singleton:false,versioning:true}});
    if(path==='/fields/pages')return response(options.metadata??metadata);
    if(path==='/permissions/me')return response(options.permissions??permissions);
    if(path.startsWith('/permissions/me/pages/'))return response({update:{access:options.itemUpdate??true}});
    if(path==='/items/home_page')return response({id:'home',source_page:options.sourcePage??'other'});
    if(path==='/fields/page_sections')return response([]);
    if(path==='/items/pages')return {data:{data:options.rows??[],meta:{filter_count:options.count??0}}};
    if(path.startsWith('/items/pages/'))return response(structuredClone(record));
    throw Error(`unexpected GET ${path}`);
  },async post(path,body){calls.push({method:'POST',path,body});if(options.post)return options.post(path,body);record={...record,...body.changes,updated_at:'v2'};return response(record);}};
  return api;
}
const posts=api=>api.calls.filter(c=>c.method==='POST');
const open=async(api=fixture(),options={})=>{const c=createPageController(api,options);assert.equal((await c.open('own-page')).ok,true);return c;};

test('server query uses bounded filtered count, three search fields, all filters and stable sort',()=>{
 const q=buildPagesQuery({page:3,search:' needle ',sort:'-title',filters:{status:'draft',page_type:'standard',is_indexable:'false'}});
 assert.equal(q.limit,25);assert.equal(q.offset,50);assert.equal(q.sort,'-title,id');assert.equal(q.meta,'filter_count');assert.equal(q.search,undefined);
 assert.deepEqual(q.filter._and,[{_or:[{title:{_icontains:'needle'}},{slug:{_icontains:'needle'}},{h1:{_icontains:'needle'}}]},{status:{_eq:'draft'}},{page_type:{_eq:'standard'}},{is_indexable:{_eq:false}}]);
 for(const field of ['title','slug','page_type','status','updated_at'])for(const prefix of ['','-'])assert.equal(buildPagesQuery({sort:prefix+field}).sort,prefix+field+',id');
 assert.throws(()=>buildPagesQuery({page:0}));assert.throws(()=>buildPagesQuery({sort:'secret'}));assert.throws(()=>buildPagesQuery({filters:{status:'secret'}}));
});
test('permission parsing fails closed on missing/malformed/partial-create and requires item update',()=>{
 assert.deepEqual(pagePermissions({}),{read:[],update:[],create:[]});
 const p=pagePermissions({pages:{read:permit(['id','title'],'partial'),update:permit(),create:permit(['title'],'partial')}},{update:{access:false}});
 assert.deepEqual(p,{read:['id','title'],update:[],create:[]});
 assert.deepEqual(pagePermissions({pages:{read:{access:'full',fields:'*'}}}).read,[]);
});
test('list ignores delayed responses and resets to page one for search and filters',async()=>{
 const waits=[];const api=fixture({get:(path,config)=>path==='/items/pages'?new Promise(resolve=>waits.push({resolve,config})):undefined});
 const c=createPageListController(api);const first=c.open();while(waits.length<1)await new Promise(r=>setImmediate(r));
 const latest=c.query({search:'latest',page:2});while(waits.length<2)await new Promise(r=>setImmediate(r));
 assert.equal(waits[1].config.params.offset,0);
 waits[1].resolve({data:{data:[initial],meta:{filter_count:1}}});await latest;
 waits[0].resolve({data:{data:[{...initial,title:'stale'}],meta:{filter_count:50}}});await first;
 assert.equal(c.snapshot().rows[0].title,'Before');assert.equal(c.snapshot().total,1);
 const filtered=c.query({filters:{status:'draft'},page:2});while(waits.length<3)await new Promise(r=>setImmediate(r));assert.equal(waits[2].config.params.offset,0);waits[2].resolve({data:{data:[],meta:{filter_count:0}}});await filtered;assert.equal(c.snapshot().total,0);
});
test('list has separate denied, error and empty states; failed permissions never enable create',async()=>{
 for(const effective of [{}, {pages:{read:permit([],'none')}}]){const c=createPageListController(fixture({permissions:effective}));await c.open();assert.equal(c.snapshot().denied,true);assert.equal(c.snapshot().canCreate,false);}
 const good=createPageListController(fixture());await good.open();assert.equal(good.snapshot().rows.length,0);assert.equal(good.snapshot().error,null);assert.equal(good.snapshot().canCreate,true);
 const bad=createPageListController(fixture({get:path=>{if(path==='/items/pages')throw Error('offline');}}));await bad.open();assert.ok(bad.snapshot().error);assert.equal(bad.snapshot().denied,false);
});
test('list disposal invalidates responses, and invalid list shape never masquerades as empty',async()=>{
 const wait=deferred();const c=createPageListController(fixture({get:path=>path==='/items/pages'?wait.promise:undefined}));const p=c.open();await new Promise(r=>setImmediate(r));c.dispose();wait.resolve({data:{data:[initial],meta:{filter_count:1}}});await p;assert.deepEqual(c.snapshot().rows,[]);
 const invalid=createPageListController(fixture({get:path=>path==='/items/pages'?response({}):undefined}));await invalid.open();assert.ok(invalid.snapshot().error);
});
test('validation respects required fields, choices, canonical URLs and local route conflicts',()=>{
 assert.equal(validatePage(initial,metadata).length,0);
 for(const slug of ['catalog','articles','api','admin','request','robots.txt','sitemap.xml','a/b','a b'])assert.ok(validatePage({...initial,slug},metadata).some(e=>e.field==='slug'),slug);
 const e=validatePage({...initial,title:' ',h1:'',page_type:'home',canonical_url:'javascript:alert(1)'},metadata);
 assert.deepEqual(new Set(e.map(e=>e.field)),new Set(['title','h1','page_type','canonical_url']));
 assert.ok(pageRouteContext({...initial,slug:'about'}).fallback);assert.equal(pageRouteContext({...initial,slug:'own-page'}).path,'/own-page');assert.equal(pageRouteContext({...initial,slug:'catalog'}).path,null);
});
test('CAS keeps all tabs, only changed allowed fields, and refetches hook projections',async()=>{
 const api=fixture({post:async(path,body)=>{api.record={...api.record,...body.changes,seo:{projected:true},updated_at:'v2'};return response({...api.record});}});const c=await open(api);
 c.change('title','Local');c.change('seo_title','SEO');c.change('translations',{en:'Keep'});
 assert.equal(c.change('sections',[1]),false);assert.equal(c.change('id','bad'),false);assert.equal(c.change('status','published'),false);
 assert.equal((await c.save()).ok,true);
 assert.deepEqual(posts(api)[0].body,{expected:{id:'own-page',updated_at:null,title:'Before',seo_title:null,translations:null},changes:{title:'Local',seo_title:'SEO',translations:{en:'Keep'}}});
 assert.equal(posts(api)[0].path,'/commerce/mutations/pages/own-page');assert.deepEqual(c.snapshot().values.seo,{projected:true});assert.equal(c.snapshot().parentDirty,false);
});
test('published save requires explicit UI intent, leaves status unchanged and announces saving immediately',async()=>{
 const wait=deferred(),seen=[];const api=fixture({record:{status:'published'},post:()=>wait.promise});const c=await open(api,{onChange:s=>seen.push(s)});c.change('h1','Local');assert.equal((await c.save()).reason,'confirmation');assert.equal(posts(api).length,0);
 const pending=c.save({confirmPublished:true});assert.equal(c.snapshot().saving,true);assert.ok(seen.at(-1).saving);await c.save({confirmPublished:true});assert.equal(posts(api).length,1);assert.deepEqual(posts(api)[0].body.changes,{h1:'Local'});api.record={...api.record,h1:'Local',updated_at:'v2'};wait.resolve(response(api.record));await pending;assert.equal(c.snapshot().saving,false);
});
test('409/timeout/incomplete ack preserve edits and require compare before reconciliation',async(t)=>{
 for(const kind of ['409','timeout','incomplete'])await t.test(kind,async()=>{const api=fixture({post:async()=>{if(kind==='incomplete')return response({id:'own-page'});throw Object.assign(Error(kind),{response:{status:kind==='409'?409:504}});}});const c=await open(api);c.change('h1','Keep');await c.save();assert.equal(c.snapshot().values.h1,'Keep');assert.equal(c.snapshot().writeUncertain,true);assert.equal(c.snapshot().conflict,kind==='409');await c.save();assert.equal(posts(api).length,1);assert.equal((await c.reconcile(true)).ok,false);await c.compare();await c.reconcile(true);assert.equal(c.snapshot().values.h1,'Keep');assert.equal(c.snapshot().writeUncertain,false);});
});
test('failed refetch after successful mutation blocks another write and retains acknowledged values',async()=>{
 let fail=false;const api=fixture({get:path=>{if(fail&&path.startsWith('/items/pages/'))throw Error('offline');},post:async(_path,body)=>{fail=true;return response({...initial,...body.changes,updated_at:'v2'});}});const c=await open(api);c.change('title','Committed');const r=await c.save();assert.equal(r.committed,true);assert.equal(c.snapshot().values.title,'Committed');assert.equal(c.snapshot().canSave,false);assert.ok(c.snapshot().readError);await c.save();assert.equal(posts(api).length,1);
});
test('child save never saves parent; stale parent retains edits until explicit reconcile',async()=>{
 const api=fixture();const c=await open(api);c.change('title','Parent edit');c.childState({dirty:true,saving:false});assert.equal(c.snapshot().dirty,true);api.record={...api.record,updated_at:'child-v2'};c.childState({dirty:false,saving:false,saved:true});assert.equal(c.snapshot().parentStale,true);assert.equal(c.snapshot().values.title,'Parent edit');assert.equal(c.snapshot().canSave,false);assert.equal(posts(api).length,0);await c.compare();await c.reconcile(true);assert.equal(c.snapshot().values.title,'Parent edit');assert.equal(c.snapshot().baseline.updated_at,'child-v2');await c.save();assert.equal(posts(api).length,1);
});
test('parent cancel discards only parent edits without requiring conflict comparison',async()=>{
 const api=fixture();const c=await open(api);c.change('title','Parent edit');c.childState({dirty:true,saving:false});
 const result=await c.discardChanges();
 assert.equal(result.ok,true);assert.equal(c.snapshot().values.title,initial.title);assert.equal(c.snapshot().parentDirty,false);assert.equal(c.snapshot().childDirty,true);assert.equal(posts(api).length,0);
});
test('status is an isolated CAS operation and rejects dirty parent or child state',async()=>{
 const api=fixture();const c=await open(api);c.change('h1','Parent edit');assert.equal((await c.setStatus('published',{confirmed:true})).ok,false);c.change('h1',initial.h1);c.childState({dirty:true});assert.equal((await c.setStatus('published',{confirmed:true})).ok,false);c.childState({dirty:false});assert.equal((await c.setStatus('published')).ok,false);assert.equal((await c.setStatus('published',{confirmed:true})).ok,true);assert.deepEqual(posts(api)[0].body,{expected:{id:'own-page',updated_at:null,status:'draft'},changes:{status:'published'}});
});
test('status uncertain response keeps the confirmed baseline and blocks repeat until reconciliation',async()=>{
 const api=fixture({post:async()=>{throw Error('lost status response');}});const c=await open(api);await c.setStatus('archived',{confirmed:true});assert.equal(c.snapshot().writeUncertain,true);assert.equal(c.snapshot().values.status,'draft');await c.setStatus('archived',{confirmed:true});assert.equal(posts(api).length,1);
});
test('home source and system types are readonly; unverifiable source ownership fails closed',async()=>{
 for(const options of [{sourcePage:'own-page'},{record:{page_type:'home'}},{get:path=>{if(path==='/items/home_page')throw Error('unavailable');}},{permissions:{...permissions,home_page:{read:permit([],'none')}}}]){const api=fixture(options),c=await open(api);assert.equal(c.snapshot().readonly,true);assert.equal(c.change('title','bad'),false);await c.save();assert.equal(posts(api).length,0);}
});
test('field/item permissions and native readonly metadata are enforced before mutations',async()=>{
 for(const options of [{itemUpdate:false},{permissions:{...permissions,pages:{read:permit(),update:permit([],'none')}}},{metadata:metadata.map(f=>f.field==='title'?{...f,meta:{...f.meta,readonly:true}}:f)}]){const api=fixture(options),c=await open(api);assert.equal(c.change('title','bad'),false);}
 const api=fixture({permissions:{...permissions,pages:{read:permit(['id','updated_at','status','page_type','slug','h1'],'partial'),update:permit(['h1'],'partial')}}});const c=await open(api);assert.equal(c.change('h1','Only permitted'),true);await c.save();assert.deepEqual(posts(api)[0].body.changes,{h1:'Only permitted'});
});
test('missing item or absent version produces read error and no editable baseline',async()=>{
 for(const value of [null,{id:'own-page'},{...initial,id:'wrong'}]){const api=fixture({get:path=>path.startsWith('/items/pages/')?response(value):undefined});const c=createPageController(api);assert.equal((await c.open('own-page')).ok,false);assert.equal(c.snapshot().readonly,true);}
});
test('older opens cannot replace current metadata, identity or values',async()=>{
 const wait=deferred();const api=fixture({get:path=>path==='/items/pages/slow'?wait.promise:undefined});const c=createPageController(api);const first=c.open('slow');await new Promise(r=>setImmediate(r));await c.open('own-page');wait.resolve(response({...initial,id:'slow',title:'Old'}));await first;assert.equal(c.snapshot().baseline.id,'own-page');assert.equal(c.snapshot().values.title,'Before');
});
test('native create sends draft+standard, keeps manual slug and blocks double submit',async()=>{
 const wait=deferred();const api=fixture({post:()=>wait.promise});const c=createPageController(api);assert.equal((await c.open('+')).ok,true);assert.equal(c.snapshot().values.status,'draft');assert.equal(c.snapshot().values.page_type,'standard');c.change('title','New Page');assert.equal(c.snapshot().values.slug,'new-page');c.change('slug','manual');c.change('title','Another');assert.equal(c.snapshot().values.slug,'manual');c.change('h1','H1');const p=c.save();await c.save();assert.equal(posts(api).length,1);assert.equal(posts(api)[0].path,'/items/pages');assert.equal(posts(api)[0].body.status,'draft');assert.equal(posts(api)[0].body.page_type,'standard');assert.equal(Object.hasOwn(posts(api)[0].body,'id'),false);wait.resolve(response({id:'created',status:'draft',page_type:'standard',slug:'manual'}));const r=await p;assert.equal(r.createdId,'created');assert.equal(c.snapshot().canSave,false);
});
test('create required fields and definite unique errors retain input and permit corrected submit',async()=>{
 const api=fixture({post:async()=>{throw Object.assign(Error('unique'),{response:{status:400,data:{errors:[{extensions:{code:'RECORD_NOT_UNIQUE',field:'slug'}}]}}});}});const c=createPageController(api);await c.open('+');c.change('title','New');await c.save();assert.equal(posts(api).length,0);assert.ok(c.snapshot().validation.some(e=>e.field==='h1'));c.change('h1','H1');await c.save();assert.equal(c.snapshot().writeUncertain,false);assert.ok(c.snapshot().validation.some(e=>e.field==='slug'));assert.equal(c.snapshot().values.title,'New');c.change('slug','corrected');assert.equal(c.snapshot().canSave,true);
});
test('unknown create locks form, exact-slug recovery neither adopts nor deletes found records',async()=>{
 const api=fixture({rows:[{...initial,slug:'new-page'}],post:async()=>{throw Error('lost create response');}});const c=createPageController(api);await c.open('+');c.change('title','New Page');c.change('h1','H1');await c.save();assert.equal(c.snapshot().writeUncertain,true);assert.equal(c.change('slug','other'),false);await c.save();assert.equal(posts(api).length,1);await c.recoverCreate();const q=api.calls.filter(c=>c.path==='/items/pages').at(-1).config.params;assert.equal(q.limit,2);assert.deepEqual(q.filter,{slug:{_eq:'new-page'}});assert.equal(c.snapshot().recovery.records[0].id,'own-page');assert.equal(c.snapshot().createdId,null);assert.equal(c.snapshot().saved,false);
});
test('creation fails closed without full create fields or native draft/standard choices',async()=>{
 for(const options of [{permissions:{...permissions,pages:{read:permit(),create:permit(['title','slug'],'partial')}}},{metadata:metadata.filter(f=>f.field!=='h1')},{metadata:metadata.map(f=>f.field==='status'?{...f,meta:{...f.meta,options:{choices:[{value:'published'}]}}}:f)}]){const c=createPageController(fixture(options));assert.equal((await c.open('+')).ok,false);assert.equal(c.snapshot().canSave,false);}
});
test('source/dist pages remain identical',async()=>assert.deepEqual(await readFile(new URL('../../src/sections/pages.js',import.meta.url)),await readFile(new URL('../../dist/sections/pages.js',import.meta.url))));

test('native title delta suggests slug without treating omitted slug as a manual edit',async()=>{
 const c=createPageController(fixture());await c.open('+');c.changeTab(['title','slug','page_type'],{title:'New Page'});assert.equal(c.snapshot().values.slug,'new-page');c.changeTab(['title','slug','page_type'],{title:'Second Page',slug:'new-page'});assert.equal(c.snapshot().values.slug,'second-page');c.changeTab(['title','slug','page_type'],{title:'Second Page',slug:'manual'});c.changeTab(['title','slug','page_type'],{title:'Third Page',slug:'manual'});assert.equal(c.snapshot().values.slug,'manual');
});
test('an uncertain status action remains guarded even when parent content has no dirty fields',async()=>{
 const c=await open(fixture({post:async()=>{throw Error('timeout');}}));await c.setStatus('published',{confirmed:true});assert.equal(c.snapshot().dirty,true);
});
test('missing required route/status projections block editing even with claimed read permissions',async()=>{
 for(const field of ['slug','page_type','status']){const record={...initial};delete record[field];const c=createPageController(fixture({get:path=>path.startsWith('/items/pages/')?response(record):undefined}));assert.equal((await c.open('own-page')).ok,false);assert.equal(c.snapshot().readonly,true);}
});


const findNode=(node,predicate)=>{if(!node||typeof node!=="object")return null;if(predicate(node))return node;for(const child of Array.isArray(node)?node:Array.isArray(node.children)?node.children:node.children?[node.children]:[]){const found=findNode(child,predicate);if(found)return found;}return null;};
test('view reports unsaved child edits through the actual shared toolbar',async()=>{
 globalThis.__a3Api=fixture();
 const editor=PagesSection.setup({id:'own-page'})().type;
 const render=editor.setup({id:'own-page'});
 await new Promise(r=>setImmediate(r));
 const shellView=render(),main=shellView.children.main();
 const tabs=findNode(main,n=>n.type?.name==='SectionTabs');
 const child=findNode(tabs.children.default(),n=>n.type?.name==='PageSectionEditor');
 child.props.onStateChange({dirty:true,saving:false});
 const toolbar=render().children.toolbar();
 const renderedToolbar=toolbar.type.setup(toolbar.props,{emit(){},slots:{}})();
 assert.ok(JSON.stringify(renderedToolbar).includes('Есть несохранённые изменения.'));
 assert.equal(JSON.stringify(renderedToolbar).includes('Все изменения сохранены.'),false);
});
test('parent cancel keeps the child section editor mounted during its parent-only reload',async()=>{
 const api=fixture();globalThis.__a3Api=api;
 const editor=PagesSection.setup({id:'own-page'})().type,render=editor.setup({id:'own-page'});
 await new Promise(r=>setImmediate(r));
 let entered,release;const readStarted=new Promise(resolve=>entered=resolve),readResult=new Promise(resolve=>release=resolve);let gate=false;
 const originalGet=api.get.bind(api);api.get=async(path,config)=>{if(gate&&path==='/items/pages/own-page'){gate=false;entered();await readResult;}return originalGet(path,config);};
 let shell=render(),tabs=findNode(shell.children.main(),n=>n.type?.name==='SectionTabs');
 tabs.props['onUpdate:modelValue']('main');shell=render();
 const mainTabs=findNode(shell.children.main(),n=>n.type?.name==='SectionTabs');
 const group=findNode(mainTabs.children.default(),n=>Array.isArray(n.props?.fieldSubset)&&n.props.fieldSubset.includes('title'));
 assert.ok(group,'the page title field group should be rendered');
 group.props['onUpdate:modelValue']({title:'Changed title'});
 shell=render();tabs=findNode(shell.children.main(),n=>n.type?.name==='SectionTabs');tabs.props['onUpdate:modelValue']('sections');shell=render();
 assert.ok(findNode(findNode(shell.children.main(),n=>n.type?.name==='SectionTabs').children.default(),n=>n.type?.name==='PageSectionEditor'));
 shell.children.toolbar({requestDiscard:async()=>true,requestCancel:async()=>false});gate=true;
 const cancelled=shell.props.onCancel();await readStarted;
 shell=render();
 assert.ok(findNode(findNode(shell.children.main(),n=>n.type?.name==='SectionTabs').children.default(),n=>n.type?.name==='PageSectionEditor'),'the saved child editor instance must remain mounted while only the parent reloads');
 release(response(api.record));await cancelled;delete globalThis.__a3Api;
});
test('guarded top-level unique/validation errors annotate native fields and retain reconciliation lock',async()=>{
 for(const [code,field] of [['RECORD_NOT_UNIQUE','slug'],['FAILED_VALIDATION','h1']]){
 const api=fixture({post:async()=>{throw Object.assign(Error(code),{response:{status:409,data:{errors:[{code,extensions:{field}}]}}});}}),c=await open(api);c.change(field,'already-used');await c.save();assert.ok(c.snapshot().validation.some(e=>e.field===field));assert.equal(c.snapshot().writeUncertain,true);assert.equal(c.snapshot().conflict,false);assert.equal(c.snapshot().values[field],'already-used');await c.save();assert.equal(posts(api).length,1);
 }
});
test('conflicting scalar and native SEO projections are rejected before update or create without losing input',async()=>{
 const projections=[['seo_title','Changed title',{title:'Old title'}],['seo_description','Changed description',{meta_description:'Old description'}],['og_image','new-id',{og_image:'old-id'}],['canonical_url','/new',{additional_fields:{canonical_url:'/old'}}],['is_indexable',false,{no_index:false}]];
 for(const creating of [false,true])for(const [field,value,seo] of projections){
  const api=fixture(),c=createPageController(api);await c.open(creating?'+':'own-page');if(creating){c.change('title','New');c.change('h1','H1');}
  c.change(field,value);c.change('seo',{...seo,no_follow:true});const result=await c.save();assert.equal(result.reason,'validation',JSON.stringify({creating,field,result,validation:c.snapshot().validation,values:c.snapshot().values,baseline:c.snapshot().baseline}));assert.equal(posts(api).length,0);assert.ok(c.snapshot().validation.some(e=>e.field===field));assert.deepEqual(c.snapshot().values[field],value);assert.deepEqual(c.snapshot().values.seo,{...seo,no_follow:true});
 }
});
test('compatible native JSON and scalar edits survive the existing production SEO hook',async()=>{
 const {synchronizeSeoPayload}=await import('../../../commerce-integrity/src/index.js');
 const api=fixture({record:{seo_title:'Old title',seo:{title:'Old title',no_follow:false}},post:async(_path,body)=>{api.record={...api.record,...synchronizeSeoPayload(body.changes,api.record,'pages'),updated_at:'v2'};return response(api.record);}}),c=await open(api);
 c.change('seo_title','New title');c.change('seo',{title:'New title',no_follow:true});assert.equal((await c.save()).ok,true);assert.equal(c.snapshot().values.seo_title,'New title');assert.equal(c.snapshot().values.seo.no_follow,true);assert.equal(c.snapshot().parentDirty,false);
 c.change('seo_title','Newer title');assert.equal((await c.save()).ok,true);assert.equal(api.record.seo_title,'Newer title');assert.equal(api.record.seo.title,'Newer title');
});
test('native SEO hydration defaults do not block scalar edits or overwrite them through the JSON-first hook',async()=>{
 const {synchronizeSeoPayload}=await import('../../../commerce-integrity/src/index.js');
 const baselineSeo=null;
 const api=fixture({record:{seo_title:'Old title',seo_description:'Old description',seo:baselineSeo},post:async(_path,body)=>{api.record={...api.record,...synchronizeSeoPayload(body.changes,api.record,'pages'),updated_at:'v2'};return response(api.record);}}),c=await open(api);
 // Directus' native interface normalizes missing keys as it hydrates the JSON field.
 const nativeInitial=pageSeoInterfaceInitialValues(c.snapshot().baseline);assert.equal(nativeInitial.title,'Old title');assert.equal(nativeInitial.meta_description,'Old description');
 c.change('seo',{...nativeInitial,no_index:false,additional_fields:{canonical_url:null}});
 c.change('seo_title','New title');c.change('seo_description','New description');c.change('og_image','file-id');c.change('is_indexable',false);c.change('canonical_url','/new-canonical');
 const saved=await c.save();assert.equal(saved.ok,true,JSON.stringify({saved,validation:c.snapshot().validation,values:c.snapshot().values,baseline:c.snapshot().baseline}));
 assert.equal(posts(api).length,1);
 assert.equal(posts(api)[0].body.changes.seo.title,'New title');
 assert.equal(posts(api)[0].body.changes.seo.meta_description,'New description');
 assert.equal(posts(api)[0].body.changes.seo.og_image,'file-id');
 assert.equal(posts(api)[0].body.changes.seo.no_index,true);
 assert.equal(posts(api)[0].body.changes.seo.additional_fields.canonical_url,'/new-canonical');
 assert.equal(api.record.seo_title,'New title');
 assert.equal(api.record.seo.title,'New title');
 assert.equal(api.record.seo_description,'New description');assert.equal(api.record.og_image,'file-id');assert.equal(api.record.is_indexable,false);assert.equal(api.record.canonical_url,'/new-canonical');
 assert.equal(c.snapshot().parentDirty,false);
});
test('native SEO interface initial values seed missing projections but preserve explicit empties and unknown JSON',()=>{
 const values={seo:{title:'',meta_description:'',og_image:null,no_index:false,no_follow:true,additional_fields:{canonical_url:''},custom:{keep:true}},seo_title:'Legacy title',seo_description:'Legacy description',og_image:'legacy-file',canonical_url:'/legacy',is_indexable:true};
 const initial=pageSeoInterfaceInitialValues(values);
 assert.equal(initial.title,'');assert.equal(initial.meta_description,'');assert.equal(initial.og_image,'');assert.equal(initial.additional_fields.canonical_url,'');
 assert.equal(initial.no_index,false);assert.equal(initial.no_follow,true);assert.deepEqual(initial.custom,{keep:true});
 const missing=pageSeoInterfaceInitialValues({seo:null,seo_title:'Legacy title',seo_description:'Legacy description',og_image:'legacy-file',canonical_url:'/legacy',is_indexable:false});
 assert.equal(missing.title,'Legacy title');assert.equal(missing.meta_description,'Legacy description');assert.equal(missing.og_image,'legacy-file');assert.equal(missing.no_index,true);assert.equal(missing.additional_fields.canonical_url,'/legacy');
});
test('native draft creation synchronizes hydrated SEO JSON with scalar fields before the production hook',async()=>{
 const {synchronizeSeoPayload}=await import('../../../commerce-integrity/src/index.js');
 const api=fixture({post:async(path,body)=>{assert.equal(path,'/items/pages');const projected=synchronizeSeoPayload(body,{},'pages');return response({...projected,id:'created-page',updated_at:'created-v1'});}}),c=createPageController(api);
 assert.equal((await c.open('+')).ok,true);c.change('title','Created SEO page');c.change('h1','Created SEO heading');
 c.change('seo',pageSeoInterfaceInitialValues(c.snapshot().baseline));c.change('seo_title','Created SEO title');
 const result=await c.save();assert.equal(result.createdId,'created-page');
 assert.equal(posts(api).length,1);assert.equal(posts(api)[0].body.seo.title,'Created SEO title');assert.equal(posts(api)[0].body.seo.meta_description,'');
});
