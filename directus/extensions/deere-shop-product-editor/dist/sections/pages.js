import { useApi } from "@directus/extensions-sdk";
import { computed, defineComponent, h, nextTick, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { createEditorState } from "../admin-state.mjs";
import { AdminShell, SectionTabs, EditorToolbar, NativeFieldGroup, CollectionList, MediaPicker, ReadonlyDetails, buildCollectionQuery } from "../admin-shell.js";
import { PageSectionEditor } from "../page-sections.js";

export const PAGE_FIELDS = Object.freeze(["id","status","title","slug","page_type","h1","eyebrow","intro","seo_title","seo_description","seo_text","og_image","canonical_url","is_indexable","seo","translations","created_at","updated_at"]);
const LIST_FIELDS = ["id","title","slug","page_type","status","updated_at"];
const EDITABLE = PAGE_FIELDS.filter(f => !["id","created_at","updated_at"].includes(f));
const MEDIA_FIELDS = new Set(["og_image"]);
const CORE = ["title","slug","status","page_type","h1"];
const SORT_FIELDS = ["title","slug","page_type","status","updated_at"];
const SYSTEM_TYPES = ["home","catalog","articles"];
const RESERVED = new Set(["home","catalog","articles","brands","brand","category","product","request","api","admin","assets","sitemap","sitemaps","sitemap.xml","robots.txt","favicon.ico","_next"]);
const FALLBACKS = new Set(["about","delivery","contacts","payment"]);
const STATUS = {draft:"Черновик",published:"Опубликована",archived:"В архиве"};
const TYPES = {standard:"Обычная страница",about:"О компании",delivery:"Доставка",contacts:"Контакты",privacy_policy:"Политика",thank_you:"Благодарность",home:"Главная",catalog:"Каталог",articles:"Статьи"};
const FIELD_LABELS = {title:"Название для списка",slug:"Адрес страницы",page_type:"Тип страницы",h1:"Заголовок для посетителя",eyebrow:"Надзаголовок",intro:"Вводный текст",seo_title:"Заголовок в поиске",seo_description:"Описание в поиске",seo_text:"Текст внизу страницы",og_image:"Изображение для ссылки",canonical_url:"Основной адрес для поиска",is_indexable:"Показывать в поисковых системах",seo:"Поисковые настройки",translations:"Переводы"};
const TABS = [{id:"main",label:"Содержимое"},{id:"sections",label:"Блоки страницы"},{id:"seo",label:"Поиск и ссылки"},{id:"other",label:"Дополнительно"}];
const CHILD_FIELDS = ["title","is_visible","text","subtitle","image","image_alt","button_text","button_url"];
const CHILD_LABELS = {title:"Заголовок блока",section_type:"Тип блока",is_visible:"Показывать блок",text:"Текст",subtitle:"Подзаголовок",image:"Изображение",image_alt:"Описание изображения",button_text:"Подпись кнопки",button_url:"Ссылка кнопки",items:"Элементы",settings:"Настройки",translations:"Переводы"};
const SECTION_LABELS = {ariaLabel:"Блоки страницы",listTitle:"Блоки страницы",loadingList:"Загружаем блоки…",listError:"Не удалось загрузить блоки. Редактирование отключено.",emptyList:"На странице пока нет редактируемых блоков.",saveLabel:"Сохранить блок",previous:"Назад",next:"Далее",page:"Страница",currentRecord:"Сохранённые данные",yourValues:"Ваши правки",type:"Тип",typeUnknown:"Другой тип",typeValues:{text:"Текст",hero:"Первый экран",products:"Товары",categories:"Категории",features:"Преимущества",testimonials:"Отзывы",faq:"Вопросы и ответы",cta:"Призыв к действию",custom:"Произвольный блок",company_trust:"Доверие компании",featured_products:"Рекомендуемые товары",advantages:"Преимущества",steps:"Этапы",catalog_preview:"Обзор каталога",seo_text:"Дополнительный текст",lead_form:"Форма заявки",parts_request:"Запрос запчастей",recent_supplies:"Последние поступления",contacts:"Контакты",articles:"Статьи"},status:"Публикация",order:"Порядок",visible:"Включён",hidden:"Выключен",visibilityUnavailable:"Включение недоступно",unknownValue:"Недоступно",unknownSection:"Блок без названия",saved:"Блок сохранён.",retry:"Повторить загрузку",selectPrompt:"Выберите блок для просмотра доступных полей.",loadingSection:"Загружаем блок…",readError:"Не удалось загрузить блок.",reconcileNeeded:"Перед новой попыткой сверьте данные с сохранённой версией.",compare:"Сравнить сохранённые данные",keepEdits:"Обновить и оставить мои правки",useCurrent:"Загрузить сохранённые данные",supportNote:"Каждый блок сохраняется отдельно от страницы. Дополнительные параметры блока доступны только для просмотра.",blockedParent:"Страница изменилась, пока у блока оставались несохранённые правки.",discardAndContinue:"Отбросить правки блока и продолжить",editingUnavailable:"Редактирование недоступно при текущих правах на поля.",displayUnavailable:"Сведения блока недоступны",statusValues:{draft:"Черновик",published:"Опубликован",archived:"В архиве"},groups:{content:"Содержимое",main:"Настройки блока",group_content:"Содержимое",group_main:"Настройки блока",button:"Кнопка",group_button:"Кнопка",items:"Элементы",group_items:"Элементы",system:"Дополнительно",group_system:"Дополнительно",details:"Дополнительно",advanced:"Дополнительно",settings:"Дополнительно",other:"Дополнительно"},fields:CHILD_LABELS};
const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const same = (a,b) => JSON.stringify(a??null) === JSON.stringify(b??null);
const data = r => r?.data?.data;
let pageListContext=null;
const safePageQuery=value=>({page:Number.isSafeInteger(value?.page)&&value.page>0?value.page:1,search:typeof value?.search==="string"?value.search:"",sort:SORT_FIELDS.includes(value?.sort?.replace(/^-/ ,""))?value.sort:"-updated_at",filters:value?.filters&&typeof value.filters==="object"?copy(value.filters):{}});
const has = (fields,f) => Array.isArray(fields) && (fields.includes("*") || fields.includes(f));
const permissionFields = p => ["full","partial"].includes(p?.access) && Array.isArray(p.fields) && p.fields.every(f=>typeof f==="string") ? [...p.fields] : [];
const writableMeta = f => f && f.type !== "alias" && !f.readonly && !f.meta?.readonly && !f.schema?.is_generated;
const choices = f => (f?.meta?.options?.choices??[]).map(c=>typeof c==="object"?c.value:c);
const codeOf = e => e?.response?.data?.errors?.[0]?.extensions?.code ?? e?.response?.data?.errors?.[0]?.code ?? e?.code;
const statusOf = e => e?.response?.status ?? e?.status;
const deniedError = message => Object.assign(Error(message),{status:403});
const errorText = e => statusOf(e)===403 ? "У вас нет прав на это действие." : statusOf(e)===404 ? "Страница недоступна или уже удалена." : codeOf(e)==="RECORD_NOT_UNIQUE" ? "Этот адрес уже занят. Укажите другой." : "Не удалось подтвердить результат. Проверьте соединение и сравните сохранённые данные перед повтором.";
const fieldErrors = error => {
  const code=codeOf(error),field=code==="RECORD_NOT_UNIQUE"?"slug":error?.response?.data?.errors?.[0]?.extensions?.field;
  if(!["RECORD_NOT_UNIQUE","FAILED_VALIDATION","INVALID_PAYLOAD"].includes(code))return [];
  return [{field:EDITABLE.includes(field)?field:null,type:code,message:code==="RECORD_NOT_UNIQUE"?"Адрес страницы: этот адрес уже занят. Укажите другой после сверки данных.":"Проверьте обязательные поля и допустимые значения. Введённые данные сохранены на экране."}];
};
// Reject contradictory edits, rather than silently letting the JSON-first hook
// overwrite a scalar. The server remains the sole owner of SEO projections.
const seoScalarProjection=(field,value)=>field==="is_indexable"?value:field==="og_image"?((value?.id??value) ? (value?.id??value) : null):typeof value==="string"&&value.trim()?value.trim():null;
const seoJsonProjection=(record,field,key,fallback)=>{
  const owner=field==="canonical_url"?record.additional_fields??{}:record;
  if(!Object.hasOwn(owner,key))return seoScalarProjection(field,fallback);
  const value=owner[key];
  return field==="is_indexable"?typeof value==="boolean"?!value:fallback:field==="og_image"?((value?.id??value) ? (value?.id??value) : null):typeof value==="string"&&value.trim()?value.trim():null;
};
function seoProjectionErrors(values,baseline,explicitFields=new Set()) {
  const seo=values.seo&&typeof values.seo==="object"&&!Array.isArray(values.seo)?values.seo:{};
  const pairs=[["seo_title",seo,"title"],["seo_description",seo,"meta_description"],["og_image",seo,"og_image"],["canonical_url",seo.additional_fields??{},"canonical_url"],["is_indexable",seo,"no_index"]];
  const baselineSeo=baseline.seo&&typeof baseline.seo==="object"&&!Array.isArray(baseline.seo)?baseline.seo:{};
  return pairs.filter(([field,owner,key])=>Object.hasOwn(values,field)&&!same(values[field],baseline[field])&&!same(values.seo,baseline.seo)&&Object.hasOwn(owner,key)&&
    (!same(seoJsonProjection(seo,field,key,baseline[field]),seoJsonProjection(baselineSeo,field,key,baseline[field]))||explicitFields.has(field))&&
    !same(seoScalarProjection(field,values[field]),seoJsonProjection(seo,field,key,baseline[field])))
    .map(([field])=>({field,type:"FAILED_VALIDATION",message:`${FIELD_LABELS[field]} расходится со значением в SEO-панели. Согласуйте оба значения перед сохранением; ваш ввод сохранён.`}));
}
// The native Directus SEO interface can emit a normalized copy of its initial
// JSON projection while a scalar field is edited. Keep that hydration value
// from winning the server's JSON-first projection hook; explicit JSON edits
// that disagree with the scalar are rejected above.
function synchronizeHydratedSeoProjection(payload,values,baseline){
  if(!Object.hasOwn(payload.changes??{},"seo"))return payload;
  const seo=copy(payload.changes.seo&&typeof payload.changes.seo==="object"&&!Array.isArray(payload.changes.seo)?payload.changes.seo:{});
  const baselineSeo=baseline.seo&&typeof baseline.seo==="object"&&!Array.isArray(baseline.seo)?baseline.seo:{};
  const scalarPairs=[["seo_title","title"],["seo_description","meta_description"],["og_image","og_image"],["canonical_url","canonical_url"],["is_indexable","no_index"]];
  for(const [field,key] of scalarPairs){
    if(same(values[field],baseline[field]))continue;
    const currentOwner=field==="canonical_url"?seo.additional_fields??{}:seo;
    if(!Object.hasOwn(currentOwner,key)||!same(seoJsonProjection(seo,field,key,baseline[field]),seoJsonProjection(baselineSeo,field,key,baseline[field])))continue;
    const value=field==="is_indexable"?values[field]===false:seoScalarProjection(field,values[field]);
    if(field==="canonical_url")seo.additional_fields={...(seo.additional_fields??{}),[key]:value};
    else seo[key]=value;
  }
    return {...payload,changes:{...payload.changes,seo}};
}
export function pageSeoInterfaceInitialValues(values={}){
  const seo=values.seo&&typeof values.seo==="object"&&!Array.isArray(values.seo)?values.seo:{};
  const extra=seo.additional_fields&&typeof seo.additional_fields==="object"&&!Array.isArray(seo.additional_fields)?seo.additional_fields:{};
  const projection=(record,key,fallback)=>Object.hasOwn(record,key)?record[key]??"":fallback??"";
  return {...seo,title:projection(seo,"title",values.seo_title),meta_description:projection(seo,"meta_description",values.seo_description),
    og_image:Object.hasOwn(seo,"og_image")?seo.og_image??"":values.og_image?.id??values.og_image??"",
    no_index:typeof seo.no_index==="boolean"?seo.no_index:values.is_indexable===false,
    no_follow:typeof seo.no_follow==="boolean"?seo.no_follow:false,
    additional_fields:{...extra,canonical_url:projection(extra,"canonical_url",values.canonical_url)}};
}
export function pageSeoScalarValues(values={}){
  const seo=values.seo&&typeof values.seo==="object"&&!Array.isArray(values.seo)?values.seo:{};
  const extra=seo.additional_fields&&typeof seo.additional_fields==="object"&&!Array.isArray(seo.additional_fields)?seo.additional_fields:{};
  const projection=(owner,key,fallback)=>Object.hasOwn(owner,key)?owner[key]??"":fallback??"";
  return {seo_title:projection(seo,"title",values.seo_title),seo_description:projection(seo,"meta_description",values.seo_description),
    og_image:Object.hasOwn(seo,"og_image")?(seo.og_image?.id??seo.og_image??""):(values.og_image?.id??values.og_image??""),
    is_indexable:typeof seo.no_index==="boolean"?!seo.no_index:values.is_indexable,
    canonical_url:projection(extra,"canonical_url",values.canonical_url)};
}
const pageSeoValue=(snapshot,field)=>Object.hasOwn(snapshot.seoProjectionIntents??{},field)||!same(snapshot.values?.[field],snapshot.baseline?.[field])?snapshot.values?.[field]:pageSeoScalarValues(snapshot.baseline)[field];
const recordFrom = r => { const value=data(r); if(!value || typeof value!=="object" || Array.isArray(value))throw Error("Invalid page response"); return value; };

export function pagePermissions(effective, item) {
  const p=effective?.pages;
  return {read:permissionFields(p?.read), update:item?.update?.access===true?permissionFields(p?.update):[], create:p?.create?.access==="full"?permissionFields(p.create):[]};
}
function createAllowed(metadata, permissions) {
  return CORE.every(f=>has(permissions.read,f)&&has(permissions.create,f)&&writableMeta(metadata.find(m=>m.field===f))) &&
    choices(metadata.find(f=>f.field==="status")).includes("draft") && choices(metadata.find(f=>f.field==="page_type")).includes("standard");
}
export function buildPagesQuery({page=1,search="",sort="-updated_at",filters={}}={}) {
  if(!SORT_FIELDS.includes(sort.replace(/^-/,"")))throw new TypeError("Invalid pages sort");
  const and=[];
  if(search.trim())and.push({_or:["title","slug","h1"].map(f=>({[f]:{_icontains:search.trim()}}))});
  if(filters.status){if(!Object.hasOwn(STATUS,filters.status))throw TypeError("Invalid status");and.push({status:{_eq:filters.status}});}
  if(filters.page_type){if(!Object.hasOwn(TYPES,filters.page_type))throw TypeError("Invalid page type");and.push({page_type:{_eq:filters.page_type}});}
  if(filters.is_indexable!=null&&filters.is_indexable!==""){
    if(![true,false,"true","false"].includes(filters.is_indexable))throw TypeError("Invalid indexation");
    and.push({is_indexable:{_eq:filters.is_indexable===true||filters.is_indexable==="true"}});
  }
  return {...buildCollectionQuery({fields:LIST_FIELDS,page,pageSize:25,sort:`${sort},id`,filter:and.length?{_and:and}:undefined}),meta:"filter_count"};
}
export function pageRouteContext(values={}) {
  const slug=values.slug;
  const valid=typeof slug==="string"&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&!RESERVED.has(slug);
  return {path:valid?`/${slug}`:null,fallback:FALLBACKS.has(slug),system:SYSTEM_TYPES.includes(values.page_type)||RESERVED.has(slug)};
}
const CYRILLIC_SLUG={а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"i",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya"};
export function transliteratePageSlug(value="") { return [...String(value).toLowerCase()].map(char=>CYRILLIC_SLUG[char]??char).join("").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }
export function pagePublicUrl(base,savedRecord) {
  if(typeof base!=="string"||!base.trim()||base!==base.trim()||base.includes("\\")||savedRecord?.status!=="published")return null;
  let origin;try{origin=new URL(base);}catch{return null;}
  if(!["http:","https:"].includes(origin.protocol)||!origin.hostname||origin.origin==="null"||origin.username||origin.password||origin.search||origin.hash||/[\u0000-\u0020\u007f]/.test(base))return null;
  const route=pageRouteContext(savedRecord);if(!route.path)return null;
  origin.pathname=`${origin.pathname.replace(/\/+$/ ,"")}${route.path}`;return origin.toString();
}
export function validatePage(values,metadata=[]) {
  const errors=[];
  for(const field of metadata){
    const name=field.field;if(!EDITABLE.includes(name)||!Object.hasOwn(values??{},name))continue;
    const value=values[name],fail=message=>errors.push({field:name,type:"FAILED_VALIDATION",message:`${FIELD_LABELS[name]??name}: ${message}`});
    if((field.meta?.required||field.schema?.is_nullable===false)&&(value==null||typeof value==="string"&&!value.trim())){fail("обязательное поле");continue;}
    if(value==null||value==="")continue;
    if(choices(field).length&&!choices(field).some(c=>same(c,value)))fail("выберите допустимое значение");
    if(name==="slug"&&!pageRouteContext({slug:value}).path)fail("нужны латинские буквы, цифры и дефисы; системный адрес недоступен");
    if(name==="page_type"&&SYSTEM_TYPES.includes(value))fail("системная страница управляется отдельным редактором");
    if(name==="canonical_url") {let safe=false;try{safe=typeof value==="string"&&(value.startsWith("/")&&!value.startsWith("//")||["http:","https:"].includes(new URL(value).protocol));}catch{}if(!safe)fail("допустима относительная ссылка или HTTP(S)");}
    if(typeof value==="string"&&field.schema?.max_length&&value.length>field.schema.max_length)fail(`максимум ${field.schema.max_length} символов`);
    if(field.type==="boolean"&&typeof value!=="boolean")fail("нужно логическое значение");
    if(["string","text"].includes(field.type)&&typeof value!=="string")fail("нужен текст");
    if(field.type==="json"&&typeof value==="string")fail("данные имеют неподдерживаемый формат");
  }
  return errors;
}

export function createPageListController(api,{onChange}={}) {
  let generation=0,disposed=false,ready=false,loading=false,error=null,denied=false,rows=[],total=null,canCreate=false;
  let query=safePageQuery(pageListContext??{});
  const snapshot=()=>({...copy(query),rows:copy(rows),total,loading,error,denied,canCreate});
  const notify=()=>{if(!disposed)onChange?.(snapshot());};
  async function load(seq=++generation){
    loading=true;error=null;notify();
    try {
      const r=await api.get("/items/pages",{params:buildPagesQuery(query)});
      if(seq!==generation||disposed)return {ok:false,stale:true};
      if(!Array.isArray(data(r))||data(r).length>25||data(r).some(row=>row?.id==null))throw Error("Invalid pages list");
      const count=r.data.meta?.filter_count;
      if(count!=null&&(!Number.isSafeInteger(Number(count))||Number(count)<data(r).length))throw Error("Invalid filtered count");
      rows=data(r);total=count==null?null:Number(count);denied=false;return {ok:true};
    }catch(e){if(seq===generation&&!disposed){rows=[];total=null;error=e;denied=statusOf(e)===403;}return {ok:false,error:e};}
    finally{if(seq===generation&&!disposed){loading=false;notify();}}
  }
  async function open(){
    const seq=++generation;ready=false;loading=true;error=null;denied=false;canCreate=false;notify();
    try{
      const [schema,effective,collection]=await Promise.all([api.get("/fields/pages"),api.get("/permissions/me"),api.get("/collections/pages")]);
      if(seq!==generation||disposed)return {ok:false,stale:true};
      const fields=data(schema),p=pagePermissions(data(effective));
      if(data(collection)?.collection!=="pages"||data(collection)?.meta?.singleton!==false)throw Error("pages must be a collection");
      if(!Array.isArray(fields))throw Error("Missing metadata");
      if(![...LIST_FIELDS,"h1","is_indexable"].every(f=>has(p.read,f)))throw deniedError("Read permission unavailable");
      canCreate=createAllowed(fields,p);ready=true;return await load(seq);
    }catch(e){if(seq===generation&&!disposed){error=e;denied=statusOf(e)===403;loading=false;notify();}return {ok:false,error:e};}
  }
  return {open,snapshot,query:async next=>{
    const reset=Object.hasOwn(next,"search")||Object.hasOwn(next,"filters");
    query=safePageQuery({...query,...copy(next),page:reset?1:next.page??query.page});pageListContext=copy(query);
    if(!ready)return open();return load();
  },retry:()=>ready?load():open(),invalidate:()=>{generation++;loading=true;notify();},dispose:()=>{disposed=true;generation++;}};
}

/** Collection-specific orchestration around the accepted imperative A0 state. */
export function createPageController(api,{onChange}={}) {
  let generation=0,disposed=false,metadata=[],permissions={read:[],update:[],create:[]},effective={},state=null,statusState=null;
  let id=null,ready=false,opening=false,busy=false,creating=false,defaults={},draft={},manualSlug=false,createdId=null,uncertainCreate=false;
  let failure=null,validation=[],comparison=null,recovery=null,parentStale=false,child={dirty:false,saving:false},sourceCheck=false,sourceLinked=false,sourceError=null;
  const explicitSeoFields=new Set();
  const seoProjectionIntents=new Map();
  let childMetadata=[],childPermissions={read:[],update:[]},versioning=false;
  const readable=()=>PAGE_FIELDS.filter(f=>has(permissions.read,f)&&metadata.some(m=>m.field===f));
  const loader=async identity=>{
    const value=recordFrom(await api.get(`/items/pages/${encodeURIComponent(identity)}`,{params:{fields:readable().join(",")}}));
    if(String(value.id)!==String(identity)||!["updated_at","status","page_type","slug"].every(f=>Object.hasOwn(value,f)))throw Error("Missing page identity/version");
    return Object.fromEntries(readable().filter(f=>Object.hasOwn(value,f)).map(f=>[f,value[f]]));
  };
  const blocked=()=>!ready||opening||busy||failure||parentStale||child.saving||state?.saving||state?.loading||state?.conflict||state?.writeUncertain||statusState?.writeUncertain||statusState?.conflict||uncertainCreate||createdId;
  const protectedPage=()=>!creating&&(!sourceCheck||sourceLinked||pageRouteContext(state?.baseline).system);
  const canChange=field=>!blocked()&&!protectedPage()&&field!=="status"&&EDITABLE.includes(field)&&writableMeta(metadata.find(m=>m.field===field))&&
    (creating?has(permissions.create,field)&&has(permissions.read,field)&&field!=="page_type":Boolean(state?.canWrite(field)));
  const values=()=>{const current=creating?copy(draft):copy(state?.values??{});for(const [field,value] of seoProjectionIntents)current[field]=copy(value);return current;};
  const canSave=()=>!blocked()&&!protectedPage()&&(creating?createAllowed(metadata,permissions)&&!same(draft,defaults):Boolean(state?.canSave));
  const snapshot=()=>({ready,metadata:copy(metadata),permissions:copy(permissions),creating,createdId,loading:opening||Boolean(state?.loading),saving:busy||Boolean(state?.saving),
    values:values(),baseline:creating?copy(defaults):state?.baseline??{},seoProjectionIntents:Object.fromEntries(seoProjectionIntents),dirty:(creating?!createdId&&!same(draft,defaults):Boolean(state?.dirty))||child.dirty||uncertainCreate||Boolean(statusState?.writeUncertain),
    parentDirty:creating?!same(draft,defaults):Boolean(state?.dirty),childDirty:child.dirty,childSaving:child.saving,parentStale,sourceCheck,sourceLinked,sourceError,
    readError:failure||state?.readError,saveError:statusState?.saveError||state?.saveError,validation:copy(validation),comparison:copy(comparison),recovery:copy(recovery),
    conflict:Boolean(state?.conflict&&!fieldErrors(state?.saveError).length||statusState?.conflict&&!fieldErrors(statusState?.saveError).length),writeUncertain:uncertainCreate||Boolean(state?.writeUncertain||statusState?.writeUncertain),saved:Boolean(createdId||state?.saved),
    readonly:protectedPage()||!EDITABLE.some(canChange),canSave:canSave(),canStatus:!creating&&!blocked()&&!protectedPage()&&!state?.dirty&&!child.dirty&&Boolean(state?.canWrite("status")),
    childMetadata:copy(childMetadata),childPermissions:copy(childPermissions),fileReadAccess:has(permissionFields(effective?.directus_files?.read),"id"),versioning});
  const notify=()=>{if(!disposed)onChange?.(snapshot());};
  async function open(identity){
    if(busy||state?.saving)return {ok:false,reason:"busy"};
    const seq=++generation;opening=true;ready=false;failure=null;state=null;statusState=null;id=identity;creating=identity==="+";comparison=null;validation=[];recovery=null;createdId=null;uncertainCreate=false;sourceCheck=false;sourceLinked=false;sourceError=null;parentStale=false;child={dirty:false,saving:false};manualSlug=false;explicitSeoFields.clear();seoProjectionIntents.clear();notify();
    try{
      const [schema,access,collection]=await Promise.all([api.get("/fields/pages"),api.get("/permissions/me"),api.get("/collections/pages")]);
      if(seq!==generation||disposed)return {ok:false,stale:true};
      if(!Array.isArray(data(schema))||data(collection)?.collection!=="pages"||data(collection)?.meta?.singleton!==false)throw Error("Invalid pages collection metadata");
      const item=creating?null:data(await api.get(`/permissions/me/pages/${encodeURIComponent(identity)}`));
      if(seq!==generation||disposed)return {ok:false,stale:true};
      effective=data(access);permissions=pagePermissions(effective,item);metadata=data(schema).filter(f=>PAGE_FIELDS.includes(f.field));versioning=data(collection).meta.versioning===true;
      childPermissions={read:permissionFields(effective?.page_sections?.read),update:permissionFields(effective?.page_sections?.update)};
      if(!["id","updated_at","status","page_type","slug"].every(f=>has(permissions.read,f)&&metadata.some(m=>m.field===f)))throw deniedError("Page identity, route and version permissions required");
      if(creating){
        if(!createAllowed(metadata,permissions))throw deniedError("Native draft creation unavailable");
        defaults=Object.fromEntries(metadata.filter(f=>EDITABLE.includes(f.field)&&has(permissions.create,f.field)&&has(permissions.read,f.field)&&writableMeta(f)).map(f=>[f.field,copy(f.schema?.default_value??null)]));
        defaults.status="draft";defaults.page_type="standard";draft=copy(defaults);
      }else{
        const next=createEditorState({collection:"pages",editableFields:EDITABLE,permissions,fieldMetadata:Object.fromEntries(metadata.map(f=>[f.field,f])),guardedContract:true});
        const read=await next.load(loader,identity);
        if(seq!==generation||disposed)return {ok:false,stale:true};
        if(!read.ok)throw read.error??Error("Page read failed");state=next;
        try{
          if(!["id","source_page"].every(f=>has(permissionFields(effective?.home_page?.read),f)))throw deniedError("Home source permission unavailable");
          const home=recordFrom(await api.get("/items/home_page",{params:{fields:"id,source_page"}}));
          if(seq!==generation||disposed)return {ok:false,stale:true};
          if(home.id==null||!Object.hasOwn(home,"source_page"))throw Error("Home source relation unknown");
          sourceCheck=true;sourceLinked=String(home.source_page?.id??home.source_page??"")===String(identity);
        }catch(e){if(seq!==generation||disposed)return {ok:false,stale:true};sourceError=e;}
        // Child read failure affects only the Sections tab, not parent content.
        try{const childFields=data(await api.get("/fields/page_sections"));if(seq!==generation||disposed)return {ok:false,stale:true};childMetadata=Array.isArray(childFields)?childFields:[];}catch{childMetadata=[];}
      }
      ready=true;return {ok:true};
    }catch(e){if(seq===generation&&!disposed)failure=e;return {ok:false,error:e};}
    finally{if(seq===generation&&!disposed){opening=false;notify();}}
  }
  function change(field,value){
    if(!canChange(field)||value===undefined)return false;
    if(field==="seo"){
      const before=values().seo&&typeof values().seo==="object"&&!Array.isArray(values().seo)?values().seo:{};
      const after=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
      const baseline=creating?defaults:state?.baseline??defaults;
      const baselineSeo=baseline.seo&&typeof baseline.seo==="object"&&!Array.isArray(baseline.seo)?baseline.seo:{};
      const scalarPairs=[["seo_title","title"],["seo_description","meta_description"],["og_image","og_image"],["canonical_url","canonical_url"],["is_indexable","no_index"]];
      for(const [scalar,key] of scalarPairs){
        const beforeValue=seoJsonProjection(before,scalar,key,baseline[scalar]);
        const afterValue=seoJsonProjection(after,scalar,key,baseline[scalar]);
        const baseValue=seoJsonProjection(baselineSeo,scalar,key,baseline[scalar]);
        const beforeOwner=scalar==="canonical_url"?before.additional_fields??{}:before;
        const afterOwner=scalar==="canonical_url"?after.additional_fields??{}:after;
        const addedProjection=!Object.hasOwn(beforeOwner,key)&&Object.hasOwn(afterOwner,key);
        if((!same(beforeValue,afterValue)||addedProjection)&&(!same(values()[scalar],baseline[scalar])||!same(afterValue,baseValue)))explicitSeoFields.add(scalar);
      }
    }
    if(field==="og_image")value=value?.id??value??null;
    if(creating){draft[field]=copy(value);if(field==="slug")manualSlug=true;
      if(field==="title"&&!manualSlug){const suggestion=transliteratePageSlug(value);if(has(permissions.create,"slug")&&writableMeta(metadata.find(f=>f.field==="slug")))draft.slug=suggestion;}
    }else {
      const baseline=state?.baseline??{},display=pageSeoScalarValues(baseline);
      if(["seo_title","seo_description","og_image","is_indexable","canonical_url"].includes(field)&&same(value,baseline[field])&&!same(value,display[field])){
        if(!state.change(field,field==="is_indexable"?!value:"__seo_projection_change__"))return false;
        seoProjectionIntents.set(field,copy(value));
      }else{
        seoProjectionIntents.delete(field);
        if(!state.change(field,value))return false;
      }
    }
    validation=[];comparison=null;notify();return true;
  }
  function changeTab(fields,next){
    if(!creating){for(const f of fields)if(canChange(f)){if(Object.hasOwn(next??{},f))change(f,next[f]);else{seoProjectionIntents.delete(f);state.change(f,state.baseline[f]);}}return;}
    // Native forms emit an entire delta. An unchanged suggested slug is not
    // evidence of a manual edit when the title changes in that same delta.
    const titleChanged=fields.includes("title")&&Object.hasOwn(next??{},"title")&&!same(next.title,draft.title);
    if(fields.includes("slug")){
      if(Object.hasOwn(next??{},"slug")&&!same(next.slug,draft.slug))change("slug",next.slug);
      else if(!titleChanged&&!Object.hasOwn(next??{},"slug")&&!same(draft.slug,defaults.slug))change("slug",defaults.slug);
    }
    for(const f of fields.filter(f=>!["title","slug"].includes(f)))if(canChange(f))change(f,Object.hasOwn(next??{},f)?next[f]:defaults[f]);
    if(fields.includes("title")&&canChange("title"))change("title",Object.hasOwn(next??{},"title")?next.title:defaults.title);
  }
  async function refreshAfterWrite(){
    const pending=state.reconcile(loader,id,{keepEdits:false});notify();const result=await pending;
    if(!result.ok){failure=result.error??Error("Hook projection refetch failed");return {ok:false,committed:true,error:failure};}
    failure=null;comparison=null;parentStale=false;statusState=null;explicitSeoFields.clear();seoProjectionIntents.clear();return {ok:true};
  }
  async function save({confirmPublished=false}={}){
    if(!canSave())return {ok:false,reason:"unavailable"};
    if(!creating&&state.baseline.status==="published"&&!confirmPublished)return {ok:false,reason:"confirmation"};
    validation=[...validatePage(values(),metadata),...seoProjectionErrors(values(),creating?defaults:state.baseline,explicitSeoFields)];if(validation.length){notify();return {ok:false,reason:"validation"};}
    if(creating){
      busy=true;notify();
      let body=Object.fromEntries(EDITABLE.filter(f=>!["status","page_type"].includes(f)&&has(permissions.create,f)&&has(permissions.read,f)&&writableMeta(metadata.find(m=>m.field===f))&&Object.hasOwn(draft,f)&&(!same(draft[f],defaults[f])||CORE.includes(f))).map(f=>[f,copy(draft[f])]));
      body.status="draft";body.page_type="standard";
      body=synchronizeHydratedSeoProjection({changes:body},draft,defaults).changes;
      try{
        const ack=recordFrom(await api.post("/items/pages",body));
        if(typeof ack.id!=="string"||!ack.id||ack.status!=="draft"||ack.page_type!=="standard"||ack.slug!==body.slug)throw Error("Unconfirmed native creation");
        createdId=ack.id;return {ok:true,createdId};
      }catch(e){
        const code=codeOf(e),definite=["RECORD_NOT_UNIQUE","FAILED_VALIDATION","INVALID_PAYLOAD","FORBIDDEN"].includes(code)&&[400,403,409,422].includes(statusOf(e));
        if(definite)validation=[{field:code==="RECORD_NOT_UNIQUE"?"slug":e?.response?.data?.errors?.[0]?.extensions?.field??"title",type:code,message:errorText(e)}];
        else uncertainCreate=true;
        return {ok:false,error:e};
      }finally{busy=false;notify();}
    }
    busy=true;notify();
    try{
      const pending=state.save(async(_collection,identity,payload)=>{
        const changes={...payload.changes};
        for(const [field,value] of seoProjectionIntents)changes[field]=copy(value);
        const seoFields=["seo_title","seo_description","og_image","is_indexable","canonical_url"];
        const expected=seoFields.some(field=>Object.hasOwn(changes,field))&&Object.hasOwn(state.baseline,"seo")?{...payload.expected,seo:copy(state.baseline.seo)}:payload.expected;
        return data(await api.post(`/commerce/mutations/pages/${encodeURIComponent(identity)}`,synchronizeHydratedSeoProjection({...payload,expected,changes},values(),state.baseline)));
      });notify();
      const result=await pending;if(!result.ok){validation=fieldErrors(result.error);return result;}
      return await refreshAfterWrite();
    }finally{busy=false;notify();}
  }
  async function setStatus(next,{confirmed=false}={}){
    if(!snapshot().canStatus||!confirmed||!Object.hasOwn(STATUS,next)||next===state.baseline.status||!choices(metadata.find(f=>f.field==="status")).includes(next))return {ok:false,reason:"unavailable"};
    busy=true;notify();
    try{
      statusState=createEditorState({collection:"pages",editableFields:["status"],permissions,fieldMetadata:Object.fromEntries(metadata.map(f=>[f.field,f])),guardedContract:true});
      await statusState.load(async()=>state.baseline,id);statusState.change("status",next);
      const pending=statusState.save(async(_collection,identity,payload)=>data(await api.post(`/commerce/mutations/pages/${encodeURIComponent(identity)}`,payload)));notify();
      const result=await pending;if(!result.ok)return result;return await refreshAfterWrite();
    }finally{busy=false;notify();}
  }
  async function compare(){
    if(creating||!state||busy||opening||child.saving)return {ok:false,reason:"unavailable"};
    busy=true;notify();try{comparison=await loader(id);return {ok:true};}catch(e){return {ok:false,error:e};}finally{busy=false;notify();}
  }
  async function reconcile(keepEdits){
    if(!comparison||!state||busy||opening||child.saving)return {ok:false,reason:"compare-first"};
    busy=true;notify();try{const intents=copy(Object.fromEntries(seoProjectionIntents));const pending=state.reconcile(loader,id,{keepEdits:Boolean(keepEdits)});notify();const r=await pending;if(r.ok){comparison=null;failure=null;parentStale=false;statusState=null;validation=[];explicitSeoFields.clear();seoProjectionIntents.clear();if(keepEdits){busy=false;for(const [field,value] of Object.entries(intents))change(field,value);busy=true;}}return r;}finally{busy=false;notify();}
  }
  async function discardChanges(){
    if(busy||opening||child.saving||uncertainCreate||createdId)return {ok:false,reason:"unavailable"};
    if(creating){draft=copy(defaults);comparison=null;validation=[];notify();return {ok:true};}
    if(!state||!snapshot().parentDirty)return {ok:false,reason:"unavailable"};
    busy=true;notify();try{const pending=state.reconcile(loader,id,{keepEdits:false});notify();const result=await pending;if(result.ok){comparison=null;failure=null;parentStale=false;statusState=null;validation=[];explicitSeoFields.clear();seoProjectionIntents.clear();}return result;}finally{busy=false;notify();}
  }
  async function recoverCreate(){
    if(!creating||!uncertainCreate||busy||opening||typeof draft.slug!=="string"||!draft.slug.trim())return {ok:false,reason:"unavailable"};
    busy=true;notify();try{const r=await api.get("/items/pages",{params:buildCollectionQuery({fields:["id","title","slug","status","page_type"].filter(f=>has(permissions.read,f)),pageSize:2,filter:{slug:{_eq:draft.slug}},sort:"id"})});if(!Array.isArray(data(r))||data(r).length>2)throw Error("Invalid recovery result");recovery={records:copy(data(r))};return {ok:true};}catch(e){return {ok:false,error:e};}finally{busy=false;notify();}
  }
  function childState(next={}){
    child={dirty:Boolean(next.dirty),saving:Boolean(next.saving)};
    // Never silently rebase staged parent edits or lose a child's own baseline.
    if(next.saved)parentStale=true;
    notify();
  }
  return {open,change,changeTab,save,setStatus,compare,reconcile,discardChanges,recoverCreate,childState,snapshot,canChange,dispose:()=>{disposed=true;generation++;}};
}

const badge=value=>h("span",{class:`a3pages-badge a3pages-badge--${Object.hasOwn(STATUS,value)?value:"unknown"}`},STATUS[value]??"Статус недоступен");
const button=(label,onClick,props={})=>h("button",{type:"button",class:"a3pages-btn",onClick,...props},label);
const navigateLink=(router,id,label,props={})=>h("a",{href:`/admin/product-editor/sections/pages/${encodeURIComponent(id)}`,onClick:event=>{
  event.stopPropagation();if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.defaultPrevented)return;
  event.preventDefault();router.push(`/product-editor/sections/pages/${encodeURIComponent(id)}`);
},onKeydown:event=>event.stopPropagation(),...props},label);
const fullText=(text,className="")=>h("span",{class:`a3pages-full ${className}`,tabindex:0,"aria-label":text,"data-full-value":text},h("span",{class:"a3pages-clamp"},text));

const PageList=defineComponent({
  name:"PageList",
  setup(){
    const api=useApi(),router=useRouter(),revision=ref(0),dialog=ref(null),opener=ref(null),pending=ref({}),searchInput=ref(null);
    const controller=createPageListController(api,{onChange:()=>revision.value++});
    const snapshot=computed(()=>{revision.value;return controller.snapshot();});
    let timer;
    controller.open();onUnmounted(()=>{clearTimeout(timer);controller.dispose();dialog.value?.close();});
    const setQuery=next=>{clearTimeout(timer);const change=searchInput.value===null?next:{search:searchInput.value,...next};searchInput.value=null;return controller.query(change);};
    const reset=()=>setQuery({search:"",filters:{}});
    const close=()=>dialog.value?.close();
    const openFilters=()=>{pending.value={...snapshot.value.filters};dialog.value?.showModal();};
    function filterKey(event){
      if(event.key==="Escape"){event.preventDefault();event.stopPropagation();close();return;}
      if(event.key!=="Tab")return;event.stopPropagation();
      const controls=[...event.currentTarget.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled)')].filter(el=>el.getClientRects().length);
      const active=event.currentTarget.ownerDocument.activeElement;
      const target=event.shiftKey&&active===controls[0]?controls.at(-1):!event.shiftKey&&active===controls.at(-1)?controls[0]:null;
      if(target){event.preventDefault();target.focus();}
    }
    const columns=[{field:"title",label:"Название и адрес"},{field:"page_type",label:"Тип страницы"},{field:"status",label:"Статус"},{field:"updated_at",label:"Изменено"}];
    const sorts=[["-updated_at","Изменённые недавно"],["updated_at","Изменённые давно"],["title","Название: А–Я"],["-title","Название: Я–А"],["slug","Адрес: А–Я"],["-slug","Адрес: Я–А"]];
    const select=(label,value,options,onChange,props={})=>h("select",{class:"a3pages-control","aria-label":label,value,onChange:e=>onChange(e.target.value),...props},options.map(([value,text])=>h("option",{value},text)));
    function cell({row,column}){
      if(column.field==="title")return [navigateLink(router,row.id,row.title??"Без названия",{class:"a3pages-name","aria-label":`${row.title??"Без названия"}; адрес: /${row.slug??"—"}`}),fullText(row.slug==null?"—":`/${row.slug}`,"a3pages-slug")];
      if(column.field==="page_type")return TYPES[row.page_type]??row.page_type??"—";
      if(column.field==="status")return badge(row.status);
      const date=row.updated_at?new Date(row.updated_at):null;
      return date&&Number.isFinite(date.getTime())?h("time",{datetime:row.updated_at},date.toLocaleDateString("ru-RU")):"—";
    }
    return()=>{
      const s=snapshot.value;
      const controls=()=>h("div",[
        h("form",{class:"a3pages-controls",onSubmit:e=>{e.preventDefault();setQuery({search:searchInput.value??s.search});}},[
          h("input",{type:"search",class:"a3pages-control a3pages-search",value:s.search,placeholder:"Найти по названию или адресу","aria-label":"Поиск страниц",onInput:e=>{
            const search=e.target.value;controller.invalidate();clearTimeout(timer);
            // Immediate input state; debounce only the server request.
            searchInput.value=search;timer=setTimeout(()=>{searchInput.value=null;controller.query({search});},250);
          },...(searchInput.value!==null?{value:searchInput.value}:{})}),
          select("Статус",s.filters.status??"",[["","Все статусы"],...["published","draft","archived"].map(v=>[v,STATUS[v]])],value=>setQuery({filters:{...s.filters,status:value}})),
          button("☷ Фильтры",openFilters,{ref:opener,"aria-haspopup":"dialog"}),
          select("Сортировка",s.sort,sorts,value=>setQuery({sort:value})),
        ]),
        ["page_type","is_indexable"].some(f=>s.filters[f]!=null&&s.filters[f]!=="")?h("div",{class:"a3pages-chips"},[
          ...["page_type","is_indexable"].filter(f=>s.filters[f]!=null&&s.filters[f]!=="").map(f=>button(`${f==="page_type"?TYPES[s.filters[f]]:`Индексация: ${String(s.filters[f])==="true"?"разрешена":"запрещена"}`} ×`,()=>setQuery({filters:{...s.filters,[f]:null}}),{"aria-label":`Убрать фильтр ${f==="page_type"?"типа страницы":"индексации"}`})),button("Сбросить фильтры",reset),
        ]):null,
      ]);
      const filterDialog=h("dialog",{ref:dialog,class:"a3pages-dialog","aria-labelledby":"a3pages-filters-title",onKeydown:filterKey,onCancel:e=>{e.preventDefault();close();},onClose:()=>opener.value?.focus()},[
        h("div",{class:"a3pages-dialog-head"},[h("h2",{id:"a3pages-filters-title"},"Фильтры страниц"),button("×",close,{"aria-label":"Закрыть фильтры"})]),h("p",{class:"a3pages-muted"},"Дополнительные условия поиска."),
        h("form",{onSubmit:e=>{e.preventDefault();setQuery({filters:{...s.filters,page_type:pending.value.page_type??null,is_indexable:pending.value.is_indexable??null}});close();}},[
          h("label",{class:"a3pages-filter-field"},[h("span","Тип страницы"),select("Тип страницы",pending.value.page_type??"",[["","Все типы"],...Object.entries(TYPES)],value=>pending.value={...pending.value,page_type:value})]),
          h("label",{class:"a3pages-filter-field"},[h("span","Индексация"),select("Индексация",pending.value.is_indexable??"",[["","Любая"],["true","Разрешена"],["false","Запрещена"]],value=>pending.value={...pending.value,is_indexable:value})]),
          h("div",{class:"a3pages-dialog-foot"},[button("Сбросить",()=>pending.value={}),button("Отмена",close),h("button",{type:"submit",class:"a3pages-btn a3pages-primary"},"Применить")]),
        ]),
      ]);
      return h(AdminShell,{title:"Страницы",mode:"list",readonly:true}, {
        heading:()=>h("div",{class:"a3pages-heading"},[h("h1","Страницы"),s.total!=null?h("span",{class:"a3pages-muted","aria-label":"Количество найденных страниц"},String(s.total)):null]),
        toolbar:()=>s.canCreate?button("＋ Создать страницу",()=>router.push("/product-editor/sections/pages/+"),{class:"a3pages-btn a3pages-primary"}):null,
        main:()=>h("div",{class:"a3pages a3pages-list"},[h("style",pagesStyle),h("p",{class:"a3pages-subtitle"},"Информационные страницы сайта и их содержимое."),
          h(CollectionList,{rows:s.rows,columns,page:s.page,pageSize:25,total:s.total,loading:s.loading,error:s.error?errorText(s.error):false,onSelect:row=>router.push(`/product-editor/sections/pages/${encodeURIComponent(row.id)}`),onRetry:()=>controller.retry(),"onUpdate:page":page=>setQuery({page})},{controls,cell,
            loading:()=>h("div",{class:"a3pages-empty",role:"status"},"Загружаем страницы…"),
            empty:()=>s.total===0&&!s.search&&!Object.values(s.filters).some(v=>v!=null&&v!=="")?h("div",{class:"a3pages-empty",role:"status"},[h("h2","Страниц пока нет"),h("p",s.canCreate?"Создайте первую информационную страницу.":"У вас нет прав на создание страниц."),s.canCreate?button("Создать страницу",()=>router.push("/product-editor/sections/pages/+"),{class:"a3pages-btn a3pages-primary"}):null]):s.rows.length===0&&s.page>1?h("div",{class:"a3pages-empty",role:"status"},[h("h2","На этой странице списка записей нет"),h("p","Вернитесь к предыдущей странице списка."),button("К первой странице",()=>setQuery({page:1}))]):h("div",{class:"a3pages-empty",role:"status"},[h("h2","По этим условиям страницы не найдены"),h("p","Измените запрос или сбросьте поиск и фильтры."),button("Сбросить поиск и фильтры",reset)]),
            error:()=>h("div",{class:"a3pages-empty",role:"alert"},[h("h2",s.denied?"Нет доступа к страницам":"Не удалось загрузить страницы"),h("p",errorText(s.error)),button("Повторить",()=>controller.retry())]),
            pagination:({nextEnabled})=>h("nav",{class:"a3pages-pagination","aria-label":"Страницы списка"},[h("span",{"aria-live":"polite"},s.loading?"Загрузка…":s.rows.length?`${(s.page-1)*25+1}–${(s.page-1)*25+s.rows.length}${s.total==null?"":` из ${s.total}`} · по 25 на странице`:"Нет результатов"),h("div",[button("‹",()=>setQuery({page:s.page-1}),{disabled:s.loading||s.page===1,"aria-label":"Предыдущая страница"}),h("span",s.total==null?`Страница ${s.page}`:`${s.page} из ${Math.max(1,Math.ceil(s.total/25))}`),button("›",()=>setQuery({page:s.page+1}),{disabled:s.loading||Boolean(s.error)||!nextEnabled,"aria-label":"Следующая страница"})])]),
          }),filterDialog]),
      });
    };
  },
});

const PageEditor=defineComponent({
  name:"PageEditor",props:{id:{type:[String,Number],required:true}},
  setup(props){
    const api=useApi(),router=useRouter(),revision=ref(0),active=ref("main"),notice=ref(""),assetMissing=ref(false),statusDialog=ref(null),statusOpener=ref(null),nextStatus=ref("draft"),storefrontBase=ref(null),storefrontError=ref(false),editorRoot=ref(null);
    const controller=createPageController(api,{onChange:()=>revision.value++});
    const snapshot=computed(()=>{revision.value;return controller.snapshot();});
    let assetRequest=0;
    let storefrontRequest=0;
    async function loadStorefront(){const seq=++storefrontRequest;storefrontBase.value=null;storefrontError.value=false;try{const result=await api.get("/commerce/config/storefront");const base=result?.data?.data?.public_base_url;if(base!==null&&base!==undefined&&pagePublicUrl(base,{status:"published",slug:"example"})===null)throw Error("Invalid storefront address");if(seq===storefrontRequest)storefrontBase.value=base??null;}catch{if(seq===storefrontRequest)storefrontError.value=true;}revision.value++;}
    const run=async(fn)=>{notice.value="";const pending=fn();revision.value++;try{const r=await pending;if(r?.error)notice.value=errorText(r.error);return r;}finally{revision.value++;}};
    watch(()=>props.id,id=>{active.value="main";run(()=>controller.open(id));loadStorefront();},{immediate:true});
    watch(()=>snapshot.value.values.og_image,async value=>{
      const seq=++assetRequest;assetMissing.value=false;const id=value?.id??value;if(!id)return;
      try{await api.get(`/files/${encodeURIComponent(id)}`,{params:{fields:"id"}});}catch{if(seq===assetRequest)assetMissing.value=true;}
    });
    onUnmounted(()=>{assetRequest++;storefrontRequest++;controller.dispose();statusDialog.value?.close();});
    const confirm=text=>typeof window!=="undefined"&&window.confirm(text);
    async function save(){
      const s=controller.snapshot();if(s.baseline.status==="published"&&!confirm("Сохранить изменения опубликованной страницы? Они могут появиться на сайте. Блоки сохраняются отдельно."))return;
      const r=await run(()=>controller.save({confirmPublished:s.baseline.status==="published"}));
      if(r?.reason==="validation"){const field=controller.snapshot().validation[0]?.field;if(!field)return;active.value=["seo_title","seo_description","is_indexable","canonical_url","og_image"].includes(field)?"seo":"main";revision.value++;await nextTick();editorRoot.value?.querySelector(`[data-field="${field}"] input, [data-field="${field}"] textarea, [data-field="${field}"] select`)?.focus();}
      if(r?.createdId)router.replace(`/product-editor/sections/pages/${encodeURIComponent(r.createdId)}`);
    }
    const compare=()=>run(()=>controller.compare());
    let confirmDiscard=()=>Promise.resolve(false);
    const reconcile=async keep=>{if(!keep&&!await confirmDiscard())return;return run(()=>controller.reconcile(keep));};
    function form(subset,s){
      const delta=Object.fromEntries(subset.filter(f=>Object.hasOwn(s.values,f)&&!same(s.values[f],s.baseline[f])).map(f=>[f,s.values[f]]));
      for(const field of subset)if(Object.hasOwn(s.seoProjectionIntents??{},field))delta[field]=s.values[field];
      const renderedId=props.id,renderedTab=active.value;
      const initialValues=subset.some(field=>["seo_title","seo_description","og_image","is_indexable","canonical_url"].includes(field))?{...s.baseline,...pageSeoScalarValues(s.baseline)}:s.baseline;
      return h(NativeFieldGroup,{metadata:s.metadata.map(f=>({...f,name:FIELD_LABELS[f.field]??f.name??f.field,meta:{...f.meta,...(f.field==="page_type"&&choices(f).length?{interface:"select-dropdown",options:{...f.meta?.options,choices:choices(f).map(value=>({value,text:TYPES[value]??String(value)}))}}:{}),...(!controller.canChange(f.field)?{readonly:true}:{})}})),fieldSubset:subset,primaryKey:props.id,initialValues,modelValue:delta,permissions:{read:s.permissions.read,update:s.creating?s.permissions.create:s.permissions.update},readonly:s.readonly,disabled:s.saving||s.childSaving||s.loading||s.writeUncertain,validationErrors:s.validation,"onUpdate:modelValue":next=>{if(String(props.id)===String(renderedId)&&active.value===renderedTab){const edits={...next},display=pageSeoScalarValues(s.baseline);for(const field of ["seo_title","seo_description","og_image","is_indexable","canonical_url"])if(!Object.hasOwn(s.seoProjectionIntents??{},field)&&Object.hasOwn(edits,field)&&!same(s.baseline[field],display[field])&&same(edits[field],display[field]))delete edits[field];controller.changeTab(subset,edits);revision.value++;}}});
    }
    const disclosure=(title,content,open=false)=>h("details",{class:"a3pages-disclosure",...(open?{open:true}:{})},[h("summary",title),content]);
    function context(s){
      const route=pageRouteContext(s.values),savedRoute=pageRouteContext(s.baseline),publicUrl=pagePublicUrl(storefrontBase.value,s.baseline);
      return h("aside",{class:"a3pages-context"},[
        h("section",{class:"a3pages-context-card"},[h("h2","Страница на сайте"),h("p",{class:"a3pages-address"},s.creating?route.path??"Адрес появится после заполнения названия":savedRoute.path??"Сохранённый адрес недоступен"),
          h("dl",[h("div",[h("dt","Статус"),h("dd",badge(s.values.status))]),h("div",[h("dt","Индексация"),h("dd",pageSeoValue(s,"is_indexable")===true?"Разрешена":pageSeoValue(s,"is_indexable")===false?"Запрещена":"Недоступно")])]),
          savedRoute.fallback?h("p",{class:"a3pages-muted"},`Встроенная страница ${savedRoute.path} может оставаться доступной независимо от публикации этой записи.`):null,
          !s.creating&&s.values.slug!==s.baseline.slug&&route.path?h("p",{class:"a3pages-muted"},`После сохранения адрес изменится на ${route.path}.`):null,
          s.creating?h("p",{class:"a3pages-muted"},"Новая страница будет создана как черновик. Публичный адрес появится после публикации."):
            s.baseline.status==="draft"?h("p",{class:"a3pages-muted"},"Черновик не опубликован. После публикации посетители смогут открыть страницу."):s.baseline.status==="archived"?h("p",{class:"a3pages-muted"},"Страница снята с публикации и находится в архиве."):publicUrl?h("a",{class:"a3pages-btn",href:publicUrl,target:"_blank",rel:"noopener noreferrer"},"Открыть страницу на сайте ↗"):h("div",[h("p",{class:"a3pages-muted"},storefrontError.value?"Не удалось загрузить адрес сайта. Публичная ссылка появится после повторной попытки.":storefrontBase.value?"Публичная ссылка на эту страницу недоступна.":"Адрес сайта пока не настроен. Для ссылки нужен проверенный адрес витрины."),storefrontError.value?button("Повторить загрузку адреса сайта",loadStorefront):null]),
          s.creating?h("p",{class:"a3pages-muted"},"Блоки можно редактировать после создания страницы."):null,
          !s.creating?button("Изменить публикацию",()=>{nextStatus.value=s.values.status;statusDialog.value?.showModal();},{ref:statusOpener,disabled:!s.canStatus,"aria-haspopup":"dialog"}):null,
          !s.creating&&(s.parentDirty||s.childDirty)?h("p",{class:"a3pages-muted"},"Для смены статуса сначала сохраните или явно отбросьте правки страницы и блоков."):null,
        ]),
        h("section",{class:"a3pages-content-order"},[h("h2","Порядок содержимого"),h("strong",s.values.h1||s.values.title||"Заголовок появится после заполнения страницы"),h("p",s.values.intro||"Вступление появится после заполнения"),h("small","Затем блоки страницы и сохранённый текст внизу страницы.")]),
      ]);
    }
    const sourceNotice=s=>s.sourceLinked?h("div",{class:"a3pages-note",role:"note"},[h("p","Эта запись служит источником главной страницы. Редактирование в разделе «Страницы» отключено."),h("a",{class:"a3pages-btn",href:"/admin/product-editor/sections/home_page"},"Открыть главную страницу")]):!s.creating&&!s.sourceCheck?h("p",{class:"a3pages-note",role:"alert"},"Не удалось проверить назначение записи в главной странице. Редактирование отключено до успешной проверки."):pageRouteContext(s.baseline).system?h("p",{class:"a3pages-note",role:"note"},"Системная страница использует отдельный шаблон. В этом разделе доступен просмотр."):null;
    return()=>{
      const s=snapshot.value,title=s.creating?"Новая страница":s.values.title||"Страница";
      const pendingOutcome=s.conflict||s.writeUncertain||s.parentStale||s.ready&&Boolean(s.readError);
      // Aggregate unsaved state prevents an all-saved message while a block is dirty.
      const toolbarState={...s,dirty:s.dirty,saving:s.saving||s.childSaving,conflict:false,writeUncertain:false,saveError:null,readError:null,saved:s.saved&&!s.childDirty};
      const comparison=s.comparison?h("div",{class:"a3pages-diff"},EDITABLE.filter(f=>Object.hasOwn(s.values,f)&&Object.hasOwn(s.comparison,f)&&!same(s.values[f],s.comparison[f])).map(f=>{const summary=value=>MEDIA_FIELDS.has(f)?value==null||value===""?"Изображение не выбрано":"Изображение выбрано":f==="is_indexable"?value===true?"Показывать":"Не показывать":f==="page_type"?value==null||value===""?"Не заполнено":TYPES[value]??"Другой тип страницы":value&&typeof value==="object"?"Сохранённые дополнительные данные обновлены":value==null||value===""?"Не заполнено":String(value);return h("article",[h("h3",FIELD_LABELS[f]??"Изменение"),h(ReadonlyDetails,{values:{local:summary(s.values[f]),remote:summary(s.comparison[f])},fields:[{field:"local",label:"Ваши правки"},{field:"remote",label:"Сохранённые данные"}]})]);})):null;
      const conflict=pendingOutcome?h("section",{class:"a3pages-note a3pages-conflict",role:"region","aria-label":"Сверка страницы"},[
        h("h2",s.creating?"Создание не подтверждено":s.conflict?"Страница изменена в другом окне":s.parentStale?"После сохранения блока сверьте страницу":"Результат сохранения нужно проверить"),
        h("p",s.creating?"Запрос мог создать запись. Повторная отправка заблокирована; проверка адреса не подтверждает авторство найденной записи.":"Ваш ввод сохранён на экране. Сравнение и обновление данных ничего не записывают; сохранение выполняется отдельно."),
        s.creating?button("Проверить точный адрес",()=>run(()=>controller.recoverCreate()),{disabled:s.saving}):button("Сравнить изменения",compare,{disabled:s.saving||s.childSaving}),comparison,
        s.comparison?h("div",{class:"a3pages-actions"},[button("Оставить мои правки",()=>reconcile(true),{disabled:s.saving||s.childSaving}),button("Загрузить сохранённые значения",()=>reconcile(false),{disabled:s.saving||s.childSaving})]):null,
        s.recovery?h("div",[h("p",s.recovery.records.length?"Найдены страницы с этим адресом. Они не присвоены вашему запросу; откройте страницу отдельно и сравните данные.":"Страница не найдена. Это не доказывает, что запрос не будет завершён. Повторное создание отключено."),...s.recovery.records.map(row=>h("div",[navigateLink(router,row.id,row.title||"Без названия",{target:"_blank",rel:"noopener noreferrer",onClick:e=>e.stopPropagation()}),h(ReadonlyDetails,{values:{slug:row.slug,status:Object.hasOwn(STATUS,row.status)?STATUS[row.status]:"Недоступно"},fields:[{field:"slug",label:"Адрес страницы"},{field:"status",label:"Публикация"}]})]))]):null,
      ]):null;
      const hasMountedRecord=s.ready||Boolean(s.baseline?.id);
      const childEditor=hasMountedRecord&&!s.creating?h("div",{class:"a3pages-sections"},[
        h(PageSectionEditor,{key:String(props.id),parentCollection:"pages",parentId:s.baseline.id,api,metadata:Object.fromEntries(s.childMetadata.map(f=>[f.field,{...f,name:CHILD_LABELS[f.field]??f.name??f.field}])),editableFields:CHILD_FIELDS,readonlyFields:[{field:"section_type",reason:"Тип определяет оформление блока и доступен только для просмотра."},{field:"items",reason:"Сохранённые элементы нельзя менять в этом редакторе; исходные данные остаются без изменений."},{field:"settings",reason:"Дополнительные параметры остаются без изменений."},{field:"translations",reason:"Сохранённые переводы остаются без изменений."}],displayFields:["section_type","status","is_visible","sort_order"],permissions:s.childPermissions,guardedContract:true,readonly:s.readonly||s.saving||s.conflict||s.writeUncertain||s.parentStale||s.childSaving,labels:SECTION_LABELS,confirmDiscard:()=>confirmDiscard(),onStateChange:next=>controller.childState(next),onSaved:()=>controller.childState({dirty:controller.snapshot().childDirty,saving:false,saved:true})}),
      ]):h("p",{class:"a3pages-note"},"Сначала создайте страницу. После создания здесь появится её реальный список блоков.");
      const main=h("div",{class:"a3pages-layout"},[h("div",[
        h("section",{class:"a3pages-form-section"},[h("h2","Название и адрес"),h("p",{class:"a3pages-muted"},"Название помогает найти страницу в админке. Заголовок на сайте задаётся отдельно."),form(["title","slug","page_type"],s),h("p",{class:"a3pages-help"},"Для обычной страницы адрес задаётся отдельно от её типа.")]),
        h("section",{class:"a3pages-form-section"},[h("h2","Содержимое"),form(["h1","intro","seo_text"],s),disclosure("Надзаголовок",form(["eyebrow"],s),s.validation.some(e=>e.field==="eyebrow"))]),
      ]),context(s)]);
      const og=s.metadata.find(f=>f.field==="og_image");
      const seoValues={seo_title:pageSeoValue(s,"seo_title"),seo_description:pageSeoValue(s,"seo_description"),og_image:pageSeoValue(s,"og_image"),is_indexable:pageSeoValue(s,"is_indexable"),canonical_url:pageSeoValue(s,"canonical_url")};
      const seo=h("div",{class:"a3pages-layout"},[h("div",[h("h2","Поиск и ссылки"),h("p",{class:"a3pages-muted"},"Заголовок и описание помогают представить страницу в поиске и при отправке ссылки."),form(["seo_title","seo_description","is_indexable"],s),og?h(MediaPicker,{field:{...og,name:FIELD_LABELS.og_image},primaryKey:props.id,initialValue:{og_image:pageSeoScalarValues(s.baseline).og_image},modelValue:seoValues.og_image,permissions:{read:s.permissions.read,update:s.creating?s.permissions.create:s.permissions.update},readonly:s.readonly||!controller.canChange("og_image"),disabled:s.saving||s.childSaving||s.writeUncertain,allowSelect:s.fileReadAccess,allowUpload:false,missingAsset:assetMissing.value,"onUpdate:modelValue":value=>controller.change("og_image",value)}):null,disclosure("Основной адрес для поиска",form(["canonical_url"],s),s.validation.some(e=>e.field==="canonical_url"))]),
        h("aside",{class:"a3pages-context"},[h("h2","Пример оформления"),h("p",{class:"a3pages-muted"},"Это не поисковая выдача."),h("div",{class:"a3pages-context-card a3pages-snippet"},[h("small",pagePublicUrl(storefrontBase.value,s.baseline)??"Публичный адрес после публикации"),h("strong",seoValues.seo_title||s.values.title||"Заголовок страницы"),h("p",seoValues.seo_description||s.values.intro||"Описание страницы")])]),
      ]);
      const other=h("div",[h("section",{class:"a3pages-form-section"},[h("h2","Дополнительно"),s.baseline.eyebrow!=null&&s.baseline.eyebrow!==""?h("p",{class:"a3pages-muted"},"Надзаголовок сохранён. Витрина сейчас его не показывает."):null,Object.hasOwn(s.baseline,"translations")?h("div",{class:"a3pages-readonly-summary"},[h("strong","Переводы"),h("p",s.baseline.translations==null?"Переводы не заданы.":"Сохранённые переводы остаются без изменений; их ручное редактирование здесь недоступно.")]):null]),h("section",{class:"a3pages-form-section"},[h("h2","Системные сведения"),h(ReadonlyDetails,{values:s.baseline,fields:[{field:"created_at",label:"Создано"},{field:"updated_at",label:"Изменено"}]})])]);
      const panels=hasMountedRecord?TABS.map(tab=>h("section",{key:tab.id,hidden:active.value!==tab.id,class:`a3pages-tab a3pages-tab--${tab.id}`},tab.id==="main"?main:tab.id==="seo"?seo:tab.id==="sections"?childEditor:other)):[];
      const statusModal=h("dialog",{ref:statusDialog,class:"a3pages-dialog","aria-labelledby":"a3pages-status-title",onCancel:e=>{e.preventDefault();statusDialog.value?.close();},onClose:()=>statusOpener.value?.focus()},[
        h("h2",{id:"a3pages-status-title"},"Изменить публикацию страницы"),h("p","Публикация управляет доступностью страницы на сайте. Статусы блоков не меняются."),pageRouteContext(s.baseline).fallback?h("p",`Встроенная страница ${pageRouteContext(s.baseline).path} может оставаться доступной, даже если эта страница снята с публикации.`):null,
        h("label",{class:"a3pages-filter-field"},[h("span","Статус"),h("select",{class:"a3pages-control",value:nextStatus.value,"aria-label":"Новый статус",onChange:e=>nextStatus.value=e.target.value},choices(s.metadata.find(f=>f.field==="status")).filter(v=>Object.hasOwn(STATUS,v)).map(v=>h("option",{value:v},STATUS[v])))]),
        h("div",{class:"a3pages-dialog-foot"},[button("Отмена",()=>statusDialog.value?.close()),button("Подтвердить изменение",async()=>{statusDialog.value?.close();await run(()=>controller.setStatus(nextStatus.value,{confirmed:true}));},{disabled:!s.canStatus||nextStatus.value===s.baseline.status,class:"a3pages-btn a3pages-primary"})]),
      ]);
      return h(AdminShell,{title,state:{...toolbarState,loading:false,readonly:false},dirty:s.dirty,saving:s.saving||s.childSaving,readonly:false,cancelTitle:"Отменить изменения страницы?",onCancel:()=>run(()=>controller.discardChanges())}, {
        heading:()=>h("div",[h("a",{class:"a3pages-back",href:"/admin/product-editor/sections/pages",onClick:e=>{if(e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();router.push("/product-editor/sections/pages");}},"‹ Все страницы"),h("div",{class:"a3pages-heading"},[h("h1",title),badge(s.values.status)])]),
        toolbar:({requestCancel=()=>{},requestDiscard=()=>Promise.resolve(false)}={})=>{confirmDiscard=requestDiscard;return h(EditorToolbar,{title:"",state:toolbarState,readonly:!s.canSave,cancelLabel:s.parentDirty&&!s.conflict&&!s.writeUncertain&&!s.parentStale?"Отменить изменения":"",backLabel:"К списку страниц",saveLabel:s.creating?"Создать черновик":"Сохранить страницу",onCancel:requestCancel,onSave:save,onBack:()=>router.push("/product-editor/sections/pages")});},
        conflict:()=>null,
        main:()=>h("div",{ref:editorRoot,class:"a3pages a3pages-editor"},[h("style",pagesStyle),
            !hasMountedRecord&&s.loading?h("div",{class:"a3pages-empty",role:"status"},"Загружаем страницу…"):!hasMountedRecord&&!s.ready?h("div",{class:"a3pages-empty",role:"alert"},[h("h2","Страница недоступна"),h("p",errorText(s.readError)),button("Повторить загрузку",()=>run(()=>controller.open(props.id)))]):[
              s.loading?h("p",{role:"status"},"Обновляем сохранённые значения…"):null,
            sourceNotice(s),s.readonly&&!pendingOutcome&&!s.saving&&!s.childSaving&&!s.sourceLinked&&s.sourceCheck&&!pageRouteContext(s.baseline).system?h("p",{class:"a3pages-note",role:"status"},"Режим просмотра. Редактирование недоступно по текущим правам."):null,
            s.baseline.status==="published"&&s.parentDirty?h("p",{class:"a3pages-note",role:"note"},"Редактируется опубликованная запись. После сохранения изменения могут появиться на сайте."):null,
            conflict,notice.value?h("p",{role:"alert",class:"a3pages-note"},notice.value):null,
            s.validation.length?h("ul",{role:"alert",class:"a3pages-validation"},s.validation.map(e=>h("li",{key:e.field},e.message))):null,
            h(SectionTabs,{tabs:TABS,modelValue:active.value,disabled:s.loading||s.saving||s.childSaving,"onUpdate:modelValue":value=>active.value=value},{default:()=>panels}),
            h("p",{class:"a3pages-help"},"Сохранение страницы и блоков выполняется отдельно. Публикация меняется через кнопку «Изменить публикацию»."),statusModal,
          ],
        ]),
      });
    };
  },
});

export const PagesSection=defineComponent({name:"PagesSection",props:{id:{type:[String,Number],default:null}},setup:props=>()=>props.id==null||props.id===""?h(PageList):h(PageEditor,{id:props.id})});

const pagesStyle=`
.a3pages{--a3-line:var(--theme--border-color,#d9e1e8);--a3-ink:var(--theme--foreground,#182431);--a3-muted:var(--theme--foreground,#4f5464);--a3-bg:var(--theme--background,#fff);--a3-soft:var(--theme--background-subdued,#f4f7fa);color:var(--a3-ink);min-width:0;font-size:14px;line-height:1.5}
.a3pages *{box-sizing:border-box}.a3pages [hidden]{display:none!important}.a3pages-heading{display:flex;align-items:center;gap:12px;min-width:0;flex-wrap:wrap}.a3pages-heading h1{font-size:24px!important;line-height:1.25;overflow-wrap:anywhere;min-width:0;max-width:850px}.a3pages-muted,.a3pages-help,.a3pages-subtitle{color:var(--a3-muted);font-size:13px}.a3pages-help{font-size:12px;margin-top:12px}.a3pages-subtitle{margin:-4px 0 20px}.a3pages-back{display:inline-block;color:var(--theme--primary,#6644ff);font-size:13px;margin-bottom:12px}.a3pages .a3pages-btn,.ac-shell__header:has(.a3pages-heading) button{min-height:40px;padding:8px 14px;border:1px solid var(--theme--border-color,#d9e1e8);border-radius:6px;background:var(--theme--background,#fff);color:var(--theme--foreground,#182431);font:inherit;line-height:20px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;text-decoration:none}.a3pages .a3pages-primary,.ac-shell__header:has(.a3pages-heading) .a3pages-primary{background:var(--theme--primary,#6644ff);color:var(--theme--primary--foreground,#fff);border-color:var(--theme--primary,#6644ff)}.a3pages button:disabled,.ac-shell__header:has(.a3pages-heading) button:disabled{opacity:.5;cursor:not-allowed}.a3pages :is(button,input,select,a,summary):focus-visible,.a3pages-heading a:focus-visible{outline:2px solid var(--theme--primary,#6644ff);outline-offset:3px}.a3pages-controls{display:grid;grid-template-columns:minmax(160px,1fr) 170px auto 210px;gap:10px;margin-bottom:18px;align-items:start}.a3pages .a3pages-control{height:40px;min-height:40px;max-width:100%;min-width:0;border:1px solid var(--a3-line);border-radius:6px;padding:0 12px;color:var(--a3-ink);background:var(--a3-bg);font:inherit;font-size:13px;align-self:start}.a3pages .a3pages-search{width:100%}.a3pages .ac-list{border:1px solid var(--a3-line);border-radius:9px;padding:20px 22px 0;background:var(--a3-bg)}.a3pages-list .ac-list{container-type:inline-size}.a3pages-list .ac-list__scroll{overflow:visible;border-top:1px solid var(--a3-line)}.a3pages-list table{width:100%;table-layout:fixed;border-collapse:collapse}.a3pages-list th{font-size:12px;font-weight:500;color:var(--a3-muted);padding:12px 8px;text-align:left;border-bottom:1px solid var(--a3-line)}.a3pages-list td{padding:14px 8px;border-bottom:1px solid var(--a3-line);font-size:13px;vertical-align:middle;overflow-wrap:anywhere}.a3pages-list th:first-child{width:44%}.a3pages-list th:nth-child(2){width:20%}.a3pages-list th:nth-child(3){width:19%}.a3pages-list th:nth-child(4){width:17%}.a3pages-list th:first-child,.a3pages-list td:first-child{padding-left:0}.a3pages-list td:nth-child(2),.a3pages-list time{color:var(--a3-muted);font-size:12px}.a3pages-list time{white-space:nowrap}.a3pages-name{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;line-height:20px;font-size:14px;font-weight:600;text-decoration:none;color:var(--a3-ink)}.a3pages-name:hover{color:var(--theme--primary,#6644ff)}.a3pages-full{display:block;position:relative;min-width:0;outline-offset:3px}.a3pages-clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}.a3pages-slug{margin-top:3px;font-size:12px;color:var(--a3-muted)}.a3pages-slug .a3pages-clamp{display:block;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.a3pages-full:focus-visible::after{content:attr(data-full-value);position:absolute;top:100%;left:0;z-index:5;max-width:min(360px,70vw);width:max-content;white-space:normal;overflow-wrap:anywhere;background:var(--a3-bg);color:var(--a3-ink);border:1px solid var(--a3-line);border-radius:6px;padding:8px}.a3pages-badge{display:inline-flex;align-items:center;gap:6px;max-width:100%;font-size:12px;line-height:20px;padding:2px 8px;border-radius:4px;background:var(--theme--primary-background,#edf7f0);color:var(--theme--primary,#248157);white-space:nowrap}.a3pages-badge::before{content:"";width:5px;height:5px;border-radius:50%;background:currentColor}.a3pages-badge--draft{background:var(--theme--warning-background,#faf4e7);color:var(--a3-ink)}.a3pages-badge--draft::before{background:#967322}.a3pages-badge--archived,.a3pages-badge--unknown{background:var(--theme--background-subdued,#f2f4f7);color:var(--a3-muted)}.a3pages-pagination{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 0;color:var(--a3-muted);font-size:12px}.a3pages-pagination>div{display:flex;align-items:center;gap:10px}.a3pages-pagination .a3pages-btn{min-width:36px;padding:6px 10px}.a3pages-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}.a3pages-chips .a3pages-btn{font-size:12px;padding:5px 9px}.a3pages-empty{padding:48px 16px;text-align:center}.a3pages-empty h2{font-size:18px;margin-bottom:10px}.a3pages-empty p{margin-bottom:16px}.a3pages-dialog{padding:24px;border:1px solid var(--a3-line);border-radius:12px;background:var(--a3-bg);color:var(--a3-ink);width:520px;max-width:calc(100vw - 32px);max-height:calc(100dvh - 32px);margin:auto;overflow:auto;box-shadow:0 18px 70px #14233430}.a3pages-dialog:not([open]){display:none}.a3pages-dialog::backdrop{background:#14233470}.a3pages-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.a3pages-dialog h2{font-size:20px;margin:0 0 12px}.a3pages-dialog-head .a3pages-btn{border:0;padding:0;min-width:40px}.a3pages-filter-field{display:grid;gap:8px;margin:20px 0;font-size:13px}.a3pages-filter-field>span{font-weight:600}.a3pages-dialog-foot{display:flex;gap:8px;justify-content:flex-end;border-top:1px solid var(--a3-line);padding-top:16px;margin-top:22px}.a3pages-dialog-foot>button:first-child:not(:last-child){margin-right:auto}.a3pages-layout{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(250px,1fr);gap:32px;align-items:start}.a3pages-layout>div,.a3pages-context{min-width:0}.a3pages h2{font-size:15px;font-weight:600;margin:0 0 8px}.a3pages-form-section+.a3pages-form-section{margin-top:24px;padding-top:24px;border-top:1px solid var(--a3-line)}.a3pages-form-section>.a3pages-muted{margin:0 0 18px}.a3pages-disclosure{margin-top:24px;padding:20px 0;border-top:1px solid var(--a3-line)}.a3pages-disclosure summary{cursor:pointer;font-size:13px;font-weight:600;color:var(--a3-muted)}.a3pages-disclosure[open] summary{margin-bottom:18px}.a3pages-context-card{padding:18px;border:1px solid var(--a3-line);border-radius:8px;background:var(--a3-bg);margin-bottom:24px}.a3pages-address{overflow-wrap:anywhere;color:var(--theme--primary,#6644ff);font-size:13px;margin:12px 0 22px}.a3pages-context dl{margin:0 0 16px}.a3pages-context dl>div{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--a3-line);font-size:12px}.a3pages-context dd{margin:0;font-weight:600}.a3pages-context dl>div:nth-child(2) dd{color:var(--a3-muted)}.a3pages-context-card>.a3pages-btn{margin-top:12px}.a3pages-content-order{border-left:2px solid var(--theme--primary-background,#e6dfff);padding-left:18px;overflow-wrap:anywhere}.a3pages-content-order h2{color:var(--a3-muted);font-size:12px}.a3pages-content-order p,.a3pages-content-order small{color:var(--a3-muted);font-size:12px;margin-top:10px}.a3pages-tab{padding:26px 28px;min-width:0}.a3pages-editor .ac-tabs{border:1px solid var(--a3-line);border-radius:9px;background:var(--a3-bg);margin-top:18px}.a3pages-editor>.ac-tabs>.ac-tabs__list{border-bottom:1px solid var(--a3-line);padding:0 24px;gap:22px;flex-wrap:nowrap;overflow-x:auto}.a3pages-editor>.ac-tabs>.ac-tabs__list>button{min-height:50px;white-space:nowrap;font-size:13px}.a3pages-editor .field-label-content{font-size:13px}.a3pages-editor .field{margin-bottom:12px}.a3pages-editor .v-form.grid{row-gap:16px}.a3pages-editor .v-form.grid .field{margin-block-end:0;margin-bottom:0}.a3pages-editor>.ac-tabs>.ac-tabs__list>button:not([aria-selected="true"]){color:var(--a3-muted)}.a3pages-editor :is(.field-description,.field-hint,.text-subdued,.type-label){color:var(--a3-muted)}.ac-shell__header:has(.a3pages-heading) .ac-toolbar [aria-live="polite"]{color:var(--a3-muted)}.a3pages-editor .v-input,.a3pages-editor .v-input>.input{height:40px;min-height:40px}.a3pages-editor .v-input>.input input{height:38px;min-height:38px}.a3pages-editor .v-textarea,.a3pages-editor .v-textarea textarea{height:80px!important;min-height:80px!important}.a3pages-snippet strong{display:block;color:var(--theme--primary,#244fab);font-size:17px;line-height:1.4;margin:8px 0}.a3pages-snippet p{font-size:12px;color:var(--a3-muted);overflow-wrap:anywhere}.a3pages-snippet small{overflow-wrap:anywhere}.a3pages-note{margin:14px 0;padding:12px 16px;border:1px solid var(--theme--warning,#d9b36a);border-radius:7px;background:var(--theme--warning-background,#fffaf0);font-size:13px;overflow-wrap:anywhere}.a3pages-note p{margin:0 0 10px}.a3pages-note p:last-child{margin-bottom:0}.a3pages-conflict h2{margin-bottom:8px}.a3pages-conflict .a3pages-btn{margin-top:8px}.a3pages-actions{display:flex;gap:8px;flex-wrap:wrap}.a3pages-diff{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}.a3pages-diff article{border:1px solid var(--a3-line);border-radius:6px;padding:12px;min-width:0;overflow-wrap:anywhere}.a3pages-diff h3{font-size:14px;margin-bottom:8px}.a3pages-validation{color:var(--theme--danger,#c83445);margin:12px 0;list-style:disc;padding-left:20px}.a3pages-sections .page-section-editor{display:grid;grid-template-columns:minmax(220px,.74fr) minmax(0,1fr);gap:24px;align-items:start}.a3pages-sections .page-sections-list{grid-column:1;grid-row:1 / span 8;max-height:560px;overflow:auto}.a3pages-sections .page-sections-list>button{width:100%;margin-bottom:8px}.a3pages-sections .ac-toolbar,.a3pages-sections .ac-tabs,.a3pages-sections .page-section-compare,.a3pages-sections .page-section-support-note{grid-column:2}.a3pages-sections .ac-tabs__list{flex-wrap:wrap}.a3pages-sections .page-sections-list h3{font-size:16px;margin-bottom:14px}.ac-shell__header:has(.a3pages-heading) .ac-toolbar>div:first-child strong:empty{display:none}.ac-shell__header:has(.a3pages-heading) .ac-toolbar__actions{flex-wrap:wrap}.ac-shell__header:has(.a3pages-heading) .ac-toolbar>div:first-child{font-size:12px}.ac-shell__header:has(.a3pages-heading){align-items:flex-start}
@media(max-width:1100px){.a3pages-controls{grid-template-columns:minmax(130px,1fr) 145px auto 180px;gap:8px}.a3pages-layout{grid-template-columns:minmax(0,1.2fr) minmax(220px,1fr);gap:24px}.a3pages-tab{padding:22px}.a3pages .ac-list{padding:16px 16px 0}}
@media(max-width:760px){.a3pages-controls{grid-template-columns:1fr 1fr;gap:10px}.a3pages-search,.a3pages-controls>select:last-child{grid-column:1/-1}.a3pages .a3pages-control,.a3pages .a3pages-btn,.ac-shell__header:has(.a3pages-heading) button{height:44px;min-height:44px}.a3pages-list th:nth-child(2),.a3pages-list td:nth-child(2),.a3pages-list th:nth-child(4),.a3pages-list td:nth-child(4){display:none}.a3pages-list th:first-child{width:58%}.a3pages-list th:nth-child(3){width:42%}.a3pages-list td{padding:16px 5px}.a3pages-list .a3pages-name{font-size:13px}.a3pages-list .a3pages-badge{font-size:10px;padding:2px 5px;gap:4px;white-space:normal;overflow-wrap:anywhere;line-height:1.35}.a3pages-list .a3pages-badge::before{flex:0 0 5px}.a3pages-list .ac-list__scroll{min-width:0}.a3pages-layout,.a3pages-sections .page-section-editor,.a3pages-diff{grid-template-columns:minmax(0,1fr);gap:24px}.a3pages-tab{padding:22px 16px}.a3pages-editor>.ac-tabs>.ac-tabs__list{padding:0 16px;gap:20px}.a3pages-context{margin-top:8px}.a3pages-pagination{align-items:flex-start;flex-direction:column;gap:12px}.a3pages-pagination>div{align-self:flex-end}.a3pages-heading h1{font-size:22px!important}.ac-shell__header:has(.a3pages-heading){flex-direction:column;gap:14px}.ac-shell__header:has(.a3pages-heading) .ac-toolbar{width:100%;align-items:flex-start;gap:8px}.ac-shell__header:has(.a3pages-heading) .ac-toolbar__actions{justify-content:flex-end}.a3pages-dialog{padding:20px;max-width:calc(100vw - 24px)}.a3pages-dialog-foot{gap:6px;flex-wrap:wrap}.a3pages-dialog-foot .a3pages-btn{padding:8px 10px;font-size:12px}.a3pages-sections .page-sections-list{max-height:240px;grid-column:1;grid-row:auto}.a3pages-sections .ac-toolbar,.a3pages-sections .ac-tabs,.a3pages-sections .page-section-compare,.a3pages-sections .page-section-support-note{grid-column:1;grid-row:auto}.a3pages-editor .v-input,.a3pages-editor .v-input>.input{height:44px;min-height:44px}.a3pages-editor .v-input>.input input{height:42px;min-height:42px}}
@container (max-width:240px){.a3pages-list .a3pages-controls{grid-template-columns:minmax(0,1fr)}.a3pages-list .a3pages-controls>*{grid-column:1}.a3pages-list th:first-child{width:56%}.a3pages-list th:nth-child(3){width:44%}.a3pages-list .a3pages-badge{white-space:normal;overflow-wrap:anywhere}}
`;
