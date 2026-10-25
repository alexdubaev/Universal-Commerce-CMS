/** Guarded writes for the workspace/importer. Directus is still the RBAC authority.
 * The SQL connection is used ONLY to lock an already-permitted row. All reads,
 * updates and deletes are performed through ItemsService with the caller's
 * accountability and the same transaction. Requires PostgreSQL (deployment).
 */
const COLLECTIONS = new Set(['products', 'pages', 'home_page', 'page_sections', 'site_settings', 'products_analogs', 'product_codes', 'product_images', 'product_specifications', 'product_documents', 'categories', 'articles', 'navigation_items']);
const FORBIDDEN = new Set(['id', 'created_at', 'updated_at', 'user_created', 'user_updated']);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keySafe = key => /^[a-z][a-z0-9_]*$/.test(key) && !['constructor', 'prototype', '__proto__'].includes(key);
function failure(code, message, status) { return Object.assign(new Error(message), { code, status }); }
const SINGLE_RELATIONS = new Set(['category','main_image','og_image','image','file','product','product_from','product_to','page','home_page','logo','favicon','default_og_image','hero_image']);
const MANY_RELATIONS = new Set(['image_items','specification_items','document_items','related_products']);
const SITE_SETTINGS_FIELDS = new Set(['company_name','legal_name','inn','kpp','ogrn','legal_address','vat_info','requisites_url','documents_url','phone','email','address','city','working_hours','delivery_region','logo','favicon','company_image','primary_color','accent_color','primary_cta_text','primary_cta_url','footer_text','footer_disclaimer','seo_title','seo_description','og_title','og_description','default_og_image']);
const SITE_SETTINGS_FILES = new Set(['logo','favicon','company_image','default_og_image']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SITE_SETTINGS_REQUIRED = new Set(['company_name','phone','email']);
function validateSiteSettingsPayload(expected,changes,action) {
  if(action!=='update'||!Object.hasOwn(expected,'id')||!Object.hasOwn(expected,'updated_at')||
    Object.keys(changes).some(field=>!SITE_SETTINGS_FIELDS.has(field))||
    Object.keys(changes).some(field=>!Object.hasOwn(expected,field))) {
    throw failure('INVALID_PAYLOAD','Изменения настроек сайта содержат недопустимые поля.',400);
  }
  for(const [field,value] of Object.entries(changes)) {
    if(SITE_SETTINGS_FILES.has(field)) {
      if(value!==null&&(typeof value!=='string'||!UUID.test(value)))throw failure('INVALID_PAYLOAD','Для изображения нужно выбрать доступный файл.',400);
    } else if(value!==null&&typeof value!=='string') {
      throw failure('INVALID_PAYLOAD','Значение настройки должно быть текстом.',400);
    }
    if(SITE_SETTINGS_REQUIRED.has(field)&&(typeof value!=='string'||!value.trim()))throw failure('INVALID_PAYLOAD','Заполните обязательные настройки сайта.',400);
  }
}
function canonical(value) {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(canonical);
  if (plain(value)) {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  }
  return value;
}
export function equalSnapshotField(field, left, right) {
  const id = value => plain(value) && 'id' in value ? value.id : value;
  if (SINGLE_RELATIONS.has(field)) { left=id(left);right=id(right); }
  if (MANY_RELATIONS.has(field)) {
    if(Array.isArray(left))left=left.map(id);
    if(Array.isArray(right))right=right.map(id);
  }
  if (['price','weight','popularity_score','sort_order'].includes(field) && left != null && right != null) {
    const a=Number(left),b=Number(right);return Number.isFinite(a)&&Number.isFinite(b)&&a===b;
  }
  if (['updated_at','created_at','verified_at'].includes(field) && left && right) {
    const a=Date.parse(left),b=Date.parse(right);if(Number.isFinite(a)&&Number.isFinite(b))return a===b;
  }
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}
export function createGuardedMutationHandler({database,services,getSchema,logger,env=process.env}) {
  return async function guardedMutation(req,res) {
    if (!req?.accountability?.user) return res.status(403).json({errors:[{code:'FORBIDDEN',message:'Требуется авторизация.'}]});
    try {
      const {collection,id}=req.params ?? {};
      const {expected,changes={},action='update',require_unreferenced=false}=req.body ?? {};
      if (!COLLECTIONS.has(collection) || typeof id !== 'string' || !id || id.length>80 ||
          !plain(expected) || !plain(changes) || !['update','delete'].includes(action) ||
          Object.keys(expected).length===0 || Object.keys(expected).length>120 || Object.keys(changes).length>120 ||
          JSON.stringify(req.body).length>512000 || Object.keys(expected).some(k=>!keySafe(k)) ||
          Object.keys(changes).some(k=>!keySafe(k)||FORBIDDEN.has(k)||!Object.hasOwn(expected,k)) ||
          (expected.id!==undefined && String(expected.id)!==id) ||
          typeof require_unreferenced!=='boolean' ||
          (require_unreferenced && (action!=='delete' || collection!=='products'))) {
        throw failure('INVALID_PAYLOAD','Нужно передать исходные значения изменяемых полей.',400);
      }
      const schema=await getSchema();
      if(!schema.collections?.[collection])throw failure('INVALID_PAYLOAD','Коллекция недоступна.',400);
      if(collection==='site_settings')validateSiteSettingsPayload(expected,changes,action);
      if(require_unreferenced) {
        const fields=schema.collections[collection].fields;
        if(!fields || !Array.isArray(schema.relations))throw failure('INVALID_PAYLOAD','Полная схема удаления недоступна.',400);
        const scalars=Object.entries(fields).filter(([,field])=>field.type!=='alias').map(([name])=>name);
        if(!scalars.length || scalars.some(field=>!Object.hasOwn(expected,field))) {
          throw failure('INVALID_PAYLOAD','Для отката создания нужен полный снимок полей товара.',400);
        }
      }
      const result=await database.transaction(async trx=>{
        const svc=new services.ItemsService(collection,{schema,accountability:req.accountability,knex:trx});
        // Check visibility before taking the settings-wide serialization lock.
        await svc.readOne(id,{fields:['id']});
        if(collection==='site_settings') {
          const metadata=schema.collections.site_settings;
          if(metadata.collection!=='site_settings'||metadata.singleton!==true)throw failure('INVALID_PAYLOAD','Структура настроек сайта не подтверждена.',400);
          if(String(expected.id)!==id)throw failure('INVALID_PAYLOAD','Идентификатор настроек не совпадает.',400);
          // Serialize cardinality checks against concurrent inserts/deletes, then prove
          // the whole table contains exactly the requested singleton without returning rows.
          await trx.raw('LOCK TABLE ?? IN SHARE ROW EXCLUSIVE MODE',['site_settings']);
          const cardinality=await trx('site_settings').count({count:'id'}).first();
          const singletonCount=Number(cardinality?.count);
          const identity=await trx('site_settings').where({id}).first('id');
          if(singletonCount!==1||!identity)throw failure('CONFLICT','Не удалось подтвердить единственную запись настроек сайта.',409);
          for(const field of Object.keys(changes)) {
            const fieldSchema=metadata.fields?.[field];
            if(!fieldSchema||fieldSchema.alias||fieldSchema.type==='alias'||fieldSchema.generated===true)throw failure('INVALID_PAYLOAD','Поле настроек недоступно для изменения.',400);
            if(SITE_SETTINGS_FILES.has(field)?fieldSchema.type!=='uuid':!['string','text'].includes(fieldSchema.type))throw failure('INVALID_PAYLOAD','Тип поля настроек не соответствует разрешённому значению.',400);
            if(SITE_SETTINGS_FILES.has(field)&&changes[field]!==null&&expected[field]!==changes[field]) {
              const folderId=env.COMMERCE_STOREFRONT_PUBLIC_FOLDER_ID;
              if(typeof folderId!=='string'||!UUID.test(folderId))throw failure('INVALID_PAYLOAD','Общая папка изображений не настроена.',400);
              const fileService=new services.ItemsService('directus_files',{schema,accountability:req.accountability,knex:trx});
              let file;
              try { file=await fileService.readOne(changes[field],{fields:['id','folder','type']}); }
              catch(error) { if(['FORBIDDEN','NOT_FOUND'].includes(error.code))throw failure('FORBIDDEN','Можно выбрать только доступное изображение из общей папки.',403); throw error; }
              if(!file||file.id!==changes[field]||String(file.folder).toLowerCase()!==folderId.toLowerCase()||typeof file.type!=='string'||!file.type.startsWith('image/'))throw failure('FORBIDDEN','Можно выбрать только доступное изображение из общей папки.',403);
            }
          }
        }
        // Do not expose a raw SQL row; all returned data comes from caller-scoped services.
        const locked=await trx(collection).where({id}).forUpdate().first('id');
        if(!locked)throw failure('CONFLICT','Запись удалена. Обновите данные.',409);
        const current=await svc.readOne(id,{fields:Object.keys(expected)});
        if(Object.keys(expected).some(key=>!Object.hasOwn(current,key)||!equalSnapshotField(key,expected[key],current[key]))) {
          throw failure('CONFLICT','Запись изменена другим пользователем. Обновите данные перед сохранением.',409);
        }
        if(action==='delete') {
          if(require_unreferenced) {
            // Native versions use a polymorphic collection/item pair and are
            // absent from the ordinary FK relation list. Their deltas can hold
            // manual work even while every published scalar remains unchanged.
            const version=await trx('directus_versions').where({collection,item:id}).first('id');
            if(version)throw failure('CONFLICT','У товара есть сохранённая редакторская версия. Автоматическое удаление отменено.',409);
            // FOR UPDATE on the parent also conflicts with FK key-share locks
            // from concurrent child inserts. Reject any incoming relation, even
            // one hidden by the caller's child-read policy. Never expose its row.
            for(const relation of schema.relations.filter(item=>item.related_collection===collection)) {
              if(!keySafe(relation.collection)||!keySafe(relation.field))throw failure('INVALID_PAYLOAD','Связь товара нельзя безопасно проверить.',400);
              const linked=await trx(relation.collection).where({[relation.field]:id}).first(relation.field);
              if(linked)throw failure('CONFLICT','Товар уже используется в связанных записях. Автоматическое удаление отменено.',409);
            }
          }
          await svc.deleteOne(id);
          return {id,deleted:true};
        }
        if(Object.keys(changes).length)await svc.updateOne(id,changes);
        // The read is part of the transaction: no successful acknowledgement
        // with an unknown committed snapshot. Relation projections stay client-owned.
        return await svc.readOne(id,{fields:Object.keys(expected)});
      });
      return res.json({data:result});
    } catch(error) {
      const status=error.status ?? (error.code==='FORBIDDEN'?403:error.code==='RECORD_NOT_UNIQUE'?409:500);
      logger?.warn?.({code:error.code ?? 'WRITE_FAILED'},'Guarded mutation rejected');
      return res.status(status).json({errors:[{code:error.code ?? 'WRITE_FAILED',message: status<500 ? error.message : 'Сохранение не подтверждено. Обновите данные перед повтором.'}]});
    }
  };
}
