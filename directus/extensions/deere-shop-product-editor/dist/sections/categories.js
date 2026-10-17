import { useApi } from "@directus/extensions-sdk";
import { defineComponent, h, ref, computed, watch, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { AdminShell, SectionTabs, EditorToolbar, NativeFieldGroup, CollectionList, MediaPicker, ReadonlyDetails, buildCollectionQuery } from "../admin-shell.js";
import { createEditorState } from "../admin-state.mjs";

export const CATEGORY_TABS = [
  { id: "main", label: "Основное", fields: ["status","title","slug","parent","description","image","image_alt","icon","icon_alt","sort_order","show_on_homepage"] },
  { id: "content", label: "Содержание", fields: ["h1","intro","seo_text","selection_guide","internal_links","faq"] },
  { id: "seo", label: "SEO", fields: ["seo_title","seo_description","og_image","is_indexable","seo","redirect_target"] },
  { id: "other", label: "Дополнительно", fields: ["translations","id","created_at","updated_at"] },
];
const ALL = CATEGORY_TABS.flatMap(t => t.fields);
const TECHNICAL = new Set(["id","created_at","updated_at"]);
const EDITABLE = ALL.filter(f => !TECHNICAL.has(f) && f !== "parent");
const MEDIA = ["image","icon","og_image"];
const EFFECTS = ["slug","status","redirect_target","is_indexable","seo"];
const STATUS = { draft: "Черновик", published: "Опубликована", archived: "Архив" };
const LIST_FIELDS = ["id","title","slug","parent.id","parent.title","status","show_on_homepage","sort_order","updated_at"];
const SORTS = ["title","slug","parent","status","show_on_homepage","sort_order","updated_at"];
const copy = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
const same = (a,b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const data = r => r?.data?.data;
const has = (p,f) => p === true || Array.isArray(p) && (p.includes("*") || p.includes(f));
const unwrapId = x => x && typeof x === "object" ? x.id ?? null : x;
const endpoint = id => `/items/categories/${encodeURIComponent(id)}`;
const itemPermission = id => `/permissions/me/categories/${encodeURIComponent(id)}`;
const errorText = e => {
  const status = e?.response?.status ?? e?.status;
  const code = e?.response?.data?.errors?.[0]?.extensions?.code ?? e?.response?.data?.errors?.[0]?.code;
  if (code === "RECORD_NOT_UNIQUE") return "Этот slug уже используется. Введённые значения сохранены локально.";
  if (status === 403) return "Недостаточно прав. Запрос отклонён Directus.";
  if (status === 404) return "Запись недоступна или удалена.";
  if (status === 409) return "Конфликт данных или уникальности. Введённые значения сохранены локально.";
  return "Не удалось подтвердить запрос. Проверьте связь и загрузите актуальные данные.";
};

export function buildCategoriesQuery({ page = 1, search = "", sort = "-updated_at", filters = {} } = {}) {
  if (!SORTS.includes(sort.replace(/^-/, ""))) throw new TypeError("Unknown category sort");
  const and = [];
  if (search.trim()) and.push({ _or: ["title","slug","h1"].map(f => ({ [f]: { _icontains: search.trim() } })) });
  for (const field of ["status","parent","show_on_homepage","is_indexable"]) {
    const value = filters[field];
    if (value == null || value === "") continue;
    if (["show_on_homepage","is_indexable"].includes(field)) {
      if (![true,false,"true","false"].includes(value)) throw new TypeError("Invalid boolean filter");
      and.push({ [field]: { _eq: value === true || value === "true" } });
    } else if (field === "parent" && value === "__root__") and.push({ parent: { _null: true } });
    else and.push({ [field]: { _eq: value } });
  }
  return { ...buildCollectionQuery({ fields: LIST_FIELDS, page, pageSize: 25, sort: `${sort},id`, filter: and.length ? { _and: and } : undefined }), meta: "filter_count" };
}

/** Effective collection fields plus per-item permission. Unknown access is closed. */
export function categoryPermissions(response = {}, item = null) {
  const p = response.categories ?? {};
  const fields = action => ["full","partial"].includes(p[action]?.access) && Array.isArray(p[action]?.fields) ? [...p[action].fields] : [];
  return { read: fields("read"), update: item?.update?.access === true ? fields("update") : [], create: p.create?.access === "full" ? fields("create") : [] };
}

export function validateCategory(values, metadata) {
  const errors = [];
  for (const field of Array.isArray(metadata) ? metadata : Object.values(metadata ?? {})) {
    const name = field.field;
    if (!EDITABLE.includes(name) || !Object.hasOwn(values, name)) continue;
    const v = values[name];
    const label = field.name ?? field.meta?.translations?.find(t => t.language === "ru-RU")?.translation ?? name;
    const fail = message => errors.push({ field: name, message: `${label}: ${message}`, type: "FAILED_VALIDATION" });
    if ((field.meta?.required || field.schema?.is_nullable === false) && (v == null || typeof v === "string" && !v.trim())) { fail("обязательное поле"); continue; }
    if (v == null || v === "") continue;
    const choices = field.meta?.options?.choices;
    if (choices?.length && !choices.some(c => same(typeof c === "object" ? c.value : c, v))) fail("выберите допустимое значение");
    if (name === "slug" && (typeof v !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v))) fail("используйте строчные латинские буквы, цифры и дефисы");
    if (field.type === "integer" && !Number.isSafeInteger(v)) fail("нужно целое число");
    if (field.type === "boolean" && typeof v !== "boolean") fail("нужно логическое значение");
    if (["string","text"].includes(field.type) && typeof v !== "string") fail("нужен текст");
    if (typeof v === "string" && field.schema?.max_length && v.length > field.schema.max_length) fail(`максимум ${field.schema.max_length} символов`);
    if (field.type === "json" && typeof v === "string") fail("нужен корректный JSON, а не строка");
    if (name === "redirect_target" && v === `/catalog/${values.slug}`) fail("перенаправление не должно вести на эту же категорию");
  }
  return errors;
}

/** Uses the A0 imperative state; the view invalidates its reactive snapshot. */
export function createCategoryController(api) {
  let state = null, metadata = [], permissions = { read: [], update: [], create: [] }, filePermissions = {}, identity = null;
  let generation = 0, busy = false, opening = false, failure = null, validation = [], comparison = null;
  let creating = false, created = false, uncertainCreate = false, defaults = {}, draft = {}, createSaved = false, createRecovery = null;
  const readable = () => ALL.filter(f => metadata.some(m => m.field === f) && has(permissions.read,f));
  const loader = async id => data(await api.get(endpoint(id), { params: { fields: readable().join(",") } }));
  const snapshot = () => ({ metadata: copy(metadata), permissions: copy(permissions), filePermissions: copy(filePermissions), creating,
    loading: opening || Boolean(state?.loading), saving: busy || Boolean(state?.saving), readError: failure || state?.readError,
    values: creating ? copy(draft) : state?.values ?? {}, baseline: creating ? copy(defaults) : state?.baseline ?? {},
    dirty: creating ? !created && !same(draft,defaults) : Boolean(state?.dirty), dirtyFields: creating ? Object.keys(draft).filter(f => !same(draft[f],defaults[f])) : state?.dirtyFields ?? [],
    conflict: Boolean(state?.conflict), writeUncertain: uncertainCreate || Boolean(state?.writeUncertain), saveError: state?.saveError,
    saved: createSaved || Boolean(state?.saved), validation: copy(validation), comparison: copy(comparison), createRecovery: copy(createRecovery),
    readonly: creating ? !has(permissions.create,"title") : !EDITABLE.some(f => state?.canWrite(f)),
    canCreate: ["title","slug","status"].every(f => has(permissions.create,f)) && metadata.some(f => f.field === "status" && f.schema?.default_value === "draft"),
    canSave: !failure && !opening && !busy && !validation.length && (creating ? !created && !uncertainCreate && ["title","slug","status"].every(f => has(permissions.create,f)) && !same(draft,defaults) : Boolean(state?.canSave)),
  });
  const canChange = field => !opening && !busy && !failure && EDITABLE.includes(field) && (creating ? !created && !uncertainCreate && field !== "status" && has(permissions.create,field) && has(permissions.read,field) && metadata.some(m => m.field === field && !m.meta?.readonly && m.type !== "alias") : state?.canWrite(field));
  async function open(id) {
    if (busy || state?.saving) return { ok:false,reason:"busy" };
    const seq = ++generation; identity = id; opening = true; failure = null; state = null; comparison = null; validation = []; creating = id === "+"; created = false; uncertainCreate = false; createSaved = false; createRecovery = null;
    try {
      const [schema, effective] = await Promise.all([api.get("/fields/categories"),api.get("/permissions/me")]);
      if (seq !== generation) return { ok:false,stale:true };
      metadata = data(schema).filter(f => ALL.includes(f.field)).map(f => ({ ...f, name: f.meta?.translations?.find(t => t.language === "ru-RU")?.translation ?? f.field }));
      let item = null;
      if (!creating) { item = data(await api.get(itemPermission(id))); if(seq !== generation)return {ok:false,stale:true}; }
      permissions = categoryPermissions(data(effective),item); filePermissions = data(effective)?.directus_files ?? {};
      if (!has(permissions.read,"id") || !has(permissions.read,"updated_at")) throw Object.assign(Error("Read denied"),{status:403});
      if (creating) {
        if (!["title","slug","status"].every(f => has(permissions.create,f)) || !metadata.some(f => f.field === "status" && f.schema?.default_value === "draft")) throw Object.assign(Error("Draft create unavailable"),{status:403});
        defaults = Object.fromEntries(metadata.filter(f => EDITABLE.includes(f.field) && has(permissions.read,f.field) && has(permissions.create,f.field)).map(f => [f.field, copy(f.schema?.default_value ?? null)]));
        defaults.status = "draft"; draft = copy(defaults);
      } else {
        state = createEditorState({ collection:"categories", editableFields:EDITABLE, permissions, fieldMetadata:Object.fromEntries(metadata.map(f => [f.field,f])), guardedContract:true });
        await state.load(loader,id);
      }
      return {ok:!snapshot().readError};
    } catch(e) { if(seq === generation)failure=e; return {ok:false,error:e}; }
    finally { if(seq === generation)opening=false; }
  }
  function change(field,value) {
    if (!canChange(field) || value === undefined) return false;
    if (MEDIA.includes(field)) value = unwrapId(value);
    if (creating) draft[field] = copy(value); else if (!state.change(field,value)) return false;
    validation = []; comparison = null; createSaved = false; return true;
  }
  function changeTab(fields,delta) {
    const base = creating ? defaults : state?.baseline ?? {};
    for (const f of fields) if (canChange(f)) change(f,Object.hasOwn(delta ?? {},f) ? delta[f] : base[f]);
  }
  async function save() {
    if (!snapshot().canSave) return {ok:false,reason:"unavailable"};
    validation = validateCategory(snapshot().values,metadata.filter(m => has(permissions.read,m.field)));
    if (validation.length) return {ok:false,reason:"validation"};
    busy = true;
    try {
      if (creating) {
        const body = Object.fromEntries(EDITABLE.filter(f => f !== "status" && canCreateField(f) && Object.hasOwn(draft,f) && !same(draft[f],defaults[f])).map(f => [f,copy(draft[f])]));
        body.status = "draft";
        // Native create has no automatic retry: any uncertain result locks this form.
        const ack = data(await api.post("/items/categories",body));
        if (!ack?.id || ack.status !== "draft") throw Error("Unconfirmed draft creation");
        created = true; createSaved = true; return {ok:true,createdId:ack.id};
      }
      const result = await state.save(async (collection,id,payload) => data(await api.post(`/commerce/mutations/${collection}/${encodeURIComponent(id)}`,payload)));
      // SEO hooks project scalars/JSON. Refresh all readable fields, never merge
      // an old companion JSON into the next edit after a successful hook write.
      if (result.ok) { await state.load(loader,identity); createSaved = true; }
      return result;
    } catch(e) { uncertainCreate = creating; failure = creating ? e : failure; return {ok:false,error:e}; }
    finally { busy = false; }
  }
  function canCreateField(f) { return has(permissions.create,f) && has(permissions.read,f) && metadata.some(m => m.field === f && !m.meta?.readonly && m.type !== "alias"); }
  async function compare() {
    if (!state || busy || opening) return {ok:false};
    busy = true;
    try { comparison = await loader(identity); return {ok:true}; } catch(e) { return {ok:false,error:e}; } finally { busy=false; }
  }
  async function recoverCreate() {
    if (!creating || !uncertainCreate || busy || opening || typeof draft.slug !== "string" || !draft.slug.trim()) return {ok:false};
    const seq=generation; busy=true;
    try {
      const rows=data(await api.get("/items/categories",{params:buildCollectionQuery({fields:readable(),pageSize:2,filter:{slug:{_eq:draft.slug}}})}));
      if(seq!==generation)return {ok:false,stale:true};
      if(!Array.isArray(rows)||rows.length>1)throw Error("Ambiguous category result");
      createRecovery={record:rows[0]??null};
      return {ok:true};
    } catch(error) {return {ok:false,error};} finally {busy=false;}
  }
  async function reconcile(keepEdits) {
    if (!state || busy || opening || !comparison) return {ok:false};
    busy=true;
    try { const result=await state.reconcile(loader,identity,{keepEdits}); if(result.ok){comparison=null;validation=[];} return result; } finally {busy=false;}
  }
  return { open, change, changeTab, save, compare, reconcile, recoverCreate, snapshot, canChange, dispose:() => {generation++;} };
}

const CategoryList = defineComponent({
  name: "CategoryList",
  setup() {
    const api=useApi(), router=useRouter();
    const rows=ref([]), loading=ref(true), error=ref(""), page=ref(1), search=ref(""), sort=ref("updated_at"), descending=ref(true), filters=ref({}), total=ref(null), canCreate=ref(false);
    const parentSearch=ref(""), parentPage=ref(1), parents=ref([]), parentError=ref(""), parentLoading=ref(false);
    let request=0, parentRequest=0, timer;
    async function load() {
      const seq=++request; loading.value=true; error.value="";
      try {
        const r=await api.get("/items/categories",{params:buildCategoriesQuery({page:page.value,search:search.value,sort:`${descending.value?"-":""}${sort.value||"updated_at"}`,filters:filters.value})});
        if(seq!==request)return; rows.value=data(r); total.value=Number.isFinite(r.data.meta?.filter_count)?r.data.meta.filter_count:null;
      } catch(e) { if(seq===request){rows.value=[];error.value=errorText(e);} } finally {if(seq===request)loading.value=false;}
    }
    async function loadParents() {
      const seq=++parentRequest; parentLoading.value=true; parentError.value="";
      try { const r=await api.get("/items/categories",{params:buildCollectionQuery({fields:["id","title"],page:parentPage.value,sort:"title,id",filter:parentSearch.value.trim()?{title:{_icontains:parentSearch.value.trim()}}:undefined})}); if(seq===parentRequest)parents.value=data(r); }
      catch(e){if(seq===parentRequest){parents.value=[];parentError.value=errorText(e);}} finally {if(seq===parentRequest)parentLoading.value=false;}
    }
    const reset=() => {page.value=1;load();};
    const boolOptions=[{value:"true",label:"Да"},{value:"false",label:"Нет"}];
    const columns=[{field:"title",label:"Название категории",sortable:true},{field:"slug",label:"Slug",sortable:true},{field:"parent",label:"Родительская категория",sortable:true},{field:"status",label:"Статус",sortable:true,filterOptions:Object.entries(STATUS).map(([value,label])=>({value,label}))},{field:"show_on_homepage",label:"Показывать на главной",sortable:true,filterOptions:boolOptions},{field:"sort_order",label:"Порядок",sortable:true},{field:"updated_at",label:"Дата изменения",sortable:true}];
    api.get("/permissions/me").then(r=>{const p=categoryPermissions(data(r));canCreate.value=["title","slug","status"].every(f=>has(p.create,f));}).catch(()=>{});
    load();loadParents();onUnmounted(()=>{request++;parentRequest++;clearTimeout(timer);});
    return () => h(AdminShell,{title:"Категории",readonly:true,state:{loading:loading.value}}, {
      toolbar:()=>h("div",{class:"ac-toolbar__actions"},[h("button",{type:"button",onClick:()=>router.push("/product-editor")},"Товары"),canCreate.value?h("button",{type:"button",onClick:()=>router.push("/product-editor/sections/categories/+")},"Создать категорию"):h("span","Создание недоступно по текущим правам.")]),
      default:()=>[h("style",categoryStyle),h("div",{class:"category-filters"},[
        h("label",["Индексация",h("select",{"aria-label":"Индексация",value:filters.value.is_indexable??"",onChange:e=>{filters.value={...filters.value,is_indexable:e.target.value};reset();}},[h("option",{value:""},"Все"),...boolOptions.map(o=>h("option",{value:o.value},o.label))])]),
        h("label",["Направление сортировки",h("select",{"aria-label":"Направление сортировки",value:descending.value?"desc":"asc",onChange:e=>{descending.value=e.target.value==="desc";reset();}},[h("option",{value:"asc"},"По возрастанию"),h("option",{value:"desc"},"По убыванию")])]),
        h("fieldset",[h("legend","Родительская категория"),h("form",{onSubmit:e=>{e.preventDefault();parentPage.value=1;loadParents();}},[h("input",{type:"search","aria-label":"Поиск родительской категории",value:parentSearch.value,onInput:e=>parentSearch.value=e.target.value}),h("button",{type:"submit",disabled:parentLoading.value},"Найти родителя")]),
          h("select",{"aria-label":"Фильтр: Родительская категория",value:filters.value.parent??"",disabled:parentLoading.value,onChange:e=>{filters.value={...filters.value,parent:e.target.value};reset();}},[h("option",{value:""},"Все родители"),h("option",{value:"__root__"},"Без родителя"),filters.value.parent&&!parents.value.some(p=>p.id===filters.value.parent)&&filters.value.parent!=="__root__"?h("option",{value:filters.value.parent},"Выбранный родитель"):null,...parents.value.map(p=>h("option",{value:p.id},p.title??p.id))]),
          h("div",[h("button",{type:"button",disabled:parentPage.value===1||parentLoading.value,onClick:()=>{parentPage.value--;loadParents();}},"Родители: назад"),h("span",` ${parentPage.value} `),h("button",{type:"button",disabled:parents.value.length<25||parentLoading.value,onClick:()=>{parentPage.value++;loadParents();}},"Родители: дальше")]),parentError.value?h("p",{role:"alert"},[parentError.value,h("button",{onClick:loadParents},"Повторить родителей")]):null]),
      ]),h(CollectionList,{rows:rows.value.map(r=>({...r,parent:r.parent&&typeof r.parent==="object"?r.parent.title??"Связанная категория недоступна":r.parent??null,status:STATUS[r.status]??r.status,show_on_homepage:r.show_on_homepage==null?"—":r.show_on_homepage?"Да":"Нет",updated_at:r.updated_at?new Date(r.updated_at).toLocaleString("ru-RU"):null})),columns,page:page.value,pageSize:25,total:total.value,loading:loading.value,error:error.value,search:search.value,sort:sort.value,filters:filters.value,
        "onUpdate:page":v=>{page.value=v;load();},"onUpdate:search":v=>{search.value=v;page.value=1;clearTimeout(timer);request++;timer=setTimeout(load,250);},"onUpdate:sort":v=>{sort.value=v||"updated_at";reset();},"onUpdate:filters":v=>{filters.value=v;reset();},onRetry:load,onSelect:r=>router.push(`/product-editor/sections/categories/${encodeURIComponent(r.id)}`)})],
    });
  },
});

const CategoryEditor=defineComponent({
  name:"CategoryEditor",props:{id:{type:[String,Number],required:true}},
  setup(props) {
    const api=useApi(),router=useRouter(),controller=createCategoryController(api),revision=ref(0),active=ref("main"),notice=ref(""),assetErrors=ref({});
    const snapshot=computed(()=>{revision.value;return controller.snapshot();});
    let assetRequest=0;
    watch(()=>MEDIA.map(f=>unwrapId(snapshot.value.values[f])).join(","),async()=>{
      const seq=++assetRequest, next={};
      await Promise.all(MEDIA.map(async field=>{const id=unwrapId(snapshot.value.values[field]);if(!id)return;try{await api.get(`/files/${encodeURIComponent(id)}`,{params:{fields:"id"}});}catch{next[field]=true;}}));
      if(seq===assetRequest)assetErrors.value=next;
    });
    async function run(fn){const pending=fn();revision.value++;try{return await pending;}finally{revision.value++;}}
    watch(()=>props.id,id=>{notice.value="";active.value="main";run(()=>controller.open(id));},{immediate:true});
    onUnmounted(()=>{assetRequest++;controller.dispose();});
    const change=(f,v)=>{controller.change(f,v);revision.value++;};
    const save=async()=>{notice.value="";const result=await run(()=>controller.save());if(result.error)notice.value=errorText(result.error);if(result.createdId)router.replace(`/product-editor/sections/categories/${encodeURIComponent(result.createdId)}`);};
    const compare=async()=>{const r=await run(()=>controller.compare());if(r.error)notice.value=errorText(r.error);};
    const recoverCreate=async()=>{const r=await run(()=>controller.recoverCreate());if(r.error)notice.value=errorText(r.error);};
    return()=>{
      const s=snapshot.value, writable=s.permissions.update;
      const nativePermissions={read:s.permissions.read,update:s.creating?s.permissions.create:writable};
      const delta=Object.fromEntries(Object.keys(s.values).filter(f=>!same(s.values[f],s.baseline[f])).map(f=>[f,s.values[f]]));
      const form=(fields)=>h(NativeFieldGroup,{metadata:s.metadata.map(m=>m.field==="parent"||s.creating&&m.field==="status"?{...m,meta:{...m.meta,readonly:true,options:{...m.meta?.options,enableCreate:false,enableSelect:false}}}:m),fieldSubset:fields,primaryKey:props.id,initialValues:s.baseline,modelValue:delta,permissions:nativePermissions,readonly:s.readonly,disabled:s.loading||s.saving||s.writeUncertain,validationErrors:s.validation,"onUpdate:modelValue":v=>{controller.changeTab(fields,v);revision.value++;}});
      const media=field=>{const metadata=s.metadata.find(m=>m.field===field);if(!metadata||!has(s.permissions.read,field))return null;return h("div",[assetErrors.value[field]?h("p",{role:"status"},"Связанный файл отсутствует или недоступен. Связь сохранена до вашего явного изменения."):null,h(MediaPicker,{field:{...metadata,meta:{...metadata.meta,interface:"file-image",options:{...metadata.meta?.options}}},primaryKey:props.id,initialValue:{[field]:s.baseline[field]},modelValue:s.values[field],permissions:nativePermissions,readonly:s.readonly||!controller.canChange(field),disabled:s.loading||s.saving||s.writeUncertain,allowSelect:["full","partial"].includes(s.filePermissions.read?.access),allowUpload:s.filePermissions.create?.access==="full","onUpdate:modelValue":v=>change(field,v)})]);};
      const title=s.creating?"Новая категория":s.values.title||"Категория";
      return h(AdminShell,{title,state:{...s,readError:s.readError?true:null,saveError:s.saveError?errorText(s.saveError):null},readonly:s.readonly,onRetry:()=>{if(!s.dirty)run(()=>controller.open(props.id));else compare();}}, {
        toolbar:()=>h(EditorToolbar,{title:"Категории",state:s,readonly:s.readonly,onSave:save,onBack:()=>router.push("/product-editor/sections/categories"),onReconcile:compare}),
        default:()=>[h("style",categoryStyle),notice.value?h("p",{role:"alert"},notice.value):null,s.readError?h("p",{role:"alert"},errorText(s.readError)):null,
          s.writeUncertain&&!s.conflict&&!s.creating?h("button",{type:"button",disabled:s.saving,onClick:compare},"Сравнить с актуальными данными"):null,
          s.writeUncertain&&s.creating?h("section",{class:"category-comparison"},[h("p","Ответ создания не подтверждён. Повторная отправка заблокирована. Проверьте запись по точному slug."),h("button",{type:"button",disabled:s.saving,onClick:recoverCreate},"Проверить результат создания"),
            s.createRecovery?s.createRecovery.record?h("div",[h("p","Найдена запись с этим slug. Это не подтверждает, что она создана вашим запросом. Сравните данные перед переходом; локальный ввод остаётся в этой форме."),h(ReadonlyDetails,{values:s.createRecovery.record,fields:Object.keys(s.createRecovery.record).map(field=>({field,label:s.metadata.find(m=>m.field===field)?.name??field}))}),h("button",{type:"button",disabled:s.saving,onClick:()=>router.push(`/product-editor/sections/categories/${encodeURIComponent(s.createRecovery.record.id)}`)},"Открыть найденную категорию")]):h("p",{role:"status"},"Запись пока не найдена. Проверьте связь и повторите проверку. Автоматическое создание отключено."):null]):null,
          s.comparison?h("section",{class:"category-comparison"},[h("h2","Сравнение перед повторным сохранением"),...s.dirtyFields.map(f=>h("div",[h("h3",f),h(ReadonlyDetails,{values:{local:s.values[f],current:s.comparison[f]},fields:[{field:"local",label:"Ваше значение"},{field:"current",label:"На сервере"}]})])),h("button",{type:"button",disabled:s.saving,onClick:()=>run(()=>controller.reconcile(true))},"Применить актуальную версию и оставить мой ввод"),h("button",{type:"button",disabled:s.saving,onClick:()=>{if(!s.dirty||window.confirm("Отбросить введённые изменения?"))run(()=>controller.reconcile(false));}},"Отбросить мой ввод и загрузить актуальное"),h("p","Эти действия не записывают данные. После проверки нажмите «Сохранить» отдельно.")]):null,
          s.validation.length?h("ul",{role:"alert"},s.validation.map(e=>h("li",e.message))):null,
          !s.loading&&Object.keys(s.values).length?h(SectionTabs,{tabs:CATEGORY_TABS,modelValue:active.value,"onUpdate:modelValue":v=>active.value=v},{default:({tab})=>[
            tab.id==="main"?h("p",{class:"category-note"},"Родитель доступен только для просмотра: серверная защита от циклов дерева не подтверждена."):null,
            tab.id==="main"&&s.creating?h("p",{class:"category-note"},"Новая категория создаётся черновиком. Публикация доступна после создания."):null,
            ["main","seo"].includes(tab.id)?h("p",{class:"category-note",role:"note"},"Slug, статус, перенаправление и индексация влияют на адреса, видимость и поиск на сайте. Проверьте значения перед сохранением."):null,
            s.dirtyFields.some(f=>EFFECTS.includes(f))?h("p",{role:"status"},"Изменены поля, влияющие на сайт."):null,
            form(tab.fields.filter(f=>!MEDIA.includes(f)&&!TECHNICAL.has(f))),
            tab.id==="other"?h(ReadonlyDetails,{values:s.values,fields:[{field:"id",label:"Идентификатор"},{field:"created_at",label:"Создано"},{field:"updated_at",label:"Обновлено"}].filter(f=>has(s.permissions.read,f.field))}):null,
            tab.id==="seo"?media("og_image"):null,
          ]}):null],
        ...(!s.loading&&active.value==="main"?{context:()=>[media("image"),media("icon"),h("p",{class:"category-note"},"Убирается только связь с изображением; файл остаётся в Directus.")]}:{}),
      });
    };
  },
});

export const CategoriesSection=defineComponent({name:"CategoriesSection",props:{id:{type:[String,Number],default:null}},setup:props=>()=>props.id==null||props.id===""?h(CategoryList):h(CategoryEditor,{id:props.id})});
export default CategoriesSection;

const categoryStyle=`.category-filters{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:20px}.category-filters label{display:grid;gap:4px}.category-filters fieldset{min-width:0;max-width:100%;padding:8px;border:1px solid var(--theme--border-color)}.category-filters form{display:flex;flex-wrap:wrap;gap:8px}.category-filters select,.category-filters input{max-width:100%;border:1px solid var(--theme--border-color);padding:8px;border-radius:6px}.category-filters button,.category-comparison button{min-height:40px;padding:8px 12px;border:1px solid var(--theme--border-color);border-radius:6px}.category-note{color:var(--theme--foreground-subdued);margin:12px 0;overflow-wrap:anywhere}.category-comparison{max-width:100%;overflow-wrap:anywhere;border:1px solid var(--theme--border-color);padding:12px;margin:12px 0}.category-comparison button{margin:4px}.ac-list__controls{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}.ac-list__controls input,.ac-list__controls select{border:1px solid var(--theme--border-color);border-radius:6px;padding:8px;max-width:100%}.ac-shell__context>.field{margin-bottom:16px}.ac-shell .v-form{min-width:0}@media(max-width:720px){.category-filters{display:grid;grid-template-columns:minmax(0,1fr)}.category-filters input,.category-filters select{width:100%}.category-filters form input{min-width:0;flex:1 1 160px}.ac-tabs [role=tabpanel]{min-width:0}.ac-shell__context{max-width:100%}}`;
