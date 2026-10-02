/** Server-owned derived fields; no network calls, secrets, or administrative
 * ItemsService. Child mutations mark the parent's media source in the current
 * Directus transaction. Existing data requires the explicit backfill. */
import {productIdentity} from './product-identity.mjs';
import {validateSectionSnapshot} from './section-snapshot.mjs';
export const normalizeCode = value => String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
const owns=(object,key)=>Object.hasOwn(object,key);
class CommerceTransactionRequiredError extends Error {
  // Directus 12 recognizes custom errors by this public discriminator. Keeping
  // the contract local also keeps this plain ESM hook free of runtime bundling.
  name='DirectusError';
  code='COMMERCE_TRANSACTION_REQUIRED';
  status=409;
  constructor() {
    super('Для этого изменения нужна транзакция: используйте commerce workspace/guarded API (transaction required).');
  }
}
function requireTransaction(database) {
  // Directus 12 update/delete filters run before the native service transaction.
  // A FOR UPDATE issued on that root connection does not guard the later write.
  if(database?.isTransaction!==true)throw new CommerceTransactionRequiredError();
}
export function normalizeProductPayload(payload, original={}) {
  const result={...payload};
  for(const [source,target] of [['sku','sku_normalized'],['mpn','mpn_normalized']]) {
    if(owns(payload,source)||owns(payload,target))result[target]=normalizeCode(owns(payload,source)?payload[source]:original[source])||null;
  }
  return result;
}
export function normalizeCodePayload(payload,original={}) {
  const result={...payload};
  if(owns(payload,'code')||owns(payload,'normalized_code'))result.normalized_code=normalizeCode(owns(payload,'code')?payload.code:original.code)||null;
  return result;
}
export function nextMediaSources(previous,group,source) {
  if(!['images','specifications','documents'].includes(group)||!['children','legacy'].includes(source))throw new TypeError('Invalid media source');
  let value=previous;
  if(typeof value==='string'){try{value=JSON.parse(value)}catch{value={}}}
  const result={};
  for(const key of ['images','specifications','documents'])if(['children','legacy'].includes(value?.[key]))result[key]=value[key];
  result[group]=source;return result;
}
const SEO_KEYS = ['seo','seo_title','seo_description','og_image','is_indexable','canonical_url'];
export function synchronizeSeoPayload(payload, original={}, collection='products') {
  const result={...payload};
  const record=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
  const string=x=>typeof x==='string'&&x.trim()?x.trim():null;
  const pairs=[['title','seo_title'],['meta_description','seo_description'],['og_image','og_image']];
  if(owns(payload,'seo')) {
    const seo=record(payload.seo);
    for(const [key,field] of pairs) if(owns(seo,key))result[field]=string(seo[key]);
    if(collection!=='articles'&&typeof seo.no_index==='boolean')result.is_indexable=!seo.no_index;
    if(['home_page','pages'].includes(collection) && owns(record(seo.additional_fields),'canonical_url')) result.canonical_url=string(seo.additional_fields.canonical_url);
  } else if(SEO_KEYS.slice(1).some(k=>owns(payload,k))) {
    // Native legacy editors and workers write through to the preferred JSON too.
    const seo={...record(original.seo)};
    for(const [key,field] of pairs) if(owns(payload,field))seo[key]=typeof payload[field]==='object'&&payload[field]?payload[field].id:string(payload[field]);
    if(owns(payload,'is_indexable'))seo.no_index=payload.is_indexable===false;
    if(owns(payload,'canonical_url'))seo.additional_fields={...record(seo.additional_fields),canonical_url:string(payload.canonical_url)};
    result.seo=seo;
  }
  return result;
}
const idOf=value=>value&&typeof value==='object'?value.id:value;
const keyList=(payload,meta)=>[...new Set((Array.isArray(payload)?payload:meta?.keys??[meta?.key]).filter(x=>x!=null).map(String))];
async function originalFor(collection,payload,meta,database) {
  const keys=meta?.keys??[];
  if(keys.length!==1)return {};
  return await database(collection).where({id:keys[0]}).forUpdate().first()??{};
}
export default function register({filter}) {
  filter('versions.create',async(payload,_meta,{database})=>{
    if(['products','pages','home_page'].includes(payload.collection)) {
      // Native item-less drafts represent a new record. VersionsService owns
      // their key/create validation; there is no existing row to lock here.
      if(payload.item==null||payload.item==='')return payload;
      requireTransaction(database);
      const parent=await database(payload.collection).where({id:payload.item}).forUpdate().first('id');
      if(!parent)throw Object.assign(new Error('Version parent no longer exists'),{status:409,code:'CONFLICT'});
    }
    return payload;
  });
  filter('versions.update',async(payload,meta,{database})=>{
    if(owns(payload,'delta')&&database?.isTransaction!==true) {
      const rows=await database('directus_versions').whereIn('id',meta.keys??[]).select('collection','item');
      // A native item-less draft only stores a future INSERT payload. Trust
      // the stored null binding, never an item supplied in the update body.
      if(rows.some(row=>['pages','home_page'].includes(row.collection)&&row.item!==null))requireTransaction(database);
    }
    return payload;
  });
  filter('items.promote',(payload,meta,{database})=>{
    // Native VersionsService passes the same locally captured item here that
    // selects createOne vs updateOne afterwards. Null can only create a new
    // parent in createOne's transaction; it cannot overwrite an existing row.
    if(['pages','home_page'].includes(meta?.collection)&&meta.item!==null)requireTransaction(database);
    return payload;
  });
  for(const collection of ['orders','leads'])filter(`${collection}.items.update`,payload=>{
    if(['request_key','request_fingerprint','user_created'].some(field=>owns(payload,field)))throw new Error('Request identity and creator are immutable');
    return payload;
  });
  filter('products.items.create',(payload)=>{
    let result=normalizeProductPayload(synchronizeSeoPayload(payload));
    result={...result,...productIdentity(payload.brand,payload.sku)};
    for(const [field,group] of [['gallery','images'],['specifications','specifications'],['documents','documents']]) {
      if(owns(payload,field))result.media_sources=nextMediaSources(result.media_sources,group,'legacy');
    }
    for(const [field,group] of [['image_items','images'],['specification_items','specifications'],['document_items','documents']]) {
      if(owns(payload,field))result.media_sources=nextMediaSources(result.media_sources,group,'children');
    }
    return result;
  });
  filter('products.items.update',async(payload,meta,{database})=>{
    const identityChange=['brand','sku','brand_key','identity_key'].some(k=>owns(payload,k));
    if((meta.keys?.length??0)>1 && (identityChange || SEO_KEYS.some(k=>owns(payload,k)) || owns(payload,'media_sources')||['gallery','specifications','documents','image_items','specification_items','document_items'].some(k=>owns(payload,k))||
        (owns(payload,'sku_normalized')&&!owns(payload,'sku'))||(owns(payload,'mpn_normalized')&&!owns(payload,'mpn')))) {
      throw new Error('Update media and derived keys per product, not through a blind batch.');
    }
    const seoMerge=!owns(payload,'seo')&&SEO_KEYS.slice(1).some(key=>owns(payload,key));
    const needsOriginal=identityChange||seoMerge||['gallery','specifications','documents','image_items','specification_items','document_items','sku_normalized','mpn_normalized'].some(key=>owns(payload,key));
    if(needsOriginal)requireTransaction(database);
    const original=needsOriginal?await originalFor('products',payload,meta,database):{};
    const result=normalizeProductPayload(synchronizeSeoPayload(payload,original),original);
    if(identityChange)Object.assign(result,productIdentity(owns(payload,'brand')?payload.brand:original.brand,owns(payload,'sku')?payload.sku:original.sku));
    let modes=original.media_sources;
    for(const [field,group] of [['gallery','images'],['specifications','specifications'],['documents','documents']]) {
      if(owns(payload,field)) { modes=nextMediaSources(modes,group,'legacy');result.media_sources=modes; }
    }
    for(const [field,group] of [['image_items','images'],['specification_items','specifications'],['document_items','documents']]) {
      if(owns(payload,field)) { modes=nextMediaSources(modes,group,'children');result.media_sources=modes; }
    }
    return result;
  });
  for(const collection of ['pages','home_page','categories','articles']) {
    const ownsSections=['pages','home_page'].includes(collection);
    filter(`${collection}.items.create`,payload=>synchronizeSeoPayload(ownsSections?validateSectionSnapshot(payload):payload,{},collection));
    filter(`${collection}.items.update`,async(payload,meta,{database})=>{
      const snapshotChange=ownsSections&&['sections_source','sections_snapshot'].some(k=>owns(payload,k));
      if(!snapshotChange&&!SEO_KEYS.some(k=>owns(payload,k)))return payload;
      // Primary native JSON editor submits the whole preferred value. Deriving
      // scalar projections from that same payload needs no unlocked read/merge.
      if(!snapshotChange&&owns(payload,'seo'))return synchronizeSeoPayload(payload,{},collection);
      if((meta.keys?.length??0)>1)throw new Error('Edit SEO per item to preserve independent metadata');
      requireTransaction(database);
      const original=await originalFor(collection,payload,meta,database);
      if(snapshotChange)validateSectionSnapshot(payload,original);
      return synchronizeSeoPayload(payload,original,collection);
    });
  }
  filter('product_codes.items.create',payload=>normalizeCodePayload(payload));
  filter('product_codes.items.update',async(payload,meta,{database})=>{
    if(owns(payload,'normalized_code')&&!owns(payload,'code')&&(meta.keys?.length??0)>1)throw new Error('Update derived codes per record');
    if(owns(payload,'code'))return normalizeCodePayload(payload);
    if(!owns(payload,'normalized_code'))return payload;
    requireTransaction(database);
    return normalizeCodePayload(payload,await originalFor('product_codes',payload,meta,database));
  });
  for(const [collection,group] of [['product_images','images'],['product_specifications','specifications'],['product_documents','documents']]) {
    for(const event of ['create','update','delete']) {
      filter(`${collection}.items.${event}`,async(payload,meta,{database})=>{
        requireTransaction(database);
        const parents=new Set();const parent=idOf(payload?.product);if(parent!=null)parents.add(String(parent));
        if(event!=='create') {
          const keys=keyList(event==='delete'?payload:null,meta);
          if(keys.length)for(const row of await database(collection).whereIn('id',keys).select('product'))if(row.product!=null)parents.add(String(row.product));
        }
        // Sorted locks avoid cycles between simultaneous multi-parent updates.
        for(const id of [...parents].sort()) {
          const row=await database('products').where({id}).forUpdate().first('id','media_sources');
          if(!row)continue; // Parent creation/deletion may own a nested operation.
          await database('products').where({id}).update({media_sources:JSON.stringify(nextMediaSources(row.media_sources,group,'children')),updated_at:new Date().toISOString()});
        }
        return payload;
      });
    }
  }
  for(const event of ['create','update','delete']) {
    filter(`page_sections.items.${event}`,async(payload,meta,{database})=>{
      requireTransaction(database);
      const parents=new Map();
      const collect=row=>{
        for(const [field,collection] of [['page','pages'],['home_page','home_page']]) {
          const id=idOf(row?.[field]);if(id!=null)parents.set(`${collection}:${id}`,{collection,id:String(id)});
        }
      };
      if(event!=='delete')collect(payload);
      if(event!=='create') {
        const keys=keyList(event==='delete'?payload:null,meta);
        if(keys.length)for(const row of await database('page_sections').whereIn('id',keys).select('page','home_page'))collect(row);
      }
      for(const key of [...parents.keys()].sort()) {
        const {collection,id}=parents.get(key);
        const parent=await database(collection).where({id}).forUpdate().first('id');
        if(parent)await database(collection).where({id}).update({updated_at:new Date().toISOString()});
      }
      return payload;
    });
  }
}
