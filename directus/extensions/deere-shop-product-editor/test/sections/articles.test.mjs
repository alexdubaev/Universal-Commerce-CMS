import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const uri = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const vue = uri('export const defineComponent=x=>x; export const h=()=>({}); export const ref=x=>({value:x}); export const computed=x=>x; export const watch=()=>{}; export const onMounted=()=>{}; export const onUnmounted=()=>{}; export const resolveComponent=x=>x;');
const router = uri('export const onBeforeRouteLeave=()=>{}; export const onBeforeRouteUpdate=()=>{}; export const useRouter=()=>({push(){}});');
const sdk = uri('export const useApi=()=>({}); export const useStores=()=>({});');
const rewrite = source => source.replaceAll('"vue"', JSON.stringify(vue)).replaceAll('"vue-router"', JSON.stringify(router)).replaceAll('"@directus/extensions-sdk"', JSON.stringify(sdk));
const shellSource = await readFile(new URL('../../src/admin-shell.js', import.meta.url), 'utf8');
const shell = uri(rewrite(shellSource));
const source = await readFile(new URL('../../src/sections/articles.js', import.meta.url), 'utf8');
const distSource = await readFile(new URL('../../dist/sections/articles.js', import.meta.url), 'utf8');
const adminState = new URL('../../src/admin-state.mjs', import.meta.url).href;
const moduleUrl = uri(rewrite(source).replaceAll('"../admin-shell.js"', JSON.stringify(shell)).replaceAll('"../admin-state.mjs"', JSON.stringify(adminState)));
const { buildArticlesQuery, articlePermissions, validateArticle, parseArticleDate, createArticlesController, createArticleRelationsController, articleSeoScalarValues, articleSeoDisplayValues, articlePublicationState, createNativeEditAuthorization, articleComparisonRows } = await import(moduleUrl);

const required = ['title','slug','excerpt','content','published_at'];
const metadata = ['id','updated_at','created_at','status','title','slug','excerpt','content','content_blocks','editor_nodes','cover_image','image_alt','published_at','category_label','reading_time_minutes','author','reviewer','sources','related_categories','related_products','is_featured','sort_order','seo_title','seo_description','og_image','seo','translations'].map(field => ({
  field, type: ['content_blocks','sources','related_categories','related_products','seo','translations'].includes(field) ? 'json' : field === 'editor_nodes' ? 'alias' : field === 'published_at' ? 'timestamp' : field === 'is_featured' ? 'boolean' : ['reading_time_minutes','sort_order'].includes(field) ? 'integer' : ['excerpt','content'].includes(field) ? 'text' : 'string',
  schema: { is_nullable: !required.includes(field), default_value: field === 'status' ? 'draft' : field === 'is_featured' ? false : null, max_length: field === 'slug' ? 255 : 255, is_generated: false },
  meta: { required: required.includes(field), readonly: ['id','created_at','updated_at','editor_nodes'].includes(field), interface: field === 'content' ? 'input-rich-text-html' : field === 'editor_nodes' ? 'select-dropdown-m2o' : 'input', options: field === 'status' ? { choices: ['draft','published','archived'].map(value => ({ value })) } : null },
}));
const article = { id:'article-1', updated_at:null, created_at:'created', status:'draft', title:'До', slug:'до-статьи', excerpt:'Описание', content:'<p data-x="1">Исходный HTML</p>', content_blocks:{type:'doc',content:[{type:'paragraph'}]}, editor_nodes:[{id:'node-1'}], cover_image:'file-1', image_alt:'Обложка', published_at:'2026-10-18T10:00:00.000Z', category_label:'Новости', reading_time_minutes:4, author:null, reviewer:null, sources:{keep:['source']}, related_categories:['cat-1','legacy-category'], related_products:['product-1'], is_featured:false, sort_order:0, seo_title:null, seo_description:null, og_image:null, seo:{title:'legacy title', custom:{keep:true}}, translations:{ru:{title:'Статья'} } };
function apiFixture({ permissions, itemPermission, post, rows = [article], item = article } = {}) {
  const calls=[];
  const effective = permissions ?? { articles:{read:{access:'full',fields:['*']},create:{access:'full',fields:['*']},update:{access:'full',fields:['*']}}, directus_files:{read:{access:'full',fields:['*']}} };
  return { calls, async get(path, config={}) { calls.push(['GET',path,config]);
    if(path==='/fields/articles') return {data:{data:metadata}};
    if(path==='/permissions/me') return {data:{data:effective}};
    if(path.startsWith('/permissions/me/articles/')) return {data:{data:itemPermission ?? {update:{access:true,fields:['*']}}}};
    if(path==='/items/articles') return {data:{data:rows,meta:{filter_count:rows.length}}};
    if(path.startsWith('/items/articles/')) return {data:{data:item}};
    if(path==='/items/directus_files') return {data:{data:[]}};
    throw Error(`Unexpected GET ${path}`);
  }, async post(path, body) { calls.push(['POST',path,body]); if(post)return post(path,body);item={...item,...body.changes,updated_at:'v2'};return {data:{data:item}}; } };
}

test('server list query searches only title, slug and excerpt with bounded filters and stable sort', () => {
  const query=buildArticlesQuery({page:3,search:'  тема  ',sort:'-published_at',filters:{status:'published',category_label:'Техника',is_featured:'true'}});
  assert.equal(query.limit,25); assert.equal(query.offset,50); assert.equal(query.meta,'filter_count'); assert.equal(query.sort,'-published_at,id');
  assert.deepEqual(query.filter._and[0],{_or:['title','slug','excerpt'].map(field=>({[field]:{_icontains:'тема'}}))});
  assert.deepEqual(query.filter._and.slice(1),[{status:{_eq:'published'}},{category_label:{_eq:'Техника'}},{is_featured:{_eq:true}}]);
  assert.throws(()=>buildArticlesQuery({page:0})); assert.throws(()=>buildArticlesQuery({sort:'secret'})); assert.throws(()=>buildArticlesQuery({filters:{is_featured:'yes'}}));
});

test('effective permissions fail closed and creation requires required native fields plus draft default', () => {
  assert.deepEqual(articlePermissions({}),{read:[],update:[],create:[]});
  assert.deepEqual(articlePermissions({articles:{read:{access:'partial',fields:['id','updated_at','title']},create:{access:'partial',fields:['title','slug','excerpt','content','published_at','status']}}}),{read:['id','updated_at','title'],update:[],create:[]});
  const c=createArticlesController(apiFixture({permissions:{articles:{read:{access:'full',fields:['*']},create:{access:'full',fields:['*']},update:{access:'none',fields:[]}}}}));
  return c.openList().then(async()=>{assert.equal(c.listSnapshot().canCreate,true);assert.equal((await c.open('+')).ok,true);});
});

test('Unicode public slugs and required datetime validation preserve exact valid timestamps', () => {
  assert.equal(validateArticle({...article,slug:'статья-2'},metadata).length,0);
  assert.ok(validateArticle({...article,slug:'плохой/путь'},metadata).some(e=>e.field==='slug'));
  assert.ok(validateArticle({...article,published_at:null},metadata).some(e=>e.field==='published_at'));
  const missingTitle=validateArticle({...article,title:'  '},metadata).find(e=>e.field==='title');
  assert.equal(missingTitle.type,'FAILED_VALIDATION');
  assert.equal(missingTitle.reason,'required');
  assert.equal(parseArticleDate(article.published_at),article.published_at);
  assert.equal(parseArticleDate('2026-02-30T12:00:00+03:00'),null);
  assert.equal(parseArticleDate('2026-10-18T13:00:00+03:00'),'2026-10-18T10:00:00.000Z');
});

test('article comparison limits labels and values to safe business descriptions', () => {
  const rows = articleComparisonRows(
    { id: 'article-1', updated_at: 'old-version', title: 'Локальное название', related_categories: ['550e8400-e29b-41d4-a716-446655440000'], seo: { token: 'private' } },
    { id: 'article-1', updated_at: 'new-version', title: 'Сохранённое название', related_categories: [], seo: { token: 'changed' } },
  );
  assert.deepEqual(rows, [
    { field: 'title', label: 'Название статьи', own: 'Локальное название', remote: 'Сохранённое название' },
    { field: 'related_categories', label: 'Связанные категории', own: '1 связь', remote: 'Не указано' },
  ]);
});

test('article comparison turns HTML into bounded plain text without exposing markup', () => {
  const rows=articleComparisonRows({content:`<p><script>secret()</script>${'A'.repeat(220)}</p>`},{content:'<p>Saved <strong>copy</strong></p>'});
  assert.equal(rows[0].own.length,178);
  assert.equal(rows[0].own.includes('<'),false);
  assert.equal(rows[0].own.includes('secret()'),false);
  assert.equal(rows[0].remote,'Saved copy');
});

test('cancel discards ordinary article edits without requiring comparison or writing', async () => {
  const api = apiFixture();
  const controller = createArticlesController(api);
  assert.equal((await controller.open('article-1')).ok, true);
  assert.equal(controller.change('title', 'Локальное название'), true);
  const result = await controller.discardChanges();
  assert.equal(result.ok, true);
  assert.equal(controller.snapshot().values.title, article.title);
  assert.equal(controller.snapshot().dirty, false);
  assert.equal(api.calls.filter(([method]) => method === 'POST').length, 0);
});

test('cover-only save uses guarded CAS delta and leaves HTML, structural JSON, and SEO companion untouched', async () => {
  const api=apiFixture(); const c=createArticlesController(api); assert.equal((await c.open('article-1')).ok,true);
  assert.equal(c.change('cover_image','file-2'),true); assert.deepEqual(c.snapshot().values.content,article.content);
  assert.equal((await c.save()).ok,true);
  const call=api.calls.find(row=>row[0]==='POST'); assert.equal(call[1],'/commerce/mutations/articles/article-1');
  assert.deepEqual(call[2],{expected:{id:'article-1',updated_at:null,cover_image:'file-1'},changes:{cover_image:'file-2'}});
  assert.equal(Object.hasOwn(call[2].changes,'content'),false); assert.equal(Object.hasOwn(call[2].changes,'content_blocks'),false); assert.equal(Object.hasOwn(call[2].changes,'editor_nodes'),false); assert.equal(Object.hasOwn(call[2].changes,'seo'),false);
  assert.equal(c.snapshot().values.content,article.content); assert.deepEqual(c.snapshot().values.content_blocks,article.content_blocks); assert.deepEqual(c.snapshot().values.seo,article.seo);
});

test('native create posts only a validated draft once while request is pending', async () => {
  let release; const api=apiFixture({post:()=>new Promise(resolve=>{release=resolve;})}); const c=createArticlesController(api); await c.open('+');
  for(const [field,value] of [['title','Новая'],['slug','новая_статья'],['excerpt','Вводный текст'],['content','<p>Текст</p>'],['published_at','2026-10-18T10:00:00.000Z']]) assert.equal(c.change(field,value,field==='content'?{trustedFields:['content']}:{}),true);
  const first=c.save(); await new Promise(resolve=>setImmediate(resolve)); await c.save(); assert.equal(api.calls.filter(row=>row[0]==='POST').length,1);
  release({data:{data:{id:'created-1',status:'draft',title:'Новая',slug:'новая_статья',excerpt:'Вводный текст',content:'<p>Текст</p>',published_at:'2026-10-18T10:00:00.000Z'}}});
  assert.equal((await first).ok,true); assert.equal(api.calls.filter(row=>row[0]==='POST')[0][2].status,'draft');
  assert.equal(api.calls.filter(row=>row[0]==='POST')[0][1],'/items/articles');
});

test('incomplete CAS acknowledgement retains staged input and blocks another write', async () => {
  const api=apiFixture({post:async()=>({data:{data:{id:'article-1'}}})}); const c=createArticlesController(api); await c.open('article-1'); c.change('title','Локальный текст');
  assert.equal((await c.save()).ok,false); assert.equal(c.snapshot().writeUncertain,true); assert.equal(c.snapshot().values.title,'Локальный текст'); await c.save();
  assert.equal(api.calls.filter(row=>row[0]==='POST').length,1);
});

test('list controller debounces state through explicit queries and rejects stale responses', async () => {
  const pending=[]; const api=apiFixture(); api.get=async(path,config={})=>{ if(path==='/permissions/me')return {data:{data:{articles:{read:{access:'full',fields:['*']},create:{access:'none',fields:[]}}}}}; if(path==='/fields/articles')return {data:{data:metadata}}; if(path==='/items/articles')return new Promise(resolve=>pending.push({config,resolve})); throw Error(`Unexpected ${path}`); };
  const waitFor=async predicate=>{for(let i=0;i<50&&!predicate();i++)await new Promise(resolve=>setImmediate(resolve));assert.ok(predicate(),'list request started');};
  const c=createArticlesController(api); const opening=c.openList(); await waitFor(()=>pending.length===1);
  const newer=c.query({search:'new'}); await waitFor(()=>pending.length===2);
  pending[1].resolve({data:{data:[{...article,title:'new'}],meta:{filter_count:1}}}); await newer;
  pending[0].resolve({data:{data:[{...article,title:'stale'}],meta:{filter_count:1}}}); await opening;
  assert.equal(c.listSnapshot().rows[0].title,'new'); assert.deepEqual(pending[1].config.params.filter._and[0],{_or:['title','slug','excerpt'].map(field=>({[field]:{_icontains:'new'}}))}); assert.equal(pending[1].config.params.search,undefined); assert.equal(pending[1].config.params.limit,25);
});

test('unknown create result preserves draft input and forbids automatic retry', async () => {
  const api=apiFixture({post:async()=>{throw Error('network timeout');}}); const c=createArticlesController(api); await c.open('+');
  for(const [field,value] of [['title','Неизвестный результат'],['slug','неизвестный-результат'],['excerpt','Описание'],['content','<p>Материал</p>'],['published_at','2026-10-18T10:00:00.000Z']]) c.change(field,value,field==='content'?{trustedFields:['content']}:{});
  assert.equal((await c.save()).ok,false);assert.equal(c.snapshot().writeUncertain,true);assert.equal(c.snapshot().values.title,'Неизвестный результат');await c.save();assert.equal(api.calls.filter(row=>row[0]==='POST').length,1);
});

test('a true 409 keeps local input without misreporting a field validation error', async () => {
  const api=apiFixture({post:async()=>{throw Object.assign(Error('stale version'),{response:{status:409,data:{errors:[{code:'CONFLICT',message:'The record changed in another window.'}]}}});}});const c=createArticlesController(api);await c.open('article-1');c.change('title','Локальный вариант');
  assert.equal((await c.save()).ok,false);assert.equal(c.snapshot().conflict,true);assert.equal(c.snapshot().writeUncertain,true);assert.equal(c.snapshot().validation.length,0);assert.equal(c.snapshot().values.title,'Локальный вариант');await c.save();assert.equal(api.calls.filter(row=>row[0]==='POST').length,1);
});

test('native validation errors keep the field and staged input without showing backend messages', async () => {
  const api=apiFixture({post:async()=>{throw Object.assign(Error('internal error'),{response:{status:422,data:{errors:[{field:'published_at',message:'secret database detail'}]}}});}});const c=createArticlesController(api);await c.open('article-1');c.change('title','Keep this title');
  assert.equal((await c.save()).ok,false);assert.equal(c.snapshot().validation[0].field,'published_at');assert.match(c.snapshot().validation[0].message,/Дата публикации/);assert.doesNotMatch(c.snapshot().validation[0].message,/secret database detail/);assert.equal(c.snapshot().values.title,'Keep this title');
});
test('native content needs a trusted editor action and distribution stays byte-identical', async () => {
  assert.ok(distSource===source,'distributed article section must match source byte-for-byte');const c=createArticlesController(apiFixture());await c.open('article-1');assert.equal(c.change('content','<p>untrusted mount normalization</p>'),false);assert.equal(c.changeTab(['content'],{content:'<p>untrusted form echo</p>'}),false);assert.equal(c.snapshot().values.content,article.content);assert.equal(c.change('content','<p>edited by TinyMCE</p>',{trustedFields:['content']}),true);assert.equal(c.snapshot().values.content,'<p>edited by TinyMCE</p>');
});

test('status transition is an isolated guarded CAS and requires a clean baseline', async () => {
  const api=apiFixture();const c=createArticlesController(api);await c.open('article-1');c.change('title','Pending title');assert.equal((await c.transitionStatus('published')).ok,false);assert.equal(api.calls.filter(row=>row[0]==='POST').length,0);assert.equal((await c.save()).ok,true);const result=await c.transitionStatus('published');assert.equal(result.ok,true);const post=api.calls.filter(row=>row[0]==='POST').at(-1);assert.deepEqual(post[2],{expected:{id:'article-1',updated_at:'v2',status:'draft'},changes:{status:'published'}});
});

test('publishing requires readable nonempty public content while archive transition still accepts legacy block-only records', async () => {
  const legacy={...article,content:'',content_blocks:{type:'doc',content:[{type:'paragraph',content:[{text:'separate blocks'}]}]}};
  const api=apiFixture({item:legacy});const c=createArticlesController(api);await c.open('article-1');
  assert.equal((await c.transitionStatus('published')).ok,false);assert.equal(api.calls.filter(row=>row[0]==='POST').length,0);
  assert.equal(c.snapshot().baseline.content,'');assert.ok(c.snapshot().validation.some(error=>error.field==='content'));
  assert.match(c.snapshot().statusError.articleValidationMessage,/обязательное поле/);
  assert.equal((await c.transitionStatus('archived')).ok,true);assert.deepEqual(api.calls.find(row=>row[0]==='POST')[2].changes,{status:'archived'});
});

test('publishing is blocked if a required field cannot be read and accepts a valid future date', async () => {
  const denied={articles:{read:{access:'partial',fields:['id','updated_at','title','slug','excerpt','published_at']},update:{access:'full',fields:['*']}}};
  const api=apiFixture({permissions:denied,itemPermission:{update:{access:true,fields:['*']}},item:{...article,published_at:'2099-10-18T10:00:00.000Z'}});const c=createArticlesController(api);await c.open('article-1');
  assert.equal((await c.transitionStatus('published')).ok,false);assert.equal(api.calls.filter(row=>row[0]==='POST').length,0);
  assert.ok(c.snapshot().validation.some(error=>error.field==='content'&&error.type==='READ_REQUIRED_FOR_PUBLISH'));
  const full=apiFixture({item:{...article,published_at:'2099-10-18T10:00:00.000Z'}});const allowed=createArticlesController(full);await allowed.open('article-1');
  assert.equal((await allowed.transitionStatus('published')).ok,true);assert.deepEqual(full.calls.find(row=>row[0]==='POST')[2].changes,{status:'published'});
});

test('SEO scalar updates guard the JSON-first projection and preserve unknown SEO keys', async () => {
  const api=apiFixture();const c=createArticlesController(api);await c.open('article-1');assert.equal(c.change('seo_title','Новый заголовок SEO'),true);assert.equal((await c.save()).ok,true);const payload=api.calls.find(row=>row[0]==='POST')[2];assert.deepEqual(payload.changes,{seo_title:'Новый заголовок SEO',seo:{title:'Новый заголовок SEO',custom:{keep:true}}});assert.deepEqual(payload.expected.seo,article.seo);assert.deepEqual(c.snapshot().values.seo,{title:'Новый заголовок SEO',custom:{keep:true}});
});

test('related identifier edits preserve legacy string values in JSON arrays', async () => {
  const api=apiFixture();const c=createArticlesController(api);await c.open('article-1');assert.equal(c.change('related_categories',['cat-1','legacy-category','cat-2']),true);assert.equal((await c.save()).ok,true);const payload=api.calls.find(row=>row[0]==='POST')[2];assert.deepEqual(payload.changes,{related_categories:['cat-1','legacy-category','cat-2']});assert.deepEqual(c.snapshot().values.related_products,article.related_products);
});

test('legacy JSON-string relation containers survive unrelated and intentional saves', async () => {
  const original=JSON.stringify(['550e8400-e29b-41d4-a716-446655440000','legacy-entry',123]);
  const unknown={content_blocks:'legacy structure text',seo:'legacy SEO text',translations:'legacy translations text'};
  const unrelatedApi=apiFixture({item:{...article,...unknown,related_products:original}});const unrelated=createArticlesController(unrelatedApi);await unrelated.open('article-1');
  unrelated.change('excerpt','Updated excerpt');
  assert.equal((await unrelated.save()).ok,true);
  assert.equal(unrelatedApi.calls.find(row=>row[0]==='POST')[2].changes.related_products,undefined);
  assert.equal(unrelated.snapshot().values.content_blocks,unknown.content_blocks);
  assert.equal(unrelated.snapshot().values.seo,unknown.seo);
  assert.equal(unrelated.snapshot().values.translations,unknown.translations);

  const malformedApi=apiFixture({item:{...article,related_products:'unrecognized legacy value'}});const malformed=createArticlesController(malformedApi);await malformed.open('article-1');
  malformed.change('excerpt','Updated excerpt');
  assert.equal((await malformed.save()).ok,true);
  assert.equal(malformedApi.calls.find(row=>row[0]==='POST')[2].changes.related_products,undefined);

  const changedApi=apiFixture({item:{...article,related_products:original}});const changed=createArticlesController(changedApi);await changed.open('article-1');
  const next=JSON.stringify(['550e8400-e29b-41d4-a716-446655440000','legacy-entry',123,'new-entry']);
  assert.equal(changed.change('related_products',next),true);
  assert.equal((await changed.save()).ok,true);
  const body=changedApi.calls.find(row=>row[0]==='POST')[2];
  assert.equal(body.changes.related_products,next);
  assert.equal(typeof body.changes.related_products,'string');

  const invalidApi=apiFixture();const invalid=createArticlesController(invalidApi);await invalid.open('article-1');
  assert.equal(invalid.change('translations','malformed JSON',{trustedFields:['translations']}),true);
  assert.equal((await invalid.save()).reason,'validation');
  assert.equal(invalidApi.calls.filter(row=>row[0]==='POST').length,0);
});

test('SEO projection rejects contradictory scalar and native JSON edits and keeps unknown JSON keys', async () => {
  const api=apiFixture();const c=createArticlesController(api);await c.open('article-1');
  assert.equal(c.change('seo_title','Scalar title'),true);
  assert.equal(c.change('seo',{...article.seo,title:'Different JSON title',custom:{keep:true},new_key:'retained'},{trustedFields:['seo']}),true);
  const result=await c.save();assert.equal(result.ok,false);assert.equal(result.reason,'validation');
  assert.equal(api.calls.filter(row=>row[0]==='POST').length,0);
  assert.equal(c.snapshot().values.seo_title,'Scalar title');assert.deepEqual(c.snapshot().values.seo.custom,{keep:true});assert.equal(c.snapshot().values.seo.new_key,'retained');
});

test('SEO validation releases saving state so a corrected projection can be saved', async () => {
  const api=apiFixture();const c=createArticlesController(api);await c.open('article-1');
  c.change('seo_title','Scalar title');
  c.change('seo',{...article.seo,title:'Different JSON title'},{trustedFields:['seo']});
  assert.equal((await c.save()).reason,'validation');
  assert.equal(c.snapshot().saving,false);
  assert.equal(api.calls.filter(row=>row[0]==='POST').length,0);
  c.change('seo',{...article.seo,title:'Scalar title'},{trustedFields:['seo']});
  assert.equal((await c.save()).ok,true);
  assert.equal(api.calls.filter(row=>row[0]==='POST').length,1);
});

test('SEO display uses JSON-first projections and scalar edits retain unknown SEO keys', async () => {
  const item={...article,seo_title:'stale scalar',seo_description:'scalar description',seo:{title:'JSON title',meta_description:'',custom:{keep:true}}};
  assert.deepEqual(articleSeoScalarValues(item),{seo_title:'JSON title',seo_description:'',og_image:''});
  const api=apiFixture({item});const c=createArticlesController(api);await c.open('article-1');
  assert.equal(c.change('seo_title','Edited title'),true);assert.equal((await c.save()).ok,true);
  const payload=api.calls.find(row=>row[0]==='POST')[2];
  assert.deepEqual(payload.changes,{seo_title:'Edited title',seo:{title:'Edited title',meta_description:'',custom:{keep:true}}});
  assert.deepEqual(payload.expected.seo,item.seo);
  const fallbackApi=apiFixture({item});const fallback=createArticlesController(fallbackApi);await fallback.open('article-1');
  assert.equal(fallback.change('seo_title','stale scalar'),true);
  assert.equal(fallback.snapshot().dirty,true);
  assert.equal((await fallback.save()).ok,true);
  assert.deepEqual(fallbackApi.calls.find(row=>row[0]==='POST')[2].changes,{seo_title:'stale scalar',seo:{title:'stale scalar',meta_description:'',custom:{keep:true}}});
});

test('SEO display switches to an intentional scalar edit before save', () => {
  const item={...article,seo_title:'stale scalar',seo_description:'scalar description',seo:{title:'JSON title',meta_description:'JSON description'}};
  assert.deepEqual(articleSeoDisplayValues(item,item),{seo_title:'JSON title',seo_description:'JSON description',og_image:''});
  assert.deepEqual(articleSeoDisplayValues(item,{...item,seo_title:'Edited title'}),{seo_title:'Edited title',seo_description:'JSON description',og_image:''});
  assert.deepEqual(articleSeoDisplayValues(item,{...item,og_image:'file-next'}),{seo_title:'JSON title',seo_description:'JSON description',og_image:'file-next'});
});

test('selected article relations resolve independently with bounded readable fields and stale results ignored', async () => {
  const pending=[];const calls=[];const api={get(path,config={}){calls.push([path,config]);if(path==='/permissions/me')return Promise.resolve({data:{data:{products:{read:{access:'partial',fields:['id','title','sku']}}}}});return new Promise((resolve,reject)=>pending.push({path,config,resolve,reject}));}};
  const relations=createArticleRelationsController(api,{collection:'products',modelValue:['550e8400-e29b-41d4-a716-446655440000','legacy-product-slug']});
  const waitFor=async predicate=>{for(let i=0;i<50&&!predicate();i++)await new Promise(resolve=>setImmediate(resolve));assert.ok(predicate(),'relation request started');};
  const first=relations.resolve();await waitFor(()=>pending.length===1);
  assert.deepEqual(calls.find(([path])=>path==='/items/products')[1].params,{fields:'id,title,sku',limit:25,filter:{id:{_in:['550e8400-e29b-41d4-a716-446655440000']}}});
  const second=relations.setSelection(['550e8400-e29b-41d4-a716-446655440000','550e8400-e29b-41d4-a716-446655440001']);await waitFor(()=>pending.length===2);
  pending[0].resolve({data:{data:[{id:'550e8400-e29b-41d4-a716-446655440000',title:'Stale title'}]}});await first;
  pending[1].resolve({data:{data:[{id:'550e8400-e29b-41d4-a716-446655440000',title:'Permitted title',sku:'SKU-1'}]}});await second;
  assert.deepEqual(relations.snapshot().selected,[{value:'550e8400-e29b-41d4-a716-446655440000',label:'Permitted title · SKU-1',available:true,removable:true},{value:'550e8400-e29b-41d4-a716-446655440001',label:'Товар недоступен',available:false,removable:false},]);
  assert.equal(relations.remove('550e8400-e29b-41d4-a716-446655440001'),false);
  assert.deepEqual(relations.snapshot().values,['550e8400-e29b-41d4-a716-446655440000','550e8400-e29b-41d4-a716-446655440001']);
  assert.equal(relations.remove('550e8400-e29b-41d4-a716-446655440000'),true);
  assert.deepEqual(relations.snapshot().values,['550e8400-e29b-41d4-a716-446655440001']);
});

test('relation lookup filters invalid slugs, preserves selection on failure, retries, and ignores stale search responses', async () => {
  const pending=[],api={get(path,config={}){if(path==='/permissions/me')return Promise.resolve({data:{data:{categories:{read:{access:'partial',fields:['id','title','slug']}}}}});return new Promise((resolve,reject)=>pending.push({path,config,resolve,reject}));}};
  const original=['550e8400-e29b-41d4-a716-446655440000','valid-slug','invalid/slug'];const relations=createArticleRelationsController(api,{collection:'categories',modelValue:original});
  const first=relations.resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(pending[0].config.params.filter,{_or:[{id:{_in:['550e8400-e29b-41d4-a716-446655440000']}},{slug:{_in:['valid-slug']}}]});
  pending[0].reject(Object.assign(Error('denied'),{response:{status:403}}));await first;
  assert.deepEqual(relations.snapshot().values,original);
  const retry=relations.retry();await new Promise(resolve=>setImmediate(resolve));
  pending[1].resolve({data:{data:[{id:'550e8400-e29b-41d4-a716-446655440000',title:'Allowed category',slug:'valid-slug'}]}});await retry;
  assert.equal(relations.snapshot().selected[0].label,'Allowed category');
  const stale=relations.search('old');await new Promise(resolve=>setImmediate(resolve));
  const latest=relations.search('new');await new Promise(resolve=>setImmediate(resolve));
  pending[3].resolve({data:{data:[{id:'550e8400-e29b-41d4-a716-446655440001',title:'Newest'}]}});await latest;
  pending[2].resolve({data:{data:[{id:'550e8400-e29b-41d4-a716-446655440002',title:'Stale'}]}});await stale;
  assert.equal(relations.snapshot().candidates[0].title,'Newest');
});

test('relation resolution chunks selected IDs, queries collection-safe fields, and exact prop replacement drops remotely removed unknown refs', async () => {
  const calls=[];const ids=Array.from({length:26},(_,index)=>`550e8400-e29b-41d4-a716-${String(index+1).padStart(12,'0')}`);
  const api={async get(path,config={}){calls.push([path,config]);if(path==='/permissions/me')return{data:{data:{products:{read:{access:'full',fields:['*']}}}}};return{data:{data:[]}};}};
  const relations=createArticleRelationsController(api,{collection:'products',modelValue:ids});await relations.resolve();
  const lookups=calls.filter(([path])=>path==='/items/products');assert.equal(lookups.length,2);assert.deepEqual(lookups.map(([,config])=>config.params.filter.id._in.length),[25,1]);
  for(const [,config] of lookups){assert.equal(config.params.limit,25);assert.deepEqual(config.params.fields.split(',').sort(),['brand','id','sku','slug','title']);assert.ok(!config.params.fields.split(',').includes('name'));}
  const original=['legacy-removed-reference','550e8400-e29b-41d4-a716-000000000001'];const relation=createArticleRelationsController(api,{collection:'products',modelValue:original});
  const next=relation.setSelection(['550e8400-e29b-41d4-a716-000000000001']);assert.equal((await next).ok,true);assert.deepEqual(relation.snapshot().values,['550e8400-e29b-41d4-a716-000000000001']);
});

test('an intentional relation removal retains JSON-string container and unknown entries', async () => {
  const original='["550e8400-e29b-41d4-a716-446655440000","legacy-entry"]',emitted=[];const api={async get(path){if(path==='/permissions/me')return{data:{data:{products:{read:{access:'partial',fields:['id','title']}}}}};return{data:{data:[{id:'550e8400-e29b-41d4-a716-446655440000',title:'Visible product'}]}};}};
  const relations=createArticleRelationsController(api,{collection:'products',modelValue:original,onChange:value=>emitted.push(value)});await relations.resolve();assert.deepEqual(relations.snapshot().values,['550e8400-e29b-41d4-a716-446655440000','legacy-entry']);assert.equal(emitted.some(value=>typeof value==='string'),false);
  assert.equal(relations.remove('550e8400-e29b-41d4-a716-446655440000'),true);assert.equal(emitted.filter(value=>typeof value==='string').at(-1),'["legacy-entry"]');assert.deepEqual(relations.snapshot().values,['legacy-entry']);assert.equal(relations.changeValue(),'["legacy-entry"]');
});

test('product relation labels and search use brand only when its field is permitted', async () => {
  const id='550e8400-e29b-41d4-a716-446655440000';
  const makeApi=fields=>({calls:[],async get(path,config={}){this.calls.push([path,config]);if(path==='/permissions/me')return{data:{data:{products:{read:{access:'partial',fields}}}}};return{data:{data:[{id,title:'Pump',sku:'P-1',brand:'Acme'}]}};}});
  const allowedApi=makeApi(['id','title','sku','brand']);
  const allowed=createArticleRelationsController(allowedApi,{collection:'products',modelValue:[id]});
  await allowed.resolve();
  assert.equal(allowed.snapshot().selected[0].label,'Pump · P-1 · Acme');
  const allowedSearch=allowed.search('Acme');await new Promise(resolve=>setImmediate(resolve));
  const searchCall=allowedApi.calls.filter(([path])=>path==='/items/products').at(-1);
  assert.equal(searchCall[1].params.fields,'id,title,sku,brand');
  assert.ok(searchCall[1].params.filter._or.some(term=>Object.hasOwn(term,'brand')));
  await allowedSearch;

  const deniedApi=makeApi(['id','title','sku']);
  const denied=createArticleRelationsController(deniedApi,{collection:'products',modelValue:[id]});
  await denied.resolve();
  assert.equal(denied.snapshot().selected[0].label,'Pump · P-1');
  assert.equal(deniedApi.calls.filter(([path])=>path==='/items/products')[0][1].params.fields,'id,title,sku');
});

test('unknown non-string relation values cannot resolve or be removed by slug coercion', async () => {
  const id='550e8400-e29b-41d4-a716-446655440000';
  const api={async get(path){if(path==='/permissions/me')return{data:{data:{products:{read:{access:'partial',fields:['id','title','slug']}}}}};return{data:{data:[{id,title:'Product',slug:'123'}]}};}};
  const relations=createArticleRelationsController(api,{collection:'products',modelValue:[id,123,'123']});
  await relations.resolve();
  const selected=relations.snapshot().selected;
  assert.equal(selected[0].removable,true);
  assert.equal(selected[1].available,false);
  assert.equal(selected[1].removable,false);
  assert.equal(selected[2].removable,true);
  assert.equal(relations.remove(123),false);
  assert.deepEqual(relations.snapshot().values,[id,123,'123']);
});

test('article comparison strips executable and formatting markup and excludes structural JSON duplicates', () => {
  const rows=articleComparisonRows({content:'<p>Same <b>text</b></p>',seo:{title:'A'},translations:{ru:{title:'A'}},content_blocks:{secret:true}},{content:'<div>Same text</div>',seo:{title:'B'},translations:{ru:{title:'B'}},content_blocks:{secret:false}});
  assert.deepEqual(rows.map(row=>row.field),['content']);assert.equal(rows[0].own,'Форматирование или разметка изменились');assert.equal(rows[0].remote,'Форматирование или разметка изменились');
  const dangerous=articleComparisonRows({content:'<p>Safe</p><script>secret()</script><style>.x{}</style><!-- private -->'},{content:'<p>Changed</p>'});
  assert.ok(!dangerous[0].own.includes('secret'));assert.ok(!dangerous[0].own.includes('private'));
});

test('comparison describes relation counts and formats date values without exposing relation identifiers', () => {
  const id='550e8400-e29b-41d4-a716-446655440000';const rows=articleComparisonRows({related_products:[id,'legacy'],published_at:'2026-10-18T10:00:00.000Z'},{related_products:[id],published_at:'2026-10-18T11:00:00.000Z'});
  assert.equal(rows.find(row=>row.field==='related_products').own,'2 связи');assert.equal(rows.find(row=>row.field==='related_products').remote,'1 связь');
  assert.ok(rows.find(row=>row.field==='published_at').own.includes('2026'));assert.doesNotMatch(rows.find(row=>row.field==='published_at').own,/T10:00/);assert.ok(rows.every(row=>!JSON.stringify(row).includes(id)));
});

test('SEO projection seeds omitted native keys from scalar values and preserves explicit empty and unknown keys', async () => {
  const api=apiFixture({item:{...article,seo_title:'Scalar SEO',seo_description:'Scalar description',seo:{meta_description:'',custom:{keep:true}}}});
  const c=createArticlesController(api);await c.open('article-1');
  assert.deepEqual(c.seoInitialValues(),{meta_description:'',custom:{keep:true},title:'Scalar SEO'});
});

test('compatible scalar and native SEO edits synchronize the scalar projection without dropping unknown JSON keys', async () => {
  const api=apiFixture({item:{...article,seo:{title:'legacy title',custom:{keep:true}}}});const c=createArticlesController(api);await c.open('article-1');
  c.change('seo_title','Aligned title');
  c.change('seo',{title:'legacy title',custom:{keep:true},robots:'follow'},{trustedFields:['seo']});
  assert.equal((await c.save()).ok,true);
  const payload=api.calls.find(row=>row[0]==='POST')[2];
  assert.deepEqual(payload.changes.seo,{title:'Aligned title',custom:{keep:true},robots:'follow'});
});

test('publication view state handles future, due, and invalid dates without changing stored status', () => {
  const now=Date.parse('2026-10-18T10:00:00.000Z');
  assert.deepEqual(articlePublicationState('published','2026-10-18T10:01:00.000Z',now),{label:'Запланирована',kind:'scheduled',publicNow:false});
  assert.deepEqual(articlePublicationState('published','2026-10-18T10:00:00.000Z',now),{label:'Опубликована',kind:'published',publicNow:true});
  assert.deepEqual(articlePublicationState('published','bad-date',now),{label:'Ошибка даты',kind:'invalid-date',publicNow:false});
  assert.deepEqual(articlePublicationState('draft','2026-10-18T09:00:00.000Z',now),{label:'Черновик',kind:'draft',publicNow:false});
});

test('sources remain read-only at the controller boundary', async () => {
  const api=apiFixture();const c=createArticlesController(api);await c.open('article-1');
  assert.equal(c.change('sources',{replaced:true}),false);assert.deepEqual(c.snapshot().values.sources,article.sources);
});

test('native edit authorization survives delayed native acknowledgement until consumed or reset', () => {
  const guard=createNativeEditAuthorization();guard.authorize('content');
  assert.equal(guard.has('content'),true);assert.equal(guard.consume('content'),true);assert.equal(guard.has('content'),false);
  guard.authorize('seo');guard.reset();assert.equal(guard.has('seo'),false);
});

test('uncertain native create can exact-slug lookup candidates without retrying or claiming ownership', async () => {
  const found={id:'already-created',slug:'unknown-result',title:'Found article',status:'draft'};
  const api=apiFixture({post:async()=>{throw Error('response lost');},rows:[found]});const c=createArticlesController(api);await c.open('+');
  for(const [field,value] of [['title','Unknown result'],['slug','unknown-result'],['excerpt','Description'],['content','<p>Body</p>'],['published_at','2026-10-18T10:00:00.000Z']])c.change(field,value,field==='content'?{trustedFields:['content']}:{});
  assert.equal((await c.save()).ok,false);assert.equal((await c.lookupCreatedBySlug()).ok,true);
  assert.deepEqual(c.snapshot().createMatches,[found]);assert.equal(c.snapshot().createdId,null);
  const lookup=api.calls.find(row=>row[0]==='GET'&&row[1]==='/items/articles');assert.deepEqual(lookup[2].params.filter,{slug:{_eq:'unknown-result'}});
  assert.equal(api.calls.filter(row=>row[0]==='POST').length,1);
});
