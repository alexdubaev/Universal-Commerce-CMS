import {equalSnapshotField} from './mutations.mjs';

// Directus 12.1.1 (@directus/api 37.0.1) VersionsService.save/promote do not
// acquire a shared parent/version transaction themselves. Own that boundary,
// retain the caller's native accountability, and compare the reviewed delta.
const COLLECTIONS=new Set(['pages','home_page']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FORBIDDEN_FIELDS=new Set(['id','created_at','updated_at','user_created','user_updated']);
const SECTION_TYPES=new Set(['hero','categories','company_trust','featured_products','advantages','steps','cta','catalog_preview','seo_text','lead_form','parts_request','recent_supplies','faq','contacts','articles','custom']);
export const CAPTURED_SECTION_FIELDS=['id','updated_at','status','section_type','title','subtitle','text','image','image_alt','button_text','button_url','items','settings','sort_order','is_visible'];
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const keySafe=key=>/^[a-z][a-z0-9_]*$/.test(key)&&!['constructor','prototype','__proto__'].includes(key);
const failure=(code,message,status)=>Object.assign(new Error(message),{code,status});
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(plain(value))return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
 return value??null;
}
// Native save recursively stamps every JSON object; native mapDelta only
// traverses schema relations, so JSON leaves retain these internal markers.
// Match native splitRecursive's business payload, including nested JSON leaves.
export function stripVersionMetadata(value){
 if(Array.isArray(value))return value.map(stripVersionMetadata);
 if(plain(value))return Object.fromEntries(Object.entries(value).filter(([key])=>!['_user','_date'].includes(key)).map(([key,item])=>[key,stripVersionMetadata(item)]));
 return value;
}
export const equalVersionDelta=(left,right)=>JSON.stringify(canonical(stripVersionMetadata(left??{})))===JSON.stringify(canonical(stripVersionMetadata(right??{})));
function safeTree(value,depth=0){
 if(depth>30)return false;
 if(Array.isArray(value))return value.every(item=>safeTree(item,depth+1));
 if(plain(value))return Object.entries(value).every(([key,item])=>!['__proto__','constructor','prototype'].includes(key)&&safeTree(item,depth+1));
 return value===null||['string','number','boolean','undefined'].includes(typeof value);
}
function validateRequest(req,mode){
 const {id}=req.params??{},body=req.body;
 const allowed=mode==='save'?['expected','changes']:['expected','mainHash','capturedSections'];
 if(!UUID.test(id??'')||!plain(body)||Object.keys(body).some(key=>!allowed.includes(key))||!Object.hasOwn(body,'expected')||
    (body.expected!==null&&!plain(body.expected))||!safeTree(body)||Buffer.byteLength(JSON.stringify(body),'utf8')>1024*1024)
  throw failure('INVALID_PAYLOAD','Нужен исходный снимок версии и корректный запрос.',400);
 if(mode==='save'&&(!plain(body.changes)||!Object.keys(body.changes).length||Object.keys(body.changes).length>120))
  throw failure('INVALID_PAYLOAD','Передайте изменённые поля версии.',400);
 if(mode==='promote'&&(typeof body.mainHash!=='string'||body.mainHash.length<1||body.mainHash.length>256))
  throw failure('INVALID_PAYLOAD','Нужен исходный hash опубликованной записи.',400);
 return {id,...body};
}
export function validateVersionSectionSnapshot(record){
 const source=record.sections_source??'children',snapshot=record.sections_snapshot;
 const invalid=()=>{throw failure('INVALID_PAYLOAD','Проверьте типы, публикацию, порядок и размер снимка секций (до 500 блоков и 1 МиБ).',400);};
 if(!['children','snapshot'].includes(source))invalid();
 if(snapshot==null&&source==='children')return;
 if(!Array.isArray(snapshot)||snapshot.length>500||Buffer.byteLength(JSON.stringify(snapshot),'utf8')>1024*1024)invalid();
 const ids=new Set();
 for(const row of snapshot){
  if(!plain(row)||typeof row.id!=='string'||!row.id||ids.has(row.id)||!SECTION_TYPES.has(row.section_type)||(row.status!==undefined&&row.status!=='published')||
     typeof row.is_visible!=='boolean'||(row.sort_order!=null&&!Number.isInteger(row.sort_order)))invalid();
  for(const key of ['title','subtitle','text','image_alt','button_text','button_url'])if(row[key]!=null&&typeof row[key]!=='string')invalid();
  ids.add(row.id);
 }
}
function captureProjection(capture){
 if(!plain(capture)||!Array.isArray(capture.rows))return capture;
 return {collection:capture.collection,item:capture.item,rows:capture.rows.map(row=>plain(row)?Object.fromEntries(CAPTURED_SECTION_FIELDS.map(field=>[field,row[field]])):row)};
}
async function assertFieldAccess(context,version,fields,options){
 // Use the host's exact native permission engine. VersionsService.save itself
 // only checks whether the version is readable before its internal delta write.
 // The injection point is server/test context, never request payload data.
 const validateAccess=context.validateAccess??(await import('@directus/api/permissions/modules/validate-access/validate-access')).validateAccess;
 await validateAccess({accountability:options.accountability,action:'update',collection:version.collection,primaryKeys:[version.item],fields},{schema:options.schema,knex:options.knex});
}
function validateChanges(changes,schema,collection){
 const fields=schema.collections[collection]?.fields??{};
 for(const [key,value]of Object.entries(changes)){
  const field=fields[key];
  if(!keySafe(key)||FORBIDDEN_FIELDS.has(key)||!field||field.type==='alias'||field.alias||
     (field.special?.includes('m2o')&&value!==null&&typeof value==='object'))
   throw failure('INVALID_PAYLOAD','Версия принимает поля записи; связанные записи редактируются отдельно.',400);
 }
}
async function compareCapturedSections(capture,version,schema,trx,services,accountability){
 if(!plain(capture)||capture.collection!==version.collection||String(capture.item)!==String(version.item)||
    !['pages','home_page'].includes(version.collection)||!Array.isArray(capture.rows)||capture.rows.length>500||!schema.collections.page_sections)
  throw failure('INVALID_PAYLOAD','Не передан исходный снимок опубликованных секций.',400);
 const fields=CAPTURED_SECTION_FIELDS;
 if(capture.rows.some(row=>!plain(row)||fields.some(key=>!Object.hasOwn(row,key))||row.status!=='published'||typeof row.id!=='string')||
    new Set(capture.rows.map(row=>row.id)).size!==capture.rows.length)
  throw failure('INVALID_PAYLOAD','Снимок секций должен содержать все редактируемые поля и идентификаторы.',400);
 const owner=version.collection==='home_page'?'home_page':'page';
 // Parent is already locked. Integrity hooks acquire the same parent lock in
 // the child transaction, including creates, so inserts cannot evade this set
 // comparison on PostgreSQL. Read hidden IDs only to reject an incomplete view;
 // never return protected child data to the requesting role.
 const locked=await trx('page_sections').where({[owner]:version.item,status:'published'}).orderBy('id').forUpdate().select('id');
 const ids=locked.map(row=>String(row.id)).sort();
 const expectedIds=capture.rows.map(row=>row.id).sort();
 if(!equalVersionDelta({ids},{ids:expectedIds}))throw failure('CONFLICT','Состав опубликованных секций изменился после создания версии.',409);
 const items=new services.ItemsService('page_sections',{schema,accountability,knex:trx});
 const rows=await items.readByQuery({filter:{_and:[{[owner]:{_eq:version.item}},{status:{_eq:'published'}}]},fields,sort:['id'],limit:501});
 if(rows.length!==ids.length)throw failure('CONFLICT','Не удалось подтвердить полный исходный снимок секций.',409);
 const actual=new Map(rows.map(row=>[String(row.id),row]));
 for(const before of capture.rows){
  const after=actual.get(before.id);
  if(!after||fields.some(field=>!Object.hasOwn(after,field)||!equalSnapshotField(field,before[field],after[field])))
   throw failure('CONFLICT','Опубликованная секция изменена другим пользователем.',409);
 }
}
function createHandler(context,mode){
 const {database,services,getSchema,logger}=context;
 return async(req,res)=>{
  if(!req.accountability?.user)return res.status(403).json({errors:[{code:'FORBIDDEN',message:'Требуется авторизация.'}]});
  try{
   const input=validateRequest(req,mode),schema=await getSchema();
   const permitted=new services.VersionsService({schema,accountability:req.accountability});
   const initial=await permitted.readOne(input.id);
   if(!COLLECTIONS.has(initial.collection)||!schema.collections[initial.collection]||typeof initial.item!=='string'||!initial.item||initial.item.length>80)
    throw failure('INVALID_PAYLOAD','Версия должна относиться к существующей записи каталога или страницы.',400);
   if(mode==='save')validateChanges(input.changes,schema,initial.collection);
   const result=await database.transaction(async trx=>{
    const options={schema,accountability:req.accountability,knex:trx};
    const versions=new services.VersionsService(options),items=new services.ItemsService(initial.collection,options);
    await items.readOne(initial.item,{fields:['id']});
    // All guarded operations use this order. The main lock serializes both
    // promotion and native item writes; the version lock serializes draft saves.
    const parent=await trx(initial.collection).where({id:initial.item}).forUpdate().first('id');
    const lockedVersion=await trx('directus_versions').where({id:input.id}).forUpdate().first('id');
    if(!parent||!lockedVersion)throw failure('CONFLICT','Запись или версия удалена.',409);
    const readVersion=await versions.readOne(input.id),version={...readVersion,delta:stripVersionMetadata(readVersion.delta)};
    if(version.collection!==initial.collection||version.item!==initial.item||version.key!==initial.key||version.hash!==initial.hash)
     throw failure('CONFLICT','Привязка версии изменилась. Откройте её повторно.',409);
    if(!equalVersionDelta(input.expected,version.delta))throw failure('CONFLICT','Версия изменена в другой сессии. Обновите её перед сохранением.',409);
    if(mode==='save'){
     const previous=await versions.getMainItem(version.collection,version.item);
     const changes={...input.changes};
     const captured=version.delta?.sections_capture;
     if(captured&&Object.hasOwn(changes,'sections_capture')){
      if(!equalVersionDelta(captureProjection(captured),captureProjection(changes.sections_capture)))throw failure('CONFLICT','Исходный снимок секций версии нельзя заменить.',409);
      changes.sections_capture=captured;
     }
     const proposed={...previous,...version.delta,...changes};
     validateVersionSectionSnapshot(proposed);
     if(proposed.sections_source==='snapshot'&&previous.sections_source!=='snapshot'&&!captured){
      if(!changes.sections_capture)throw failure('INVALID_PAYLOAD','Перед первым сохранением нужен исходный снимок секций.',400);
      await compareCapturedSections(changes.sections_capture,version,schema,trx,services,req.accountability);
     }else if(Object.hasOwn(changes,'sections_capture')&&!captured&&changes.sections_capture!==null)throw failure('INVALID_PAYLOAD','Исходный снимок сохраняется только при первом переключении источника секций.',400);
     await assertFieldAccess(context,version,Object.keys(changes),options);
     await versions.save(input.id,changes,{patchRevision:false});
     const rawSaved=await versions.readOne(input.id),saved={...rawSaved,delta:stripVersionMetadata(rawSaved.delta)},main=await versions.getMainItem(saved.collection,saved.item);
     // Do not use ItemsService.readOne({version:key}) inside this transaction:
     // Directus handle-version explicitly rolls its current transaction back.
     return {version:{id:saved.id,key:saved.key,hash:saved.hash,delta:saved.delta??null},record:{...main,...saved.delta}};
    }
    if(input.mainHash!==version.hash)throw failure('CONFLICT','Исходная опубликованная версия изменилась; поздний hash не принимается.',409);
    if((await versions.verifyHash(version.collection,version.item,input.mainHash)).outdated)
     throw failure('CONFLICT','Опубликованная запись изменена после создания версии.',409);
    const main=await versions.getMainItem(version.collection,version.item);
    validateVersionSectionSnapshot({...main,...version.delta});
    const startsSnapshot=version.delta?.sections_source==='snapshot'&&main.sections_source!=='snapshot';
    const captured=version.delta?.sections_capture;
    if(startsSnapshot&&!captured)throw failure('INVALID_PAYLOAD','В сохранённой версии отсутствует исходный снимок секций.',400);
    if(input.capturedSections&&!equalVersionDelta(captureProjection(captured),captureProjection(input.capturedSections)))throw failure('CONFLICT','Исходный снимок секций версии нельзя заменить.',409);
    if(startsSnapshot)await compareCapturedSections(captured,version,schema,trx,services,req.accountability);
    const fields=Object.keys(version.delta??{}).filter(field=>field!=='sections_capture'&&!FORBIDDEN_FIELDS.has(field));
    validateChanges(Object.fromEntries(fields.map(field=>[field,version.delta[field]])),schema,version.collection);
    await assertFieldAccess(context,version,fields,options);
    const id=await versions.promote(input.id,{mainHash:input.mainHash,fields});
    return {id,record:await items.readOne(id,{fields:['*']})};
   });
   return res.json({data:result});
  }catch(error){
   const status=error.status??(error.code==='FORBIDDEN'?403:['CONFLICT','VERSION_HASH_MISMATCH','RECORD_NOT_UNIQUE'].includes(error.code)?409:500);
   logger?.warn?.({code:error.code??'VERSION_WRITE_FAILED'},'Guarded content version operation rejected');
   return res.status(status).json({errors:[{code:error.code??'VERSION_WRITE_FAILED',message:status<500?error.message:'Сохранение версии не подтверждено. Обновите данные перед повтором.'}]});
  }
 };
}
export const createGuardedVersionSaveHandler=context=>createHandler(context,'save');
export const createGuardedVersionPromoteHandler=context=>createHandler(context,'promote');
