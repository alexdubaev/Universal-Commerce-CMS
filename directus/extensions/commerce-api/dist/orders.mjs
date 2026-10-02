import { createHash } from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEADER_FIELDS=['customer_name','phone','email','comment','page_url','utm_source','utm_medium','utm_campaign','utm_content','utm_term','marketing_consent','marketing_consent_at','marketing_consent_version','currency'];
const OMIT_FROM_FINGERPRINT=new Set(['page_url','utm_source','utm_medium','utm_campaign','utm_content','utm_term','marketing_consent_at','marketing_consent_version']);
const fail=(status,message,code='INVALID_PAYLOAD')=>Object.assign(new Error(message),{status,code});
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));return value??null}
const minor=value=>Math.round((value+Number.EPSILON)*100);
export function orderFingerprint(order,items){
  return createHash('sha256').update(JSON.stringify(stable({order:Object.fromEntries(Object.entries(order).filter(([key])=>!OMIT_FROM_FINGERPRINT.has(key))),items:items.map(({product,quantity,unit_price})=>({product,quantity,unit_price}))}))).digest('hex');
}
/** Atomic, durable first-party order submission. Both the row and its items are
 * saved on the SAME PostgreSQL transaction. A request key is unique in the DB;
 * an advisory transaction lock serializes retries across processes. RBAC remains
 * enforced by ItemsService with the requesting user's accountability. */
export function createAtomicOrderHandler({database,services,getSchema,logger}) {
 return async(req,res)=>{
  if(!req.accountability?.user)return res.status(403).json({errors:[{code:'FORBIDDEN',message:'Требуется авторизация.'}]});
  try{
   const {request_key,order,items}=req.body??{};
   if(typeof request_key!=='string'||!UUID.test(request_key)||!order||Array.isArray(order)||typeof order!=='object'||!Array.isArray(items)||!items.length||items.length>100||JSON.stringify(req.body).length>512000)throw fail(400,'Проверьте идентификатор и состав заказа.');
   if(Object.keys(order).some(k=>!HEADER_FIELDS.includes(k))||typeof order.customer_name!=='string'||order.customer_name.trim().length<2||order.customer_name.length>100||typeof order.phone!=='string'||order.phone.length<7||order.phone.length>40||typeof order.page_url!=='string'||order.page_url.length>1000||!/^https?:\/\//.test(order.page_url)||typeof order.currency!=='string')throw fail(400,'Проверьте контактные данные заказа.');
   for(const [key,value]of Object.entries(order))if(value!=null&&key!=='marketing_consent'&&(typeof value!=='string'||value.length>2000))throw fail(400,'Недопустимые данные заказа.');
   if(order.marketing_consent!=null&&typeof order.marketing_consent!=='boolean')throw fail(400,'Недопустимые данные согласия.');
   for(const item of items)if(!item||typeof item.product!=='string'||!UUID.test(item.product)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>10000||typeof item.unit_price!=='number'||!Number.isFinite(item.unit_price)||item.unit_price<0||item.unit_price>1e9)throw fail(400,'Проверьте позиции заказа.');
   const fingerprint=orderFingerprint(order,items),schema=await getSchema();
   const result=await database.transaction(async trx=>{
    const lock=createHash('sha256').update('commerce-order:'+request_key.toLowerCase()).digest();
    await trx.raw("SET LOCAL lock_timeout = '5s'");
    await trx.raw('SELECT pg_advisory_xact_lock(?, ?)',[lock.readInt32BE(0),lock.readInt32BE(4)]);
    const service=collection=>new services.ItemsService(collection,{schema,accountability:req.accountability,knex:trx});
    const orders=service('orders');
    const previous=await orders.readByQuery({filter:{request_key:{_eq:request_key}},fields:['id','request_fingerprint'],limit:1});
    if(previous.length){
      if(previous[0].request_fingerprint!==fingerprint)throw fail(409,'Этот идентификатор уже относится к другому запросу.','IDEMPOTENCY_CONFLICT');
      return {id:previous[0].id,replayed:true};
    }
    const settings=await service('site_settings').readByQuery({fields:['commerce_profile'],limit:1});
    const profile=settings[0]?.commerce_profile;
    if(!profile||profile.features?.cart!==true||profile.currency!==order.currency)throw fail(409,'Оформление заказа или выбранная валюта недоступны.','CATALOG_CHANGED');
    const ids=[...new Set(items.map(x=>x.product))];
    const products=await service('products').readByQuery({filter:{_and:[{status:{_eq:'published'}},{id:{_in:ids}}]},fields:['id','status','sku','title','brand','price','price_status','currency'],limit:ids.length});
    const byId=new Map(products.map(p=>[p.id,p]));let total=0;
    const lines=items.map(item=>{
      const p=byId.get(item.product),price=Number(p?.price);
      if(!p||p.status!=='published'||p.price_status!=='fixed'||p.currency!==profile.currency||p.price==null||String(p.price).trim()===''||!Number.isFinite(price)||price<0||price>1e9||minor(price)!==minor(item.unit_price)||!p.sku||!p.title)throw fail(409,'Цена или доступность товара изменились. Обновите корзину.','CATALOG_CHANGED');
      total+=minor(price)*item.quantity;
      if(!Number.isSafeInteger(total)||total>999999999999)throw fail(400,'Сумма заказа превышает допустимый лимит.');
      return {product:p.id,sku_snapshot:p.sku,title_snapshot:p.title,brand_snapshot:p.brand??null,unit_price:minor(price)/100,quantity:item.quantity,currency:profile.currency};
    });
    const id=await orders.createOne({...order,status:'new',total:total/100,currency:profile.currency,request_key,request_fingerprint:fingerprint});
    await service('order_items').createMany(lines.map(line=>({...line,order:id})));
    return {id,replayed:false};
   });
   return res.json({data:result});
  }catch(error){
   const status=error.status??(error.code==='FORBIDDEN'?403:['RECORD_NOT_UNIQUE','23505'].includes(error.code)?409:500);
   logger?.warn?.({code:error.code??'ORDER_WRITE_FAILED'},'Atomic order request failed');
   return res.status(status).json({errors:[{code:error.code??'ORDER_WRITE_FAILED',message:status<500?error.message:'Сохранение не подтверждено. Повторяйте только с тем же идентификатором запроса.'}]});
  }
 };
}
