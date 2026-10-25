import { useApi } from "@directus/extensions-sdk";
import { computed, defineComponent, h, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { AdminShell, CollectionList, MediaPicker, NativeFieldGroup, ReadonlyDetails, SectionTabs, buildCollectionQuery } from "../admin-shell.js";
import { createEditorState } from "../admin-state.mjs";

export const ARTICLE_LIST_FIELDS = Object.freeze(["id","title","slug","status","category_label","published_at","is_featured","updated_at"]);
export const ARTICLE_MAIN_FIELDS = Object.freeze(["title","slug","excerpt","published_at","author","reviewer","category_label","reading_time_minutes"]);
export const ARTICLE_REQUIRED_FIELDS = Object.freeze(["title","slug","excerpt","content","published_at"]);
const TABS = Object.freeze([
  {id:"main",label:"Основное",fields:ARTICLE_MAIN_FIELDS},
  {id:"material",label:"Материал",fields:["content","cover_image","image_alt"]},
  {id:"relations",label:"Товары и категории",fields:["related_categories","related_products","sources","is_featured","sort_order"]},
  {id:"seo",label:"Поиск и ссылки",fields:["seo_title","seo_description","og_image","seo"]},
  {id:"other",label:"Дополнительно",fields:["translations","id","created_at","updated_at"]},
]);
const ALL=[...new Set([...ARTICLE_LIST_FIELDS,...TABS.flatMap(tab=>tab.fields),"content","content_blocks","editor_nodes","status","sources"])];
const EDITABLE=ALL.filter(field=>!["id","created_at","updated_at","editor_nodes","status","sources"].includes(field));
const COMPARISON_LABELS=Object.freeze({title:"Название статьи",slug:"Адрес статьи",excerpt:"Краткое описание",content:"Текст статьи",cover_image:"Обложка",image_alt:"Описание изображения",published_at:"Дата публикации",category_label:"Категория",reading_time_minutes:"Время чтения",author:"Автор",reviewer:"Редактор",related_categories:"Связанные категории",related_products:"Связанные товары",is_featured:"Закрепление",sort_order:"Порядок",seo_title:"Заголовок для поисковых ссылок",seo_description:"Описание для поисковых ссылок",og_image:"Изображение для ссылки"});
const COMPARISON_REFERENCES=new Set(["author","reviewer","cover_image","related_categories","related_products","og_image"]);
const relationCountText=value=>{let items=value;if(typeof value==="string"){try{const parsed=JSON.parse(value);if(Array.isArray(parsed))items=parsed;else return"Связано";}catch{return"Связано";}}if(!Array.isArray(items))return"Связано";const count=items.length;if(!count)return"Не указано";const last=count%10,teens=count%100;return`${count} ${teens>=11&&teens<=14?"связей":last===1?"связь":last>=2&&last<=4?"связи":"связей"}`;};
const displayComparisonValue=(field,value)=>{
  if(value==null||value==="")return "—";
  if(["related_categories","related_products"].includes(field))return relationCountText(value);
  if(field==="published_at")return dateText(value);
  if(COMPARISON_REFERENCES.has(field))return Array.isArray(value)&&value.length===0?"Не указано":"Связано";
  if(typeof value==="object")return "Составное значение скрыто";
  if(typeof value==="string"&&/[0-9a-f]{8}-[0-9a-f-]{27,}/i.test(value))return "Идентификатор скрыт";
  const text=field==="content"?String(value).replace(/<!--[\s\S]*?-->/g," ").replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi," ").replace(/<[^>]*>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'"):String(value);
  const plain=text.replace(/\s+/g," ").trim();if(field==="content"&&/[<>]/.test(String(value))&&plain===String(value).replace(/\s+/g," ").trim())return"Разметка или форматирование изменились";return plain.length>180?plain.slice(0,177)+"…":plain;
};
export function articleComparisonRows(own={},remote={}) {
  return EDITABLE.filter(field=>COMPARISON_LABELS[field]&&Object.hasOwn(own,field)&&Object.hasOwn(remote,field)&&!same(own[field],remote[field])).map(field=>{let left=displayComparisonValue(field,own[field]),right=displayComparisonValue(field,remote[field]);if(field==="content"&&left===right)left=right="Форматирование или разметка изменились";return{field,label:COMPARISON_LABELS[field],own:left,remote:right};});
}
const STRUCTURAL=new Set(["content_blocks","editor_nodes","sources"]);const ORIGIN_GUARDED=new Set(["content","seo","translations"]);
const STATUSES={draft:"Черновик",published:"Опубликована",archived:"Архив"};
const SEO_PROJECTIONS=Object.freeze({seo_title:"title",seo_description:"meta_description",og_image:"og_image"});
const ARTICLE_RELATION_FIELDS=new Set(["related_categories","related_products"]);
const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
const data=response=>response?.data?.data;
const has=(permissions,field)=>permissions===true||Array.isArray(permissions)&&(permissions.includes("*")||permissions.includes(field));
const fieldsOf=fields=>Array.isArray(fields)?fields:Object.values(fields??{});
const fieldLabel=field=>field?.name??field?.meta?.translations?.find(item=>item.language==="ru-RU")?.translation??field?.field;
const statusOf=error=>error?.response?.status??error?.status;
const codeOf=error=>error?.response?.data?.errors?.[0]?.extensions?.code??error?.response?.data?.errors?.[0]?.code;
const writableMeta=field=>field&&field.type!=="alias"&&field.meta?.readonly!==true&&field.readonly!==true&&field.schema?.is_generated!==true&&!['group-detail','group-accordion'].includes(field.meta?.interface);

export function buildArticlesQuery({page=1,search="",sort="-published_at",filters={}}={}) {
  const field=String(sort).replace(/^-/,"");
  if(!["title","slug","status","category_label","published_at","is_featured","updated_at"].includes(field)||!/^(-)?[a-z_]+$/.test(sort))throw new TypeError("Unknown article sort");
  const and=[],needle=typeof search==="string"?search.trim():"";
  if(needle)and.push({_or:["title","slug","excerpt"].map(name=>({[name]:{_icontains:needle}}))});
  if(filters.status!=null&&filters.status!==""){if(!Object.hasOwn(STATUSES,filters.status))throw new TypeError("Invalid article status");and.push({status:{_eq:filters.status}});}
  if(filters.category_label!=null&&filters.category_label!==""){if(typeof filters.category_label!=="string")throw new TypeError("Invalid article category");and.push({category_label:{_eq:filters.category_label}});}
  if(filters.is_featured!=null&&filters.is_featured!==""){if(![true,false,"true","false"].includes(filters.is_featured))throw new TypeError("Invalid featured value");and.push({is_featured:{_eq:filters.is_featured===true||filters.is_featured==="true"}});}
  return {...buildCollectionQuery({fields:ARTICLE_LIST_FIELDS,page,pageSize:25,sort:`${sort},id`,filter:and.length?{_and:and}:undefined}),meta:"filter_count"};
}

export function articlePermissions(effective={},item=null) {
  const collection=effective?.articles??{};
  const fields=action=>["full","partial"].includes(collection[action]?.access)&&Array.isArray(collection[action]?.fields)?[...collection[action].fields]:[];
  return {read:fields("read"),update:item?.update?.access===true?fields("update"):[],create:collection.create?.access==="full"&&Array.isArray(collection.create.fields)?[...collection.create.fields]:[]};
}

export function parseArticleDate(value) {
  if(typeof value!=="string")return null;
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})$/i.exec(value);
  if(!m)return null;
  const [,ys,mos,ds,hs,mins,ss="00",_fraction="",zone]=m,y=+ys,mo=+mos,d=+ds,hour=+hs,minute=+mins,second=+ss,calendar=new Date(Date.UTC(y,mo-1,d));
  if(calendar.getUTCFullYear()!==y||calendar.getUTCMonth()!==mo-1||calendar.getUTCDate()!==d||hour>23||minute>59||second>59)return null;
  if(zone.toUpperCase()!=="Z"){const z=/^([+-])(\d{2}):(\d{2})$/.exec(zone);if(!z||+z[2]>14||+z[3]>59||+z[2]===14&&+z[3]!==0)return null;}
  const stamp=Date.parse(value);return Number.isFinite(stamp)?new Date(stamp).toISOString():null;
}

export function articlePublicationState(status,publishedAt,now=Date.now()) {
  if(status==="published") {
    const instant=parseArticleDate(publishedAt);
    if(!instant)return{label:"Ошибка даты",kind:"invalid-date",publicNow:false};
    if(Date.parse(instant)>now)return{label:"Запланирована",kind:"scheduled",publicNow:false};
    return{label:STATUSES.published,kind:"published",publicNow:true};
  }
  if(Object.hasOwn(STATUSES,status))return{label:STATUSES[status],kind:status,publicNow:false};
  return{label:"Недоступен",kind:"unknown",publicNow:false};
}
export function createNativeEditAuthorization() {
  const authorized=new Set();
  return{authorize:field=>authorized.add(field),has:field=>authorized.has(field),consume:field=>authorized.delete(field),reset:()=>authorized.clear()};
}

const seoScalar=value=>typeof value==="string"?value.trim()||null:value&&typeof value==="object"?value.id??value:null;
const seoObject=value=>value&&typeof value==="object"&&!Array.isArray(value)?value:null;
function seoInitialValues(values={}) {
  const initial={...(seoObject(values.seo)??{})};
  for(const [field,key] of Object.entries(SEO_PROJECTIONS))if(!Object.hasOwn(initial,key)&&values[field]!=null)initial[key]=seoScalar(values[field]);
  return initial;
}
export function articleSeoScalarValues(values={}) {
  const seo=seoObject(values.seo)??{};
  const project=(field,key)=>Object.hasOwn(seo,key)?seoScalar(seo[key])??"":seoScalar(values[field])??"";
  return{seo_title:project("seo_title","title"),seo_description:project("seo_description","meta_description"),og_image:project("og_image","og_image")};
}
export function articleSeoDisplayValues(baseline={},current=baseline,intents={}) {
  const projected=articleSeoScalarValues(baseline);
  for(const field of Object.keys(SEO_PROJECTIONS))if(Object.hasOwn(intents,field))projected[field]=seoScalar(intents[field])??"";else if(!same(current[field],baseline[field]))projected[field]=seoScalar(current[field])??"";
  return projected;
}
function seoProjectionErrors(values,baseline) {
  const errors=[],current=seoObject(values.seo)??{},original=seoObject(baseline.seo)??{};
  for(const [field,key] of Object.entries(SEO_PROJECTIONS)) {
    const scalarChanged=!same(seoScalar(values[field]),seoScalar(baseline[field]));
    const fallback=seoScalar(baseline[field]),before=Object.hasOwn(original,key)?seoScalar(original[key]):fallback,after=Object.hasOwn(current,key)?seoScalar(current[key]):seoScalar(values[field]);
    if(scalarChanged&&!same(after,seoScalar(values[field]))&&!same(after,before))errors.push({field,type:"SEO_PROJECTION_CONFLICT",message:"Проверьте поисковые настройки или отмените последнее изменение."});
  }
  return errors;
}
function synchronizeSeoProjection(payload,values,baseline) {
  if(!Object.hasOwn(payload.changes??{},"seo"))return payload;
  const current=seoObject(payload.changes.seo);if(!current)return payload;
  const seo={...current},original=seoObject(baseline.seo)??{};
  for(const [field,key] of Object.entries(SEO_PROJECTIONS)) {
    const scalarChanged=!same(seoScalar(values[field]),seoScalar(baseline[field]));
    const fallback=seoScalar(baseline[field]),before=Object.hasOwn(original,key)?seoScalar(original[key]):fallback,after=Object.hasOwn(current,key)?seoScalar(current[key]):fallback;
    if(scalarChanged&&same(after,before))seo[key]=seoScalar(values[field]);
  }
  return{...payload,changes:{...payload.changes,seo}};
}

export function validateArticle(values={},metadata=[],baseline={}) {
  const errors=[];
  for(const field of fieldsOf(metadata)){
    const name=field.field;if(!EDITABLE.includes(name)||!Object.hasOwn(values,name))continue;
    const value=values[name],fail=(message,reason)=>errors.push({field:name,type:"FAILED_VALIDATION",...(reason?{reason}:{}),message:`${fieldLabel(field)||name}: ${message}`});
    if((field.meta?.required||field.schema?.is_nullable===false)&&(value==null||typeof value==="string"&&!value.trim())){fail("обязательное поле","required");continue;}
    if(value==null||value==="")continue;
    const choices=field.meta?.options?.choices;if(choices?.length&&!choices.some(choice=>same(typeof choice==="object"?choice.value:choice,value)))fail("недопустимое значение");
    if(name==="slug"&&(typeof value!=="string"||! /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,159}$/u.test(value)))fail("допустимы буквы, цифры, дефис и подчёркивание; до 160 символов");
    if(name==="published_at"&&!parseArticleDate(value))fail("укажите корректные дату, время и часовой пояс");
    if(field.type==="integer"&&!Number.isSafeInteger(value))fail("нужно целое число");
    if(field.type==="boolean"&&typeof value!=="boolean")fail("нужно логическое значение");
    if(["string","text"].includes(field.type)&&typeof value!=="string")fail("нужен текст");
    if(typeof value==="string"&&field.schema?.max_length&&value.length>field.schema.max_length)fail(`максимум ${field.schema.max_length} символов`);
    if(field.type==="json"&&typeof value==="string"){
      if(Object.hasOwn(baseline,name)&&same(value,baseline[name]))continue;
      if(ARTICLE_RELATION_FIELDS.has(name))try{if(Array.isArray(JSON.parse(value)))continue;}catch{}
      fail("нужен JSON объект или массив");
    }
  }
  return errors;
}

const canCreateWith=(metadata,permissions)=>ARTICLE_REQUIRED_FIELDS.every(name=>has(permissions.create,name)&&has(permissions.read,name)&&writableMeta(metadata.find(field=>field.field===name)))&&has(permissions.create,"status")&&metadata.some(field=>field.field==="status"&&field.schema?.default_value==="draft"&&field.meta?.options?.choices?.some(choice=>(typeof choice==="object"?choice.value:choice)==="draft"));
const articleValidationDetail=error=>{const field=COMPARISON_LABELS[error?.field]?error.field:null,type=error?.type;if(type==="SEO_PROJECTION_CONFLICT")return"Проверьте поисковые настройки или отмените последнее изменение.";if(type==="READ_REQUIRED_FOR_PUBLISH")return"Не удалось проверить поле из-за ограничений доступа.";if(type==="RECORD_NOT_UNIQUE")return"Такое значение уже используется.";if(type==="FAILED_VALIDATION"&&error?.reason==="required")return"Заполните обязательное поле.";if(type==="FAILED_VALIDATION"&&field==="slug")return"Используйте буквы, цифры, дефис и подчёркивание; до 160 символов.";if(type==="FAILED_VALIDATION"&&field==="published_at")return"Укажите корректные дату, время и часовой пояс.";if(type==="FAILED_VALIDATION"&&["related_categories","related_products"].includes(field))return"Проверьте выбранные связи.";return"Проверьте поле и повторите сохранение.";};
const readableError=error=>{if(error?.articleValidationMessage)return error.articleValidationMessage;const status=statusOf(error),code=codeOf(error);if(status===403||code==="FORBIDDEN")return"Недостаточно прав для статей.";if(status===404)return"Запись недоступна или удалена.";if(status===409||code==="RECORD_NOT_UNIQUE")return"Конфликт данных или уникальности. Ввод сохранён на экране.";return"Не удалось подтвердить запрос. Сравните данные и повторите чтение.";};
/** Article list and record orchestration; item writes always use the shared A0 CAS state. */
export function createArticlesController(api,{onChange}={}) {
  let disposed=false,generation=0,listGeneration=0,identity=null,metadata=[],permissions={read:[],update:[],create:[]},filePermissions={},state=null;
  let ready=false,opening=false,busy=false,creating=false,defaults={},draft={},createdId=null,uncertainCreate=false,failure=null,validation=[],comparison=null,createMatches=null,createMatchError=null;
  const seoProjectionIntents=new Map();
  let rows=[],total=null,page=1,search="",sort="-published_at",filters={},listLoading=false,listError=null,denied=false,canCreate=false,statusUncertain=false,statusError=null;
  const notify=()=>{if(!disposed)onChange?.(snapshot());};
  const readable=()=>ALL.filter(name=>metadata.some(field=>field.field===name)&&has(permissions.read,name)&&name!=="editor_nodes");
  const loader=async id=>{const record=data(await api.get(`/items/articles/${encodeURIComponent(id)}`,{params:{fields:readable().join(",")}}));if(!record||String(record.id)!==String(id)||!Object.hasOwn(record,"updated_at"))throw Error("Article identity/version missing");return Object.fromEntries(readable().filter(name=>Object.hasOwn(record,name)).map(name=>[name,record[name]]));};
  const values=()=>{const current=creating?copy(draft):copy(state?.values??{});for(const [field,value] of seoProjectionIntents)current[field]=copy(value);return current;};
  const blocked=()=>!ready||opening||busy||failure||state?.loading||state?.saving||state?.conflict||state?.writeUncertain||uncertainCreate||statusUncertain||Boolean(createdId);
  const canChange=name=>!blocked()&&EDITABLE.includes(name)&&!STRUCTURAL.has(name)&&writableMeta(metadata.find(field=>field.field===name))&&(creating?has(permissions.create,name)&&has(permissions.read,name):Boolean(state?.canWrite(name)))&&(!Object.hasOwn(SEO_PROJECTIONS,name)||(creating?has(permissions.read,"seo")&&has(permissions.create,"seo"):has(permissions.read,"seo")&&Boolean(state?.canWrite("seo"))));
  const canSave=()=>!blocked()&&!validation.length&&(creating?canCreateWith(metadata,permissions)&&!same(draft,defaults):Boolean(state?.canSave));
  function snapshot(){return{ready,metadata:copy(metadata),permissions:copy(permissions),filePermissions:copy(filePermissions),creating,createdId,loading:opening||Boolean(state?.loading),saving:busy||Boolean(state?.saving),values:values(),baseline:creating?copy(defaults):state?.baseline??{},seoProjectionIntents:Object.fromEntries(seoProjectionIntents),dirty:creating?!createdId&&!same(draft,defaults):Boolean(state?.dirty),dirtyFields:creating?Object.keys(draft).filter(name=>!same(draft[name],defaults[name])):state?.dirtyFields??[],conflict:Boolean(state?.conflict),writeUncertain:uncertainCreate||Boolean(state?.writeUncertain),statusUncertain,statusError,readError:failure||state?.readError,saveError:state?.saveError,saved:Boolean(createdId||state?.saved),validation:copy(validation),comparison:copy(comparison),createMatches:copy(createMatches),createMatchError,readonly:creating?!canCreateWith(metadata,permissions):!EDITABLE.some(canChange),canCreate,canSave:canSave(),rows:copy(rows),total,page,search,sort,filters:copy(filters),listLoading,listError,denied};}
  async function openList(){
    const seq=++listGeneration;listLoading=true;listError=null;denied=false;canCreate=false;notify();
    try{const access=data(await api.get("/permissions/me"));if(seq!==listGeneration||disposed)return{ok:false,stale:true};permissions=articlePermissions(access);const schema=data(await api.get("/fields/articles"));if(seq!==listGeneration||disposed)return{ok:false,stale:true};metadata=fieldsOf(schema).filter(field=>ALL.includes(field.field));
      if(!ARTICLE_LIST_FIELDS.every(name=>has(permissions.read,name)))throw Object.assign(Error("Article list read permission unavailable"),{status:403});canCreate=canCreateWith(metadata,permissions);return await query({});
    }catch(error){if(seq===listGeneration&&!disposed){rows=[];total=null;listError=error;denied=statusOf(error)===403;}return{ok:false,error};}
    finally{if(seq===listGeneration&&!disposed){listLoading=false;notify();}}
  }
  async function query(change={}){
    if(disposed)return{ok:false,stale:true};
    const nextFilters=change.filters??filters,nextSearch=change.search??search,nextSort=change.sort??sort,nextPage=change.page??(Object.hasOwn(change,"filters")||Object.hasOwn(change,"search")||Object.hasOwn(change,"sort")?1:page);
    const params=buildArticlesQuery({page:nextPage,search:nextSearch,sort:nextSort,filters:nextFilters});page=nextPage;search=nextSearch;sort=nextSort;filters=copy(nextFilters);
    const seq=++listGeneration;listLoading=true;listError=null;notify();
    try{const response=await api.get("/items/articles",{params});if(seq!==listGeneration||disposed)return{ok:false,stale:true};const result=data(response);if(!Array.isArray(result)||result.length>25)throw Error("Invalid article page");rows=result;const count=response?.data?.meta?.filter_count;total=Number.isSafeInteger(count)&&count>=0?count:null;return{ok:true};}
    catch(error){if(seq===listGeneration&&!disposed){rows=[];total=null;listError=error;denied=statusOf(error)===403;}return{ok:false,error};}
    finally{if(seq===listGeneration&&!disposed){listLoading=false;notify();}}
  }
  async function open(id){
    if(busy||state?.saving)return{ok:false,reason:"busy"};const seq=++generation;identity=id;opening=true;ready=false;failure=null;state=null;comparison=null;createMatches=null;createMatchError=null;statusUncertain=false;statusError=null;validation=[];seoProjectionIntents.clear();creating=String(id)==="+";createdId=null;uncertainCreate=false;notify();
    try{const [schemaResponse,accessResponse]=await Promise.all([api.get("/fields/articles"),api.get("/permissions/me")]);if(seq!==generation||disposed)return{ok:false,stale:true};const allMetadata=fieldsOf(data(schemaResponse));metadata=allMetadata.filter(field=>ALL.includes(field.field));const effective=data(accessResponse);filePermissions=effective?.directus_files??{};let item=null;
      if(!creating){item=data(await api.get(`/permissions/me/articles/${encodeURIComponent(id)}`));if(seq!==generation||disposed)return{ok:false,stale:true};}permissions=articlePermissions(effective,item);
      if(!has(permissions.read,"id")||!has(permissions.read,"updated_at"))throw Object.assign(Error("Article identity/version read denied"),{status:403});
      if(creating){if(!canCreateWith(metadata,permissions))throw Object.assign(Error("Native draft creation unavailable"),{status:403});defaults=Object.fromEntries(metadata.filter(field=>EDITABLE.includes(field.field)&&has(permissions.read,field.field)&&has(permissions.create,field.field)&&writableMeta(field)).map(field=>[field.field,copy(field.schema?.default_value??null)]));defaults.status="draft";draft=copy(defaults);}
      else{const next=createEditorState({collection:"articles",editableFields:EDITABLE,permissions,fieldMetadata:Object.fromEntries(metadata.map(field=>[field.field,field])),guardedContract:true});const result=await next.load(loader,id);if(seq!==generation||disposed)return{ok:false,stale:true};if(!result.ok)throw result.error??Error("Article read failed");state=next;}
      ready=true;return{ok:true};
    }catch(error){if(seq===generation&&!disposed)failure=error;return{ok:false,error};}
    finally{if(seq===generation&&!disposed){opening=false;notify();}}
  }
  function change(name,value,origin={}){if(value===undefined||!canChange(name)||ORIGIN_GUARDED.has(name)&&!(origin.trustedFields??[]).includes(name))return false;if(["cover_image","og_image"].includes(name))value=value&&typeof value==="object"?value.id??null:value;let ok;
    if(creating)ok=(draft[name]=copy(value),true);
    else if(Object.hasOwn(SEO_PROJECTIONS,name)){
      const baseline=state.baseline,initial=articleSeoScalarValues(baseline)[name];
      if(same(value,initial)){seoProjectionIntents.delete(name);ok=state.change(name,baseline[name])||same(state.values[name],baseline[name]);}
      else if(same(value,baseline[name])&&!same(value,initial)){ok=state.change(name,"__article_seo_projection_intent__");if(ok)seoProjectionIntents.set(name,copy(value));}
      else{seoProjectionIntents.delete(name);ok=state.change(name,value);}
    }else ok=state.change(name,value);
    if(ok){validation=[];comparison=null;statusError=null;notify();}return ok;}
  function changeTab(names,next,origin={}){if(blocked())return false;let changed=false;for(const name of names??[]){if(!canChange(name)||ORIGIN_GUARDED.has(name)&&!(origin.trustedFields??[]).includes(name))continue;const value=Object.hasOwn(next??{},name)?next[name]:(creating?defaults[name]:state.baseline[name]);if(!same(values()[name],value))changed=change(name,value,origin)||changed;}return changed;}
  const canCreateField=name=>has(permissions.create,name)&&has(permissions.read,name)&&writableMeta(metadata.find(field=>field.field===name))&&!STRUCTURAL.has(name);
  async function save({confirmPublished=false}={}){
    if(!canSave())return{ok:false,reason:"unavailable"};if(!creating&&state.baseline.status==="published"&&!confirmPublished)return{ok:false,reason:"confirmation"};
    validation=validateArticle(values(),metadata.filter(field=>has(permissions.read,field.field)),creating?{}:state.baseline);if(validation.length){notify();return{ok:false,reason:"validation"};}
    if(!creating){const errors=seoProjectionErrors(values(),state.baseline);if(errors.length){validation=errors;notify();return{ok:false,reason:"validation"};}}busy=true;notify();
    if(creating){const body=Object.fromEntries(EDITABLE.filter(name=>name!=="status"&&canCreateField(name)&&Object.hasOwn(draft,name)&&(!same(draft[name],defaults[name])||ARTICLE_REQUIRED_FIELDS.includes(name))).map(name=>[name,copy(draft[name])]));body.status="draft";const scalarFields=Object.keys(SEO_PROJECTIONS).filter(field=>Object.hasOwn(body,field));if(scalarFields.length&&canCreateField("seo")){const seo={...(seoObject(defaults.seo)??{})};for(const field of scalarFields)seo[SEO_PROJECTIONS[field]]=seoScalar(body[field]);body.seo=seo;}
      try{const ack=data(await api.post("/items/articles",body));if(typeof ack?.id!=="string"||!ack.id||ack.status!=="draft"||ack.slug!==body.slug||ARTICLE_REQUIRED_FIELDS.some(name=>!Object.hasOwn(ack,name)))throw Error("Unconfirmed draft creation");createdId=ack.id;return{ok:true,createdId};}
      catch(error){const definite=["RECORD_NOT_UNIQUE","FAILED_VALIDATION","INVALID_PAYLOAD","FORBIDDEN"].includes(codeOf(error))&&[400,403,409,422].includes(statusOf(error));if(definite)validation=[{field:codeOf(error)==="RECORD_NOT_UNIQUE"?"slug":"title",type:codeOf(error),message:readableError(error)}];else uncertainCreate=true;return{ok:false,error};}
      finally{busy=false;notify();}}
    try{const result=await state.save(async(_collection,id,payload)=>{
      const scalarFields=Object.keys(SEO_PROJECTIONS).filter(field=>Object.hasOwn(payload.changes??{},field)||seoProjectionIntents.has(field));
      let changes={...payload.changes};
      if(scalarFields.length){const seo={...(seoObject(changes.seo)??seoObject(state.baseline.seo)??{})};for(const field of scalarFields)seo[SEO_PROJECTIONS[field]]=seoScalar(values()[field]);changes.seo=seo;for(const [field,value] of seoProjectionIntents)changes[field]=seoScalar(value);}
      const expected=scalarFields.length&&Object.hasOwn(state.baseline,"seo")?{...payload.expected,seo:copy(state.baseline.seo)}:payload.expected;
      const guarded=synchronizeSeoProjection({...payload,expected,changes},values(),state.baseline);
      return data(await api.post(`/commerce/mutations/articles/${encodeURIComponent(id)}`,guarded));
    });if(!result.ok){const status=statusOf(result.error),errors=result.error?.response?.data?.errors??[];validation=[400,422].includes(status)?errors.filter(error=>typeof error?.extensions?.field==="string"||typeof error?.field==="string").map(error=>{const raw=error?.extensions?.field??error?.field,field=EDITABLE.includes(raw)?raw:"title";return{field,type:error?.extensions?.code??error?.code??"ERROR",message:`Проверьте поле «${COMPARISON_LABELS[field]??field}» и повторите сохранение.`};}):[];return result;}
      const refreshed=await state.reconcile(loader,identity,{keepEdits:false});if(!refreshed.ok){failure=refreshed.error??Error("Post-save article read failed");return{ok:false,committed:true,error:failure};}failure=null;seoProjectionIntents.clear();return{ok:true,record:refreshed.record};
    }finally{busy=false;notify();}}
  async function compare(){if(creating||!state||busy||opening)return{ok:false};busy=true;notify();try{comparison=copy(await loader(identity));return{ok:true};}catch(error){return{ok:false,error};}finally{busy=false;notify();}}
  async function lookupCreatedBySlug(){
    if(!creating||!uncertainCreate||busy||opening||typeof values().slug!=="string"||!values().slug.trim())return{ok:false,reason:"unavailable"};
    if(!has(permissions.read,"id")||!has(permissions.read,"slug")){createMatchError=Error("Exact-slug lookup is not permitted");notify();return{ok:false,error:createMatchError};}
    busy=true;createMatchError=null;createMatches=null;notify();
    try{const fields=["id","slug","title","status"].filter(field=>has(permissions.read,field));const response=await api.get("/items/articles",{params:{fields:fields.join(","),limit:5,filter:{slug:{_eq:values().slug}}}});const result=data(response);if(!Array.isArray(result)||result.some(record=>record.slug!==values().slug||typeof record.id!=="string"))throw Error("Invalid exact-slug lookup response");createMatches=copy(result);return{ok:true,matches:copy(result)};}
    catch(error){createMatchError=error;return{ok:false,error};}
    finally{busy=false;notify();}
  }
  async function reconcile(keepEdits){if(!state||busy||opening||!comparison)return{ok:false,reason:"compare-first"};busy=true;notify();try{const result=await state.reconcile(loader,identity,{keepEdits:Boolean(keepEdits)});if(result.ok){comparison=null;failure=null;statusUncertain=false;statusError=null;validation=[];if(!keepEdits)seoProjectionIntents.clear();}return result;}finally{busy=false;notify();}}
  async function discardChanges(){
    if(busy||opening||uncertainCreate||createdId||statusUncertain||!snapshot().dirty)return{ok:false,reason:"unavailable"};
    if(creating){draft=copy(defaults);comparison=null;validation=[];notify();return{ok:true};}
    if(!state)return{ok:false,reason:"unavailable"};
    busy=true;notify();try{const result=await state.reconcile(loader,identity,{keepEdits:false});if(result.ok){comparison=null;failure=null;validation=[];seoProjectionIntents.clear();}return result;}finally{busy=false;notify();}
  }
  async function transitionStatus(nextStatus){
    const field=metadata.find(item=>item.field==="status");
    if(creating||!state||busy||opening||state.dirty||state.conflict||state.writeUncertain||statusUncertain||!Object.hasOwn(STATUSES,nextStatus)||!has(permissions.update,"status")||!writableMeta(field)||!field?.meta?.options?.choices?.some(choice=>(typeof choice==="object"?choice.value:choice)===nextStatus))return{ok:false,reason:"unavailable"};
    if(state.baseline.status===nextStatus)return{ok:true,unchanged:true};
    if(nextStatus==="published"){
      const current=values(),unavailable=ARTICLE_REQUIRED_FIELDS.filter(name=>!has(permissions.read,name)||!Object.hasOwn(current,name)||!metadata.some(item=>item.field===name));
      validation=unavailable.map(name=>({field:name,type:"READ_REQUIRED_FOR_PUBLISH",message:`Нельзя проверить обязательное поле «${fieldLabel(metadata.find(item=>item.field===name)??{field:name})}»: недостаточно прав на чтение.`}));
      if(!unavailable.length)validation=validateArticle(current,metadata.filter(item=>ARTICLE_REQUIRED_FIELDS.includes(item.field)),state.baseline);
      if(validation.length){statusError=Object.assign(Error(validation[0].message),{articleValidationMessage:validation[0].message});notify();return{ok:false,reason:"validation"};}
      statusError=null;
    } else {validation=[];statusError=null;}
    busy=true;statusError=null;notify();
    try{
      const expected={id:state.baseline.id,updated_at:state.baseline.updated_at,status:state.baseline.status};
      const ack=data(await api.post("/commerce/mutations/articles/"+encodeURIComponent(identity),{expected,changes:{status:nextStatus}}));
      if(!ack||String(ack.id)!==String(identity)||!Object.hasOwn(ack,"updated_at")||ack.status!==nextStatus)throw Error("Unconfirmed status acknowledgement");
      const refreshed=await state.reconcile(loader,identity,{keepEdits:false});if(!refreshed.ok)throw refreshed.error??Error("Status read-back failed");return{ok:true,record:refreshed.record};
    }catch(error){statusUncertain=true;statusError=error;return{ok:false,error};}
    finally{busy=false;notify();}
  }
  return{openList,query,retry:()=>listError?openList():query({}),open,change,changeTab,save,transitionStatus,compare,lookupCreatedBySlug,reconcile,discardChanges,snapshot,listSnapshot:snapshot,canChange,seoInitialValues:()=>seoInitialValues(values()),dispose:()=>{disposed=true;generation++;listGeneration++;}};
}
const ARTICLE_STYLE=`
.a4-articles{min-width:0;color:var(--theme--foreground,inherit)}.a4-articles *{box-sizing:border-box}.a4-articles__subtitle,.a4-articles__muted{color:var(--theme--foreground-subdued,#5f6f82);font-size:13px}.a4-articles__subtitle{margin:4px 0 18px}
.a4-articles__controls{display:grid;grid-template-columns:minmax(220px,1fr) minmax(120px,170px) auto minmax(180px,220px);gap:10px;margin-bottom:14px;min-width:0}.a4-articles__control,.a4-articles__button{min-height:40px;max-width:100%;border:1px solid var(--theme--border-color,#d9e1e8);border-radius:var(--theme--border-radius,6px);background:var(--theme--background,#fff);color:var(--theme--foreground,inherit);font:inherit;padding:8px 12px}.a4-articles__button{cursor:pointer}.a4-articles__primary{background:var(--theme--primary,#6644ff);border-color:var(--theme--primary,#6644ff);color:#fff}
.a4-articles__table-wrap{min-width:0;overflow:auto;border:1px solid var(--theme--border-color,#d9e1e8);border-radius:8px;background:var(--theme--background,#fff)}.a4-articles__table{width:100%;border-collapse:collapse;table-layout:fixed}.a4-articles__table th,.a4-articles__table td{padding:12px 14px;text-align:left;vertical-align:middle;border-bottom:1px solid var(--theme--border-color,#e5eaf0);overflow-wrap:anywhere}.a4-articles__table th{font-size:12px;color:var(--theme--foreground-subdued,#75859a);font-weight:600}.a4-articles__table tr:last-child td{border-bottom:0}.a4-articles__table th:first-child{width:42%}.a4-articles__table th:nth-child(2){width:14%}.a4-articles__table th:nth-child(3){width:15%}.a4-articles__table th:nth-child(4){width:19%}.a4-articles__table th:nth-child(5){width:10%;text-align:center}.a4-articles__name{display:block;font-weight:650;text-decoration:none;color:var(--theme--foreground,inherit);overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}.a4-articles__slug{display:block;margin-top:4px;font-size:12px;color:var(--theme--foreground-subdued,#75859a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.a4-articles__link:focus-visible,.a4-articles__button:focus-visible{outline:2px solid var(--theme--primary,#6644ff);outline-offset:2px}
.a4-articles-badge--draft{color:#926d13;background:#f5f0e2}.a4-articles-badge--published{color:#16835b;background:#e9f6f0}.a4-articles-badge--archived,.a4-articles-badge--unknown{color:#77869a;background:#eef1f4}.a4-articles-badge--scheduled{color:#5d65ba;background:#eff0ff}.a4-articles__footer{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px;color:var(--theme--foreground-subdued,#75859a);font-size:12px}.a4-articles__pager{display:flex;align-items:center;gap:8px}.a4-articles__empty{padding:45px 20px;text-align:center}.a4-articles__dialog{position:fixed;inset:0;width:min(420px,calc(100vw - 32px));height:fit-content;max-height:calc(100dvh - 32px);overflow:auto;overscroll-behavior:contain;margin:auto;border:1px solid var(--theme--border-color,#d9e1e8);border-radius:10px;padding:20px;color:var(--theme--foreground,inherit);background:var(--theme--background,#fff)}.a4-articles__dialog::backdrop{background:#17233455}.a4-articles__dialog h2{margin-top:0}.a4-articles__dialog-field{display:grid;gap:6px;margin:14px 0}.a4-articles__dialog-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:18px}@media(max-width:600px){.a4-articles__dialog{inset:auto 0 0 0;width:min(100%,640px);max-height:calc(100dvh - env(safe-area-inset-top,0px));margin:0 auto;border-radius:12px 12px 0 0;padding:20px 20px calc(20px + env(safe-area-inset-bottom,0px))}}
.a4-articles__main-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(250px,310px);gap:28px;padding:24px 28px}.a4-articles__fields{min-width:0}.a4-articles__fields h2{font-size:16px;margin:0 0 4px}.a4-articles__group{padding:0 0 20px;margin:0 0 22px;border-bottom:1px solid var(--theme--border-color,#e5eaf0)}.a4-articles__context{border-left:1px solid var(--theme--border-color,#e5eaf0);padding-left:24px;min-width:0}.a4-articles__context section{padding:16px;border:1px solid var(--theme--border-color,#d9e1e8);border-radius:8px;background:var(--theme--background-subdued,#f9fafb);margin-bottom:18px}.a4-articles__context h2{font-size:15px;margin:0 0 12px}.a4-articles__context dl{display:grid;gap:8px}.a4-articles__context dl div{display:flex;justify-content:space-between;gap:8px}.a4-articles__context dt,.a4-articles__context dd{margin:0}.a4-articles__context dd{font-weight:600;text-align:right;overflow-wrap:anywhere}.a4-articles__path{overflow-wrap:anywhere;font-size:13px;color:var(--theme--primary,#6644ff)}.a4-articles__warning{padding:12px 14px;border-inline-start:3px solid #8c74ed;background:var(--theme--background-subdued,#f7f5ff);color:var(--theme--foreground-subdued,#66788a)}
@media(max-width:800px){.a4-articles__controls{grid-template-columns:minmax(0,1fr) minmax(130px,170px)}.a4-articles__main-layout{grid-template-columns:minmax(0,1fr);padding:18px 16px;gap:16px}.a4-articles__context{border:0;border-top:1px solid var(--theme--border-color,#e5eaf0);padding:16px 0 0}.a4-articles__table th:first-child{width:48%}.a4-articles__table th:nth-child(2),.a4-articles__table td:nth-child(2){display:none}.a4-articles__table th:nth-child(3){width:20%}.a4-articles__table th:nth-child(4){width:23%}.a4-articles__table th:nth-child(5){width:9%}.a4-articles__table th,.a4-articles__table td{padding:10px 8px}}
@media(max-width:500px){.a4-articles__controls{grid-template-columns:minmax(0,1fr) minmax(115px,135px);gap:8px}.a4-articles__controls>*:first-child{grid-column:1/-1}.a4-articles__table th:first-child{width:52%}.a4-articles__table th:nth-child(3){width:22%}.a4-articles__table th:nth-child(4){width:26%}.a4-articles__table th:nth-child(5),.a4-articles__table td:nth-child(5){display:none}.a4-articles__table td{font-size:12px;padding:10px 6px}.a4-articles__table th{font-size:11px;padding:9px 6px}.a4-articles__footer{align-items:flex-start;flex-direction:column}.a4-articles__pager{width:100%;justify-content:space-between}}
`;
const ARTICLE_LAYOUT_STYLE=`.a4-articles__list .ac-shell__header{align-items:center}.a4-articles__heading{display:flex;align-items:baseline;gap:10px}.a4-articles__heading h1{font-size:24px;line-height:1.2}.a4-articles__heading>span{font-size:14px}.a4-articles__table time,.a4-articles__table small,.a4-articles__list .ac-list__scroll td small{display:block}.a4-articles__table small,.a4-articles__list .ac-list__scroll td small{margin-top:3px}.a4-articles__badge{display:inline-flex;align-items:center;padding:4px 9px;border-radius:6px;font-size:12px;font-weight:600;white-space:nowrap}.a4-articles__mobile-meta{display:none;align-items:center;gap:6px;flex-wrap:wrap;margin-top:4px;font-size:11px;line-height:1.35;color:var(--theme--foreground-subdued,#75859a)}.a4-articles__mobile-meta .a4-articles__badge{padding:2px 6px;font-size:10px}.a4-articles__editor .ac-tabs{margin-top:20px;border:1px solid var(--theme--border-color,#d9e1e8);border-radius:10px;overflow:hidden;background:var(--theme--background,#fff)}.a4-articles__editor .a4-articles__muted,.a4-articles__editor .a4-articles__save-status,.a4-articles__toolbar .a4-articles__save-status,.a4-articles__toolbar .a4-articles__button:disabled,.a4-articles__toolbar .a4-articles__primary:disabled,.a4-articles__editor .a4-articles__warning{color:#55697b;color:color-mix(in srgb,var(--theme--foreground,#17212b) 90%,var(--theme--background,#fff) 10%)}.a4-articles__editor .a4-articles__relation-chip>span{min-width:0;overflow-wrap:anywhere}.a4-articles__editor .a4-articles__relation-chip>button{flex:0 0 auto;white-space:nowrap}.a4-articles__editor .ac-tabs__list>button{color:#55697b;color:color-mix(in srgb,var(--theme--foreground,#17212b) 90%,var(--theme--background,#fff) 10%)}.a4-articles__editor .ac-tabs__list>button[aria-selected=true]{color:var(--theme--primary,#6644ff)}.a4-articles__editor .ac-tabs__list>button:disabled{opacity:1}.a4-articles__editor .a4-articles__button:disabled,.a4-articles__editor .a4-articles__primary:disabled{color:#55697b;color:color-mix(in srgb,var(--theme--foreground,#17212b) 90%,var(--theme--background,#fff) 10%);opacity:1}.a4-articles__editor-heading{display:flex;align-items:center;gap:12px;min-width:0}.a4-articles__editor-heading h1{font-size:24px;line-height:1.2;margin:0;overflow-wrap:anywhere}.a4-articles__toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.a4-articles__toolbar .a4-articles__button{min-height:40px}.a4-articles__button:disabled,.a4-articles__primary:disabled{color:var(--theme--foreground-subdued,#75859a);background:var(--theme--background-subdued,#f4f7fa);border-color:var(--theme--border-color,#d9e1e8);opacity:.68;cursor:not-allowed}.a4-articles__main-layout{grid-template-columns:minmax(0,1fr) minmax(250px,310px)}.a4-articles__editor .a4-articles__context dl div,.a4-articles__editor .a4-articles__other-dates div{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);align-items:start;gap:4px 8px}.a4-articles__editor .a4-articles__context dl dt,.a4-articles__editor .a4-articles__context dl dd,.a4-articles__editor .a4-articles__other-dates dt,.a4-articles__editor .a4-articles__other-dates dd{color:#55697b;color:color-mix(in srgb,var(--theme--foreground,#17212b) 90%,var(--theme--background,#fff) 10%);min-width:0;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere}.a4-articles__editor .a4-articles__context dl dd,.a4-articles__editor .a4-articles__other-dates dd{text-align:left}.a4-articles__editor [data-field] input:not([type=checkbox]),.a4-articles__editor [data-field] select,.a4-articles__editor [data-field] textarea,.a4-articles__editor [data-field] .v-input,.a4-articles__editor [data-field] .input,.a4-articles__editor [data-field] .v-input__control,.a4-articles__editor [data-field] .v-input__input{min-height:40px;height:40px!important}.a4-articles__editor [data-field=excerpt] textarea,.a4-articles__editor [data-field=excerpt] .v-input,.a4-articles__editor [data-field=excerpt] .v-textarea,.a4-articles__editor [data-field=excerpt] .v-input__control,.a4-articles__editor [data-field=excerpt] .v-input__input{height:84px!important;min-height:84px!important}.a4-articles__editor .a4-articles__context .a4-articles__badge{padding:4px 9px}.a4-articles .a4-articles__status-draft{color:#785510;background:#f5f0e2}.a4-articles .a4-articles__status-published{color:#116f4d;background:#e9f6f0}.a4-articles .a4-articles__status-archived{color:#526678;background:#eef1f4}.a4-articles__tab-layout,.a4-articles__material-layout{padding:22px 28px}.a4-articles__material-layout{grid-template-columns:minmax(0,1fr) minmax(250px,310px)}.a4-articles__material-main,.a4-articles__material-context,.a4-articles__relations-context,.a4-articles__seo-fields,.a4-articles__seo-context{min-width:0}.a4-articles__material-context,.a4-articles__relations-context,.a4-articles__seo-context{border-left:1px solid var(--theme--border-color,#e5eaf0);padding-left:22px}.a4-articles__content-field .tox-tinymce{width:100%;min-height:58vh}.a4-articles__content-field .tox-edit-area__iframe{min-height:48vh}.a4-articles__relation-grid{display:grid;gap:18px;min-width:0}.a4-articles__relations-layout{grid-template-columns:minmax(0,1fr)}.a4-articles__relations-layout .a4-articles__relation-grid{grid-template-columns:minmax(0,1fr)}.a4-articles__relation-field,.a4-articles__snippet{min-width:0;padding:16px;border:1px solid var(--theme--border-color,#d9e1e8);border-radius:8px;background:var(--theme--background,#fff)}.a4-articles__relation-values,.a4-articles__relation-options,.a4-articles__status-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.a4-articles__relation-chip{display:flex;align-items:center;gap:6px;max-width:100%;padding:5px 8px;border-radius:6px;background:var(--theme--background-subdued,#f4f7fa);overflow-wrap:anywhere}.a4-articles__relation-options{display:grid;list-style:none;padding:0;margin:10px 0 0;max-height:240px;overflow:auto}.a4-articles__relation-field label{display:grid;gap:6px;margin-top:12px}.a4-articles__seo{display:grid;gap:18px;max-width:900px}.a4-articles__seo-layout{grid-template-columns:minmax(0,1fr) minmax(250px,310px)}.a4-articles__seo-context h2{margin-top:0}.a4-articles__seo-native{margin-top:18px}.a4-articles__seo-native>summary{cursor:pointer;color:var(--theme--foreground-subdued,#66788a)}.a4-articles__snippet{display:grid;gap:6px;margin-top:10px}.a4-articles__snippet strong{color:#1769aa}.a4-articles__snippet p{margin:0}.a4-articles__editor--writing .a4-articles__material-layout{grid-template-columns:minmax(0,1fr)!important}.a4-articles__editor--writing .a4-articles__material-context{display:none}.a4-articles__editor--writing .a4-articles__material-main{width:100%;max-width:1150px;margin:auto}.a4-articles__editor--writing .a4-articles__content-field .tox-tinymce{min-height:72vh;width:100%}.a4-articles__save-status{color:var(--theme--foreground-subdued,#66788a);font-size:13px}.a4-articles__comparison{display:grid;gap:10px}.a4-articles__comparison section{padding:10px;border:1px solid var(--theme--border-color,#d9e1e8);border-radius:6px;overflow-wrap:anywhere}.a4-articles__comparison p{margin:6px 0}.a4-articles__readonly-structure{margin-top:16px}.a4-articles__content-field .tox-edit-area__iframe{line-height:1.6}@media(max-width:1100px){.a4-articles__material-layout,.a4-articles__seo-layout{grid-template-columns:minmax(0,1fr)}.a4-articles__material-context,.a4-articles__relations-context,.a4-articles__seo-context{border-left:0;border-top:1px solid var(--theme--border-color,#e5eaf0);padding:16px 0 0}.a4-articles__main-layout{grid-template-columns:minmax(0,1fr);padding:22px 24px}.a4-articles__context{border:0;border-top:1px solid var(--theme--border-color,#e5eaf0);padding:16px 0 0}}@media(max-width:720px){.a4-articles__tab-layout,.a4-articles__material-layout{padding:16px 12px}.a4-articles__button{min-height:44px}.a4-articles__main-layout{padding:16px 12px}.a4-articles__editor-heading h1{font-size:20px}.a4-articles__toolbar{width:100%}.a4-articles__toolbar .a4-articles__button{flex:1 1 120px}.a4-articles__editor .ac-tabs__list{flex-wrap:wrap;overflow:visible}.a4-articles__mobile-meta{display:flex}}`;
const ARTICLE_CONTENT_STYLE=`.a4-articles__content-field [data-field=content]{grid-column:1/-1!important;min-width:0;width:100%}@media(max-width:720px){.a4-articles__toolbar .a4-articles__save-status{flex:0 0 100%}.a4-articles__toolbar .a4-articles__button{flex:1 1 120px}}`;
const button=(label,onClick,props={})=>h("button",{type:"button",onClick,...props},label);
const dateText=value=>{const date=value?new Date(value):null;return date&&Number.isFinite(date.getTime())?date.toLocaleString("ru-RU",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):"—";};
const dateZoneText=value=>{const date=value?new Date(value):new Date(),offset=-date.getTimezoneOffset(),sign=offset>=0?"+":"-",abs=Math.abs(offset);return`UTC${sign}${String(Math.floor(abs/60)).padStart(2,"0")}:${String(abs%60).padStart(2,"0")}`;};
const badge=row=>{const publication=articlePublicationState(row.status,row.published_at,Date.now());return h("span",{class:`a4-articles__badge a4-articles__status-${publication.kind}`},publication.label);};

export const ArticlesList=defineComponent({name:"ArticlesList",setup(){
  const api=useApi(),router=useRouter(),revision=ref(0),dialog=ref(null),opener=ref(null),pending=ref({}),searchInput=ref(null),controller=createArticlesController(api,{onChange:()=>revision.value++});
  const s=computed(()=>{revision.value;return controller.listSnapshot();});controller.openList();onUnmounted(()=>{controller.dispose();dialog.value?.close();});
  const runQuery=change=>controller.query(change),reset=()=>runQuery({search:"",filters:{},page:1});
  const openFilters=()=>{pending.value={...s.value.filters};dialog.value?.showModal();};const closeFilters=()=>dialog.value?.close();
  const keydown=event=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();closeFilters();return;}if(event.key!=="Tab")return;event.stopPropagation();const items=[...event.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(item=>item.getClientRects().length),active=event.currentTarget.ownerDocument.activeElement,target=event.shiftKey&&active===items[0]?items.at(-1):!event.shiftKey&&active===items.at(-1)?items[0]:null;if(target){event.preventDefault();target.focus();}};
  const select=(label,value,options,onChange)=>h("select",{class:"a4-articles__control","aria-label":label,value,onChange:event=>onChange(event.target.value)},options.map(([key,text])=>h("option",{value:key},text)));
  const sorts=[["-published_at","Дата публикации: новые"],["published_at","Дата публикации: старые"],...["title","slug","status","category_label","is_featured","updated_at"].flatMap(field=>[[field,`${({title:"Название",slug:"Адрес",status:"Статус",category_label:"Рубрика",is_featured:"Отметка",updated_at:"Изменено"})[field]}: по возрастанию`],[`-${field}`,`${({title:"Название",slug:"Адрес",status:"Статус",category_label:"Рубрика",is_featured:"Отметка",updated_at:"Изменено"})[field]}: по убыванию`]])];
  const controls=()=>h("form",{class:"a4-articles__controls",onSubmit:event=>{event.preventDefault();runQuery({search:searchInput.value??s.value.search,page:1});searchInput.value=null;}},[
    h("input",{class:"a4-articles__control",type:"search",value:searchInput.value??s.value.search,placeholder:"Найти по названию, адресу или описанию","aria-label":"Поиск статей",onInput:event=>{searchInput.value=event.target.value;}}),
    select("Статус",s.value.filters.status??"",[["","Все статусы"],["published","Опубликованные"],["draft","Черновики"],["archived","Архив"]],value=>runQuery({filters:{...s.value.filters,status:value||null},page:1})),
    button("☷ Фильтры",openFilters,{ref:opener,class:"a4-articles__button","aria-haspopup":"dialog"}),select("Сортировка",s.value.sort,sorts,value=>runQuery({sort:value,page:1})),
  ]);
  const filterDialog=()=>h("dialog",{ref:dialog,class:"a4-articles__dialog","aria-labelledby":"a4-articles-filter-title",onKeydown:keydown,onCancel:event=>{event.preventDefault();closeFilters();},onClose:()=>opener.value?.focus()},[
    h("h2",{id:"a4-articles-filter-title"},"Фильтры статей"),h("p",{class:"a4-articles__muted"},"Дополнительные условия применяются кнопкой «Применить»."),
    h("label",{class:"a4-articles__dialog-field"},[h("span","Рубрика"),h("input",{class:"a4-articles__control",value:pending.value.category_label??"","aria-label":"Рубрика",onInput:event=>pending.value={...pending.value,category_label:event.target.value||null}})]),
    h("label",{class:"a4-articles__dialog-field"},[h("span","Редакционная отметка"),h("select",{class:"a4-articles__control",value:pending.value.is_featured??"","aria-label":"Редакционная отметка",onChange:event=>pending.value={...pending.value,is_featured:event.target.value||null}},[h("option",{value:""},"Любая"),h("option",{value:"true"},"Отмечена"),h("option",{value:"false"},"Не отмечена")])]),
    h("div",{class:"a4-articles__dialog-actions"},[button("Сбросить",()=>pending.value={}),button("Отмена",closeFilters,{class:"a4-articles__button"}),button("Применить",()=>{runQuery({filters:{...s.value.filters,category_label:pending.value.category_label??null,is_featured:pending.value.is_featured??null},page:1});closeFilters();},{class:"a4-articles__button a4-articles__primary"})]),
  ]);
  const columns=[{field:"title",label:"Название и адрес"},{field:"category_label",label:"Рубрика"},{field:"status",label:"Статус"},{field:"published_at",label:"Дата публикации"},{field:"is_featured",label:"Рекоменд."}];
  const cell=({row,column})=>{
    if(column.field==="title")return h("a",{href:`/admin/product-editor/sections/articles/${encodeURIComponent(row.id)}`,class:"a4-articles__link",onClick:event=>{event.stopPropagation();if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.defaultPrevented)return;event.preventDefault();router.push(`/product-editor/sections/articles/${encodeURIComponent(row.id)}`);}},[h("span",{class:"a4-articles__name"},row.title??"Без названия"),h("span",{class:"a4-articles__slug",title:`/articles/${row.slug??""}`},`/articles/${row.slug??"—"}`),h("span",{class:"a4-articles__mobile-meta"},[row.category_label||"Без рубрики",badge(row),dateText(row.published_at)])]);
    if(column.field==="status")return badge(row);
    if(column.field==="published_at")return h("div",[h("time",{datetime:row.published_at??undefined},dateText(row.published_at)),row.status==="draft"&&row.published_at?h("small",{class:"a4-articles__muted"},"Предварительная"):null]);
    if(column.field==="is_featured")return h("span",{title:"Редакционная отметка; публичное размещение не подтверждено","aria-label":row.is_featured?"Отмечена":"Не отмечена"},row.is_featured?"★":"—");
    return row.category_label||"—";
  };
  return()=>{const current=s.value,active=Object.entries(current.filters).filter(([,value])=>value!=null&&value!=="");const chips=active.length?h("div",{class:"a4-articles__chips"},[...active.map(([field,value])=>button(`${field==="status"?STATUSES[value]:field==="category_label"?`Рубрика: ${value}`:`Отметка: ${value==="true"?"есть":"нет"}`} ×`,()=>runQuery({filters:{...current.filters,[field]:null},page:1}),{class:"a4-articles__button","aria-label":`Убрать фильтр ${field}`})),button("Сбросить фильтры",reset,{class:"a4-articles__button"})]):null;
    return h(AdminShell,{title:"Статьи",mode:"list",readonly:true},{
      heading:()=>h("div",{class:"a4-articles__heading"},[h("h1","Статьи"),current.total!=null?h("span",{class:"a4-articles__muted","aria-label":"Количество найденных статей"},String(current.total)):null]),
      toolbar:()=>current.canCreate?button("＋ Создать статью",()=>router.push("/product-editor/sections/articles/+"),{class:"a4-articles__button a4-articles__primary"}):null,
      main:()=>h("div",{class:"a4-articles a4-articles__list"},[h("style",ARTICLE_STYLE),h("style",ARTICLE_LAYOUT_STYLE),h("p",{class:"a4-articles__subtitle"},"Статьи, публикации и редакционные материалы каталога."),controls(),chips,
        h(CollectionList,{rows:current.rows,columns,page:current.page,pageSize:25,total:current.total,loading:current.listLoading,error:current.listError?readableError(current.listError):false,onRetry:()=>controller.retry(),onSelect:row=>router.push(`/product-editor/sections/articles/${encodeURIComponent(row.id)}`),"onUpdate:page":page=>runQuery({page})},{controls:()=>null,cell,
          loading:()=>h("div",{class:"a4-articles__empty",role:"status"},"Загружаем статьи…"),
          empty:()=>h("div",{class:"a4-articles__empty",role:"status"},[h("h2",current.search||active.length?"Статьи не найдены":"Статей пока нет"),h("p",{class:"a4-articles__muted"},current.search||active.length?"Измените запрос или сбросьте фильтры.":"Создайте первую статью, если у вас есть такие права."),current.search||active.length?button("Сбросить фильтры",reset,{class:"a4-articles__button"}):null]),
          error:()=>h("div",{class:"a4-articles__empty",role:"alert"},[h("h2",current.denied?"Нет доступа к статьям":"Не удалось загрузить статьи"),h("p",{class:"a4-articles__muted"},current.denied?"Проверьте права чтения коллекции и полей.":readableError(current.listError)),button("Повторить",()=>controller.retry(),{class:"a4-articles__button"})]),
          pagination:({nextEnabled})=>h("div",{class:"a4-articles__footer"},[h("span",{"aria-live":"polite"},current.listLoading?"Загрузка…":current.rows.length?`${(current.page-1)*25+1}–${(current.page-1)*25+current.rows.length}${current.total==null?"":` из ${current.total}`} · по 25 на странице`:"Нет результатов"),h("nav",{class:"a4-articles__pager","aria-label":"Страницы списка"},[button("Назад",()=>runQuery({page:current.page-1}),{class:"a4-articles__button",disabled:current.listLoading||current.page===1}),h("span",current.total==null?`Страница ${current.page}`:`${current.page} / ${Math.max(1,Math.ceil(current.total/25))}`),button("Далее",()=>runQuery({page:current.page+1}),{class:"a4-articles__button",disabled:current.listLoading||Boolean(current.listError)||!nextEnabled})])]),
        }),filterDialog()]),
    });
  };
}});
const RELATION_FIELDS=Object.freeze({products:["id","title","slug","sku","brand"],categories:["id","title","slug"]});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RELATION_SLUG=/^[\p{L}\p{N}][\p{L}\p{N}_-]{0,159}$/u;
const RELATION_LABELS=Object.freeze({products:"Товар недоступен",categories:"Категория недоступна"});
const relationValues=value=>{if(Array.isArray(value))return value;if(typeof value==="string"){try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:null;}catch{return null;}}return value==null?[]:null;};
const permittedRelationFields=(permission,collection)=>{const row=permission?.read;if(!["full","partial"].includes(row?.access)||!Array.isArray(row.fields))return[];return RELATION_FIELDS[collection].filter(field=>row.fields.includes("*")||row.fields.includes(field));};
const relationFilter=(values,fields)=>{const ids=fields.includes("id")?values.filter(value=>typeof value==="string"&&UUID.test(value)):[],slugs=fields.includes("slug")?values.filter(value=>typeof value==="string"&&!UUID.test(value)&&RELATION_SLUG.test(value)):[];const terms=[];if(ids.length)terms.push({id:{_in:ids}});if(slugs.length)terms.push({slug:{_in:slugs}});return terms.length===1?terms[0]:terms.length?{_or:terms}:null;};
const relationTitle=(row,fields,collection)=>{if(!fields.includes("title")||typeof row?.title!=="string"||!row.title.trim())return null;const parts=[row.title.trim()];if(collection==="products"){for(const field of ["sku","brand"])if(fields.includes(field)&&typeof row[field]==="string"&&row[field].trim())parts.push(row[field].trim());}return parts.join(" · ");};
const matchesRelationValue=(row,value)=>typeof value==="string"&&(row?.id===value||typeof row?.slug==="string"&&row.slug===value);
export function createArticleRelationsController(api,{collection,modelValue=[],onChange}={}) {
  if(!["products","categories"].includes(collection))throw new TypeError("Unsupported article relation collection");
  let raw=modelValue,selection=relationValues(modelValue),permissions=[],selectedRows=[],candidateRows=[],loading=false,candidateLoading=false,error=null,searchError=null,query="",disposed=false,selectedGeneration=0,candidateGeneration=0,fields=[];
  const values=()=>selection===null?copy(raw):copy(selection);
  const notify=()=>{if(!disposed)onChange?.(snapshot());};
  const snapshot=()=>({values:values(),selected:selection===null?[]:selection.map(value=>{const record=selectedRows.find(row=>matchesRelationValue(row,value));const label=record&&relationTitle(record,fields,collection);return{value,label:label??RELATION_LABELS[collection],available:Boolean(label),removable:Boolean(label)};}),candidates:copy(candidateRows),loading,candidateLoading,error,searchError,query,permissions:copy(permissions),fields:copy(fields)});
  const readPermissions=async()=>{const response=data(await api.get("/permissions/me"));permissions=response?.[collection]?.read??{};fields=permittedRelationFields({read:permissions},collection);return fields;};
  const resolve=async()=>{
    const request=++selectedGeneration;loading=true;error=null;notify();
    try{const allowed=await readPermissions();if(request!==selectedGeneration||disposed)return{ok:false,stale:true};const filter=selection===null?null:relationFilter(selection,allowed);if(!filter||!allowed.includes("id")){selectedRows=[];return{ok:true};}
      const chunks=[];for(let at=0;at<selection.length;at+=25){const chunk=relationFilter(selection.slice(at,at+25),allowed);if(chunk)chunks.push(chunk);}const projection=allowed.join(","),resolved=[];
      for(const chunk of chunks){if(request!==selectedGeneration||disposed)return{ok:false,stale:true};const response=await api.get(`/items/${collection}`,{params:{fields:projection,limit:25,filter:chunk}});if(request!==selectedGeneration||disposed)return{ok:false,stale:true};const result=data(response);if(Array.isArray(result))resolved.push(...result.slice(0,25).filter(row=>typeof row?.id==="string"&&UUID.test(row.id)));}
      selectedRows=resolved;return{ok:true};
    }catch(reason){if(request===selectedGeneration&&!disposed){error=statusOf(reason)===403?"Нет прав чтения для выбранных связей.":"Не удалось проверить сохранённые связи.";selectedRows=[];}return{ok:false,error:reason};}
    finally{if(request===selectedGeneration&&!disposed){loading=false;notify();}}
  };
  const searchCandidates=async(value=query)=>{
    query=String(value??"").trim();const request=++candidateGeneration;candidateLoading=true;searchError=null;notify();
    try{const allowed=await readPermissions();if(request!==candidateGeneration||disposed)return{ok:false,stale:true};const titleField="title";if(!allowed.includes("id")||!allowed.includes(titleField)){candidateRows=[];return{ok:true,rows:[]};}
      const projection=allowed.filter(field=>field!=="sku"||collection==="products"),needle=query;const params={fields:projection.join(","),limit:25,sort:`${titleField},id`};if(needle){const terms=["title","name","slug","sku","brand"].filter(field=>allowed.includes(field)).map(field=>({[field]:{_icontains:needle}}));if(terms.length)params.filter={_or:terms};}
      const response=await api.get(`/items/${collection}`,{params});if(request!==candidateGeneration||disposed)return{ok:false,stale:true};const result=data(response);candidateRows=Array.isArray(result)?result.slice(0,25).filter(row=>typeof row?.id==="string"&&UUID.test(row.id)):[];return{ok:true,rows:copy(candidateRows)};
    }catch(reason){if(request===candidateGeneration&&!disposed){searchError=statusOf(reason)===403?"Нет прав чтения для выбора связей.":"Не удалось загрузить варианты.";candidateRows=[];}return{ok:false,error:reason};}
    finally{if(request===candidateGeneration&&!disposed){candidateLoading=false;notify();}}
  };
  const setSelection=async next=>{const parsed=relationValues(next);raw=copy(next);selection=parsed===null?null:copy(parsed);selectedRows=[];selectedGeneration++;notify();return resolve();};
  const encode=next=>typeof raw==="string"?JSON.stringify(next):copy(next);
  const remove=value=>{if(selection===null||typeof value!=="string")return false;const index=selection.findIndex(item=>typeof item==="string"&&item===value);if(index<0)return false;const record=selectedRows.find(row=>matchesRelationValue(row,value));if(!record||!relationTitle(record,fields,collection))return false;const next=selection.filter((_,at)=>at!==index),output=encode(next);raw=output;selection=next;selectedGeneration++;notify();onChange?.(copy(output));return true;};
  const add=row=>{if(selection===null||!row||!candidateRows.some(candidate=>candidate.id===row.id)||typeof row.id!=="string"||!UUID.test(row.id)||!fields.includes("id")||selection.some(value=>String(value)===row.id||fields.includes("slug")&&String(value)===String(row.slug)))return false;const next=[...selection,row.id],output=encode(next);raw=output;selection=next;onChange?.(copy(output));return true;};
  const retry=()=>resolve();
  return{snapshot,changeValue:()=>copy(raw),resolve,search:searchCandidates,setSelection,add,remove,retry,dispose:()=>{disposed=true;selectedGeneration++;candidateGeneration++;}};
}

const RelationIdsField=defineComponent({name:"ArticleRelationIdsField",props:{api:{type:Object,required:true},collection:{type:String,required:true},label:{type:String,required:true},modelValue:{type:[Array,String],default:()=>[]},readonly:{type:Boolean,default:false}},emits:["update:modelValue"],setup(props,{emit}){
  const revision=ref(0),query=ref(""),fieldRoot=ref(null),controller=createArticleRelationsController(props.api,{collection:props.collection,modelValue:props.modelValue,onChange:()=>revision.value++});let timer=null;
  const state=computed(()=>{revision.value;return controller.snapshot();});
  const search=()=>controller.search(query.value);
  watch(query,()=>{clearTimeout(timer);timer=setTimeout(search,180);});watch(()=>props.modelValue,value=>{controller.setSelection(value);});
  onMounted(()=>{controller.resolve();search();});onUnmounted(()=>{clearTimeout(timer);controller.dispose();});
  const label=row=>relationTitle(row,state.value.fields,props.collection)??"Вариант недоступен";
  const restoreFocus=selector=>setTimeout(()=>fieldRoot.value?.querySelector?.(selector)?.focus?.(),0);
  const add=row=>{if(!props.readonly&&controller.add(row)){emit("update:modelValue",controller.changeValue());restoreFocus("[data-article-relation-search]");}};
  const remove=value=>{if(!props.readonly&&controller.remove(value)){emit("update:modelValue",controller.changeValue());restoreFocus("[data-article-relation-search]");}};
  return()=>{const s=state.value,invalid=relationValues(props.modelValue)===null;return h("section",{ref:fieldRoot,class:"a4-articles__relation-field"},[h("h3",props.label),invalid?h("p",{role:"alert"},"Сохранённое значение оставлено без изменений."):null,
    h("div",{class:"a4-articles__relation-values","aria-live":"polite"},s.loading?h("p",{role:"status"},"Проверяем сохранённые связи…"):s.selected.length?s.selected.map((item,index)=>h("span",{class:"a4-articles__relation-chip",key:index},[h("span",item.label),item.removable&&!props.readonly?button("Убрать",()=>remove(item.value),{"aria-label":"Убрать связь",class:"a4-articles__button"}):h("small","сохранено")])):h("p",{class:"a4-articles__muted"},"Связей пока нет.")),
    s.error?h("p",{role:"status"},[s.error+" Связи сохранены без изменений. ",button("Повторить проверку",()=>controller.retry(),{class:"a4-articles__button"})]):null,
    !props.readonly?h("div",[h("label",[h("span","Найти в каталоге"),h("input",{class:"a4-articles__control","data-article-relation-search":"",value:query.value,placeholder:"Введите название или адрес",onInput:event=>query.value=event.target.value})]),s.searchError?h("p",{role:"status"},[s.searchError," ",button("Повторить поиск",search,{class:"a4-articles__button"})]):null,s.candidateLoading?h("p",{role:"status"},"Ищем варианты…"):s.candidates.length?h("ul",{class:"a4-articles__relation-options","aria-label":props.label},s.candidates.map(row=>h("li",{key:row.id},button(label(row)+" · добавить",()=>add(row),{class:"a4-articles__button",disabled:s.values?.some?.(item=>String(item)===String(row.id)||s.fields.includes("slug")&&String(item)===String(row.slug))})))):!s.searchError?h("p",{class:"a4-articles__muted"},query.value?"Ничего не найдено.":"Введите запрос, чтобы найти связь."):null ]):null]);};
}});
export const ArticlesEditor=defineComponent({name:"ArticlesEditor",props:{id:{type:[String,Number],required:true}},setup(props){
  const api=useApi(),router=useRouter(),revision=ref(0),active=ref("main"),root=ref(null),writing=ref(false),notice=ref(""),authorization=createNativeEditAuthorization(),controller=createArticlesController(api,{onChange:()=>revision.value++});let observer=null;
  const state=computed(()=>{revision.value;return controller.snapshot();});watch(()=>props.id,id=>{active.value="main";authorization.reset();controller.open(id);},{immediate:true});const wiredBodies=new WeakSet(),observedDocs=new Map(),frameLoads=new Map(),bodyHandlers=new Map();onUnmounted(()=>{controller.dispose();observer?.disconnect();authorization.reset();for(const [frame,handler] of frameLoads)frame.removeEventListener("load",handler);for(const [body,handler] of bodyHandlers){for(const type of ["beforeinput","input","paste","drop","keydown"])body.removeEventListener(type,handler,true);}for(const mutation of observedDocs.values())mutation.disconnect();});
  const markTrusted=name=>authorization.authorize(name);
  const wireEditor=()=>{const host=root.value;if(!host)return;for(const frame of host.querySelectorAll('iframe.tox-edit-area__iframe')){const attach=()=>{try{const doc=frame.contentDocument;if(!doc)return;const body=doc.body;if(body&&!wiredBodies.has(body)){wiredBodies.add(body);body.style.fontSize="16px";body.style.lineHeight="1.6";const authorize=event=>{if(!event.isTrusted)return;if(event.type==="keydown"&&!((event.key?.length===1&&!event.altKey&&(!event.ctrlKey&&!event.metaKey||["z","y","b","i","u","k"].includes(event.key.toLowerCase())))||["Backspace","Delete","Enter"].includes(event.key)))return;markTrusted("content");};bodyHandlers.set(body,authorize);for(const type of ["beforeinput","input","paste","drop","keydown"])body.addEventListener(type,authorize,true);}if(!observedDocs.has(doc)&&typeof MutationObserver!=="undefined"){const mutation=new MutationObserver(()=>{const current=frame.contentDocument?.body;if(current&&!wiredBodies.has(current))attach();});mutation.observe(doc,{childList:true,subtree:true});observedDocs.set(doc,mutation);}}catch{}};if(!frameLoads.has(frame)){const handler=()=>setTimeout(attach,0);frameLoads.set(frame,handler);frame.addEventListener("load",handler);}attach();}};
  const observeRoot=host=>{observer?.disconnect();observer=null;if(!host)return;wireEditor();if(typeof MutationObserver!=="undefined"){observer=new MutationObserver(wireEditor);observer.observe(host,{childList:true,subtree:true});}};watch(root,observeRoot,{flush:"post"});onMounted(()=>observeRoot(root.value));
  const run=async callback=>{const pending=callback();revision.value++;try{return await pending;}finally{revision.value++;}};
  const back=()=>router.push("/product-editor/sections/articles");
  const focusValidation=validation=>{const raw=validation?.[0]?.field,field=raw==="seo"?"seo_title":raw;if(typeof field!=="string"||!EDITABLE.includes(field))return;const tab=TABS.find(item=>item.fields.includes(raw)||item.fields.includes(field));if(tab)active.value=tab.id;setTimeout(()=>{if(["category_label","reading_time_minutes"].includes(field)){const details=root.value?.querySelector?.(".a4-articles__editorial");if(details)details.open=true;}const target=root.value?.querySelector?.(`[data-field="${field}"] input,[data-field="${field}"] textarea,[data-field="${field}"] button,.tox-edit-area__iframe`);target?.focus?.();},0);};
  const save=async()=>{const s=controller.snapshot();if(s.baseline.status==="published"&&typeof window!=="undefined"&&!window.confirm("Сохранить опубликованную статью? Изменения могут сразу повлиять на сайт."))return;const result=await run(()=>controller.save({confirmPublished:true}));if(result?.createdId)router.replace("/product-editor/sections/articles/"+encodeURIComponent(result.createdId));else if(result?.ok)notice.value="Изменения сохранены.";else if(result?.reason==="validation"||controller.snapshot().validation.length)focusValidation(controller.snapshot().validation);};
  const titleFor=field=>({seo_title:"Заголовок для поисковых ссылок",seo_description:"Описание для поисковых ссылок",image_alt:"Описание изображения",published_at:"Дата и время публикации",cover_image:"Обложка",og_image:"Изображение для ссылки"})[field?.field]??field?.meta?.translations?.find(item=>item.language==="ru-RU")?.translation??field?.name??field?.field;
  const form=(subset,s)=>{const delta=Object.fromEntries(subset.filter(name=>Object.hasOwn(s.values,name)&&(!same(s.values[name],s.baseline[name])||Object.hasOwn(s.seoProjectionIntents??{},name))).map(name=>[name,s.values[name]]));const routeId=String(props.id),tab=active.value,initial=subset.some(name=>Object.hasOwn(SEO_PROJECTIONS,name))?{...s.baseline,...articleSeoDisplayValues(s.baseline,s.values,s.seoProjectionIntents)}:s.baseline;return h(NativeFieldGroup,{metadata:s.metadata.map(field=>({...field,name:titleFor(field),meta:{...field.meta,...(subset.includes("published_at")&&field.field==="published_at"?{width:"full"}:{}),...(!controller.canChange(field.field)?{readonly:true}:{})}})),fieldSubset:subset,primaryKey:props.id,initialValues:initial,modelValue:delta,permissions:{read:s.permissions.read,update:s.creating?s.permissions.create:s.permissions.update},readonly:s.readonly,disabled:s.loading||s.saving||s.writeUncertain||s.conflict||s.statusUncertain,validationErrors:s.validation,"onUpdate:modelValue":next=>{if(String(props.id)!==routeId||active.value!==tab)return;const trusted=[];const accepted=subset.filter(name=>{if(!ORIGIN_GUARDED.has(name))return true;const candidate=Object.hasOwn(next??{},name)?next[name]:s.baseline[name];const current=Object.hasOwn(s.seoProjectionIntents??{},name)||!same(s.values[name],s.baseline[name])?s.values[name]:Object.hasOwn(SEO_PROJECTIONS,name)?articleSeoScalarValues(s.baseline)[name]:s.values[name];if(same(candidate,current))return false;if(!authorization.has(name))return false;trusted.push(name);return true;});if(controller.changeTab(accepted,next,{trustedFields:trusted})){trusted.forEach(name=>authorization.consume(name));notice.value="";revision.value++;}}});};
  const media=(name,label,s)=>{const field=s.metadata.find(item=>item.field===name);if(!field||!has(s.permissions.read,name))return h("p",{role:"status"},label+" недоступно.");const display=articleSeoDisplayValues(s.baseline,s.values,s.seoProjectionIntents),initial=name==="og_image"?articleSeoScalarValues(s.baseline).og_image:s.baseline[name]??null;return h("div",{class:"a4-articles__media","data-field":name,"aria-label":label},[h(MediaPicker,{field:{...field,name:titleFor(field)},primaryKey:props.id,initialValue:{[name]:initial},modelValue:name==="og_image"?display.og_image:s.values[name]??null,permissions:{read:s.permissions.read,update:s.creating?s.permissions.create:s.permissions.update},readonly:!controller.canChange(name),disabled:s.loading||s.saving||s.conflict||s.writeUncertain,allowSelect:true,allowUpload:s.filePermissions?.create?.access==="full","onUpdate:modelValue":value=>{if(controller.change(name,value)){notice.value="";revision.value++;}}})]);};
  const transition=async value=>{if(typeof window!=="undefined"&&!window.confirm(value==="published"?"Опубликовать статью? Это действие изменит доступность материала на сайте.":value==="draft"?"Снять статью с публикации? Это изменит её доступность на сайте.":"Переместить статью в архив? Это изменит её доступность на сайте."))return;const result=await run(()=>controller.transitionStatus(value));if(result.ok)notice.value="Состояние статьи изменено.";else if(result.reason==="validation")focusValidation(controller.snapshot().validation);};
  const reconcile=async choice=>{if(!state.value.comparison){await run(()=>controller.compare());return;}if(choice?.keepEdits!==undefined)await run(()=>controller.reconcile(choice.keepEdits));};
  let confirmDiscard=()=>Promise.resolve(false);
  const readOnlyDetails=(s,fields)=>h(ReadonlyDetails,{values:s.values,fields:fields.filter(item=>has(s.permissions.read,item.field))});
  return()=>{const s=state.value,recordTitle=s.creating?"Новая статья":s.values.title||"Статья";
    const statusChoices=s.metadata.find(field=>field.field==="status")?.meta?.options?.choices??[];
    const canTransition=!s.creating&&!s.dirty&&!s.loading&&!s.saving&&!s.conflict&&!s.writeUncertain&&!s.statusUncertain&&has(s.permissions.update,"status");
    const main=h("div",{class:"a4-articles__main-layout"},[
      h("div",{class:"a4-articles__fields"},[
        h("section",{class:"a4-articles__group"},[h("h2","Название и описание"),h("p",{class:"a4-articles__muted"},"То, что читатель увидит в списке и начале статьи."),form(["title","slug","excerpt"],s)]),
        h("section",{class:"a4-articles__group"},[h("h2","Дата и авторство"),h("p",{class:"a4-articles__muted"},"Дата обязательна даже для черновика. Публикация — отдельное действие; если дата ещё не наступила, статья дождётся её. Часовой пояс: "+(Intl.DateTimeFormat().resolvedOptions().timeZone||"не определён")+" ("+dateZoneText(s.values.published_at)+")."),form(["published_at","author","reviewer"],s)]),
        h("details",{class:"a4-articles__editorial"},[h("summary","Редакционные настройки"),h("p",{class:"a4-articles__muted"},"Рубрика и время чтения хранятся для редакции; их публичное использование не подтверждено."),form(["category_label","reading_time_minutes"],s)]),
      ]),
      h("aside",{class:"a4-articles__context"},[
          h("section",[h("h2","Публикация"),h("p",{class:"a4-articles__path"},s.values.slug?"/articles/"+s.values.slug:"Адрес появится после заполнения slug"),h("dl",[h("div",[h("dt","Состояние"),h("dd",articlePublicationState(s.values.status,s.values.published_at,Date.now()).label)]),h("div",[h("dt",s.values.status==="draft"?"Предварительная дата":"Дата и время"),h("dd",dateText(s.values.published_at))]),h("div",[h("dt","Часовой пояс"),h("dd",(Intl.DateTimeFormat().resolvedOptions().timeZone||"не определён")+" · "+dateZoneText(s.values.published_at))])]),s.values.status==="draft"?h("p",{class:"a4-articles__muted"},"Черновик не виден на сайте независимо от даты."):articlePublicationState(s.values.status,s.values.published_at,Date.now()).kind==="scheduled"?h("p",{class:"a4-articles__muted"},"Публикация запланирована на указанную дату."):articlePublicationState(s.values.status,s.values.published_at,Date.now()).kind==="invalid-date"?h("p",{class:"a4-articles__warning"},"Дата публикации некорректна; статья не должна считаться доступной."):null,h("p",{class:"a4-articles__warning"},"Сохранение опубликованной статьи может сразу повлиять на сайт."),s.creating?h("p",{class:"a4-articles__muted"},"Новая статья будет создана только как черновик."):null,
          canTransition?h("div",{class:"a4-articles__status-actions","aria-label":"Изменить состояние"},statusChoices.map(choice=>{const value=typeof choice==="object"?choice.value:choice;return value!==s.values.status&&Object.hasOwn(STATUSES,value)?button(value==="published"?"Опубликовать":value==="draft"?"Снять с публикации":"Переместить в архив",()=>transition(value),{class:"a4-articles__button"}):null;})):!s.creating&&s.dirty?h("p",{class:"a4-articles__muted"},"Сначала сохраните или отмените изменения, чтобы сменить состояние."):null,s.statusError?h("p",{role:"alert"},readableError(s.statusError)):null]),
        h("section",[h("h2","Порядок материала"),h("p",{class:"a4-articles__muted"},"Название → краткое описание → обложка → полный текст."),h("p",{class:"a4-articles__warning"},"Полный текст редактируется во вкладке «Материал»." )]),
      ]),
    ]);
    let panel;
    if(active.value==="main")panel=main;
    else if(active.value==="material")panel=h("div",{class:"a4-articles__main-layout a4-articles__material-layout",style:writing.value?{gridTemplateColumns:"minmax(0,1fr)"}:undefined},[
      h("div",{class:"a4-articles__material-main"},[
        h("div",{class:"a4-articles__material-toolbar"},[h("p",{class:"a4-articles__muted"},"Основной материал, который читает витрина."),button(writing.value?"Закрыть режим письма":"Режим письма",()=>writing.value=!writing.value,{class:"a4-articles__button","aria-pressed":String(writing.value)})]),
        h("section",{class:"a4-articles__group a4-articles__content-field","aria-label":"Материал статьи"},[form(["content"],s)]),
        h("details",{class:"a4-articles__readonly-structure"},[h("summary","О редактировании и сохранении"),h("p",{class:"a4-articles__muted"},"Используется штатный HTML-редактор Directus. Текст сохраняется только после явного действия пользователя; автоматическая нормализация редактора сама по себе не меняет запись."),h("p",{class:"a4-articles__muted"},"Сохранённые структурированные данные не заменяют обязательное поле текста статьи и остаются отдельными данными без автоматического преобразования."),h("p",{class:"a4-articles__muted"},"Безопасный режим чтения не подключён: содержимое не выводится как preview.")]),
        h("p",{class:"a4-articles__warning"},"Витрина использует поле «Текст статьи». Внешние изображения и неподтверждённые форматы могут не отображаться на сайте."),
      ]),
      h("aside",{class:"a4-articles__material-context"},[media("cover_image","Обложка",s),form(["image_alt"],s),h("p",{class:"a4-articles__muted"},"При отвязке обложки файл останется в библиотеке Directus.")]),
    ]);
    else if(active.value==="relations")panel=h("div",{class:"a4-articles__main-layout a4-articles__tab-layout a4-articles__relations-layout"},[
      h("div",{class:"a4-articles__relation-grid"},[
        h(RelationIdsField,{api,collection:"products",label:"Связанные товары",modelValue:s.values.related_products,readonly:!controller.canChange("related_products"),"data-field":"related_products","onUpdate:modelValue":value=>{if(controller.change("related_products",value))revision.value++;}}),
        h(RelationIdsField,{api,collection:"categories",label:"Связанные категории",modelValue:s.values.related_categories,readonly:!controller.canChange("related_categories"),"data-field":"related_categories","onUpdate:modelValue":value=>{if(controller.change("related_categories",value))revision.value++;}}),
        h("details",{class:"a4-articles__editorial"},[h("summary","Редакционные настройки"),h("p",{class:"a4-articles__muted"},"Отметка и порядок хранятся в статье; их публичное использование не подтверждено."),form(["is_featured","sort_order"],s)]),
      ]),
    ]);
    else if(active.value==="seo")panel=h("div",{class:"a4-articles__main-layout a4-articles__tab-layout a4-articles__seo-layout"},[
      h("div",{class:"a4-articles__seo-fields"},[
        media("og_image","Изображение для ссылки",s),h("p",{class:"a4-articles__muted"},"Если отдельное изображение не выбрано, витрина использует обложку статьи."),
        h("section",{class:"a4-articles__group"},[h("h2","Представление в поиске"),h("p",{class:"a4-articles__muted"},"Заголовок и описание для поисковых ссылок. Если поле пусто, используются сохранённые настройки SEO или основное описание."),form(["seo_title","seo_description"],s)]),
        h("p",{class:"a4-articles__muted"},"Сохранённые дополнительные настройки SEO остаются без изменений."),
      ]),
      h("aside",{class:"a4-articles__seo-context"},[
        h("h2","Пример сниппета"),h("p",{class:"a4-articles__muted"},"Визуальная подсказка, не фактический результат индексации."),h("div",{class:"a4-articles__snippet","aria-label":"Пример поискового сниппета"},[h("span","/articles/"+(s.values.slug||"адрес-статьи")),h("strong",articleSeoDisplayValues(s.baseline,s.values,s.seoProjectionIntents).seo_title||s.values.title||"Название статьи"),h("p",articleSeoDisplayValues(s.baseline,s.values,s.seoProjectionIntents).seo_description||s.values.excerpt||"Краткое описание статьи")])
      ]),
    ]);
    else panel=h("section",{class:"a4-articles__other"},[h("h2","Дополнительные сведения"),s.creating?h("p",{class:"a4-articles__muted"},"Даты создания и изменения появятся после сохранения."):h("dl",{class:"a4-articles__other-dates"},s.metadata.filter(field=>["created_at","updated_at"].includes(field.field)&&has(s.permissions.read,field.field)).map(field=>h("div",{key:field.field},[h("dt",field.field==="created_at"?"Создано":"Изменено"),h("dd",dateText(s.values[field.field]))]))) ]);
    const differences=s.comparison?articleComparisonRows({...s.values,...articleSeoDisplayValues(s.baseline,s.values,s.seoProjectionIntents)},{...s.comparison,...articleSeoScalarValues(s.comparison)}):[];
    const conflict=s.conflict||s.writeUncertain||s.statusUncertain?h("section",{class:"a4-articles__warning",role:"alert"},[
      h("h2",s.creating?"Создание не подтверждено":s.statusUncertain?"Результат смены состояния не подтверждён":s.conflict?"Статья изменена в другом окне":"Результат сохранения не подтверждён"),
      h("p",s.creating?"Повторное создание заблокировано. Найдите запись по точному адресу и откройте её вручную для проверки.":"Локальный ввод сохранён. Сверка ничего не записывает."),
      s.creating?button("Найти статью по адресу",()=>run(()=>controller.lookupCreatedBySlug()),{class:"a4-articles__button",disabled:s.saving}):button("Сравнить изменения",()=>run(()=>controller.compare()),{class:"a4-articles__button",disabled:s.saving}),
      s.createMatchError?h("p",{role:"alert"},"Не удалось проверить статью по адресу. Откройте список статей и найдите запись вручную."):null,
      s.createMatches?.length?h("div",{class:"a4-articles__comparison"},[h("h3","Найдены записи с таким адресом; проверьте нужную вручную."),...s.createMatches.map(record=>h("section",{key:record.id},[h("strong",record.title||record.slug),h("p",`Адрес: ${record.slug}; состояние: ${STATUSES[record.status]??"неизвестно"}.`),button("Открыть запись для проверки",()=>router.push("/product-editor/sections/articles/"+encodeURIComponent(record.id)),{class:"a4-articles__button"})]))]):s.createMatches?h("p",{class:"a4-articles__muted"},"Запись с таким адресом не найдена. Повторное создание остаётся заблокировано."):null,
      s.comparison?h("div",{class:"a4-articles__comparison"},[h("h3","Сравнение изменений"),...differences.map(item=>h("section",{key:item.field},[h("strong",item.label),h("p",[h("b","Ваш вариант: "),item.own]),h("p",[h("b","Сохранённый вариант: "),item.remote])])),button("Оставить мои правки",()=>run(()=>controller.reconcile(true)),{class:"a4-articles__button"}),button("Загрузить сохранённые значения",async()=>await confirmDiscard()&&run(()=>controller.reconcile(false)),{class:"a4-articles__button"})]):null
    ]):null;
    const selected=TABS.find(tab=>tab.id===active.value)??TABS[0],statusMessage=s.saving?"Сохраняем изменения…":s.loading?"Загрузка…":s.readError?"Не удалось загрузить данные.":s.statusUncertain?"Не удалось подтвердить изменение состояния.":s.conflict?"Эта запись изменилась, пока вы её редактировали. Ваши правки остались в форме. Сравните изменения перед сохранением.":s.writeUncertain?"Не удалось проверить, сохранились ли изменения. Введённые данные остались в открытой форме.":s.saveError?"Не удалось сохранить изменения. Проверьте данные и повторите попытку.":s.dirty?"Есть несохранённые изменения.":s.saved?"Изменения сохранены.":s.readonly?"Режим просмотра.":"Нет несохранённых изменений";
    return h(AdminShell,{title:recordTitle,state:{...s,readError:s.readError?true:null,saveError:s.saveError?true:null},dirty:s.dirty,saving:s.saving,readonly:s.readonly,cancelTitle:"Отменить изменения статьи?",onCancel:()=>run(()=>controller.discardChanges()),onSave:save,onBack:back,onRetry:()=>run(()=>controller.open(props.id)),onReconcile:reconcile},{
      heading:()=>h("div",{class:"a4-articles__editor-heading"},[h("h1",recordTitle),s.values.status?h("span",{class:"a4-articles__badge a4-articles__status-"+articlePublicationState(s.values.status,s.values.published_at).kind},articlePublicationState(s.values.status,s.values.published_at).label):null]),toolbar:({requestCancel=()=>{},requestDiscard=()=>Promise.resolve(false)}={})=>{confirmDiscard=requestDiscard;return h("div",{class:"a4-articles__toolbar"},[h("span",{class:"a4-articles__save-status",role:"status","aria-live":"polite"},statusMessage),button(s.saving?"Сохранение…":s.creating?"Создать черновик":"Сохранить",save,{class:"a4-articles__button a4-articles__primary",disabled:!s.canSave||s.saving||s.loading}),s.dirty&&!s.conflict&&!s.writeUncertain?button("Отменить изменения",requestCancel,{class:"a4-articles__button",disabled:s.saving}):null,button("К списку статей",back,{class:"a4-articles__button"})]);},
      main:()=>h("div",{ref:root,class:"a4-articles a4-articles__editor"+(writing.value?" a4-articles__editor--writing":""),onClickCapture:event=>{if(!event.isTrusted)return;const field=event.target?.closest?.("[data-field]")?.getAttribute("data-field");if(["seo","translations"].includes(field))markTrusted(field);if(event.target?.closest?.(".tox-toolbar-overlord button,.tox-toolbar__primary button,.tox-toolbar__group button,[data-alloy-tabstop=true][role=toolbar] button"))markTrusted("content");},onInputCapture:event=>{if(!event.isTrusted)return;const field=event.target?.closest?.("[data-field]")?.getAttribute("data-field");if(["seo","translations"].includes(field))markTrusted(field);},onChangeCapture:event=>{if(!event.isTrusted)return;const field=event.target?.closest?.("[data-field]")?.getAttribute("data-field");if(["seo","translations"].includes(field))markTrusted(field);}},[h("style",ARTICLE_STYLE),h("style",ARTICLE_LAYOUT_STYLE),h("style",ARTICLE_CONTENT_STYLE),conflict,s.validation.length?h("section",{class:"a4-articles__warning a4-articles__validation-summary",role:"alert"},[h("h2","Проверьте данные"),h("ul",s.validation.map((error,index)=>h("li",{key:index},`${COMPARISON_LABELS[error?.field]??"Данные статьи"}: ${articleValidationDetail(error)}`)))]):null,h(SectionTabs,{tabs:TABS,modelValue:active.value,"onUpdate:modelValue":value=>{if(active.value!==value)authorization.reset();active.value=value;writing.value=false;}},{default:()=>panel})]),
    });
  };
}});

export const ArticlesSection=defineComponent({name:"ArticlesSection",props:{id:{type:[String,Number],default:null}},setup(props){return()=>props.id==null||String(props.id)===""?h(ArticlesList):h(ArticlesEditor,{id:props.id});}});
