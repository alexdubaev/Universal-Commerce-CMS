import { useApi } from "@directus/extensions-sdk";
import { defineComponent, h, ref, computed, watch, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { AdminShell, SectionTabs, EditorToolbar, NativeFieldGroup, CollectionList, MediaPicker, ReadonlyDetails, buildCollectionQuery } from "../admin-shell.js";
import { createEditorState } from "../admin-state.mjs";

export const CATEGORY_TABS = [
  { id: "main", label: "Основное", fields: ["title","slug","status","parent","description","image_alt","icon_alt","sort_order","show_on_homepage","image","icon"] },
  { id: "content", label: "Содержание", fields: ["h1","intro","seo_text","selection_guide","internal_links","faq"] },
  { id: "seo", label: "SEO", fields: ["seo_title","seo_description","og_image","is_indexable","seo","redirect_target"] },
  { id: "other", label: "Дополнительно", fields: ["translations","id","created_at","updated_at"] },
];
const ALL = CATEGORY_TABS.flatMap(t => t.fields);
const TECHNICAL = new Set(["id","created_at","updated_at"]);
const EDITABLE = ALL.filter(f => !TECHNICAL.has(f) && f !== "parent");
const MEDIA = ["image","icon","og_image"];
const HALF_WIDTH_FIELDS = new Set(["title","slug","status","parent","image_alt","icon_alt","sort_order","show_on_homepage"]);
const comparisonValue = (field, value) => MEDIA.includes(field) ? value == null || value === "" ? null : "Файл выбран" : value;
const EFFECTS = ["slug","status","redirect_target","is_indexable","seo"];
const STATUS = { draft: "Черновик", published: "Опубликована", archived: "Архив" };
const LIST_FIELDS = ["id","title","slug","parent.id","parent.title","status","show_on_homepage","sort_order","updated_at"];
const SORTS = ["title","slug","parent","status","show_on_homepage","sort_order","updated_at"];
const copy = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
const same = (a,b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const data = r => r?.data?.data;
const has = (p,f) => p === true || Array.isArray(p) && (p.includes("*") || p.includes(f));
const unwrapId = x => x && typeof x === "object" ? x.id ?? null : x;
export function categorySeoPreview(values = {}, dirty = {}, readable = []) {
  const canRead = field => has(readable,field);
  const projected = (scalar, jsonKey) => {
    if (canRead(scalar) && dirty[scalar]) return typeof values[scalar] === "string" && values[scalar].trim() ? values[scalar].trim() : null;
    if (canRead(scalar) && typeof values[scalar] === "string" && values[scalar].trim()) return values[scalar].trim();
    return canRead("seo") && typeof values.seo?.[jsonKey] === "string" && values.seo[jsonKey].trim() ? values.seo[jsonKey].trim() : null;
  };
  return { title:projected("seo_title","title"), description:projected("seo_description","meta_description") };
}
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
  async function discardChanges() {
    if (busy || opening || !snapshot().dirty) return { ok: false, reason: "unavailable" };
    if (creating) { draft = copy(defaults); validation = []; comparison = null; createSaved = false; return { ok: true }; }
    if (!state) return { ok: false, reason: "unavailable" };
    busy = true;
    try {
      const result = await state.reconcile(loader, identity, { keepEdits: false });
      if (result.ok) { comparison = null; validation = []; }
      return result;
    } finally { busy = false; }
  }
  return { open, change, changeTab, save, compare, reconcile, discardChanges, recoverCreate, snapshot, canChange, dispose:() => {generation++;} };
}

const categoryIcon = (name) => h("svg", { viewBox:"0 0 24 24", "aria-hidden":"true", focusable:"false" }, [
  name==="search" ? h("circle",{cx:10.5,cy:10.5,r:6.5}) : null,
  h("path", { d: ({search:"m16 16 4.5 4.5",plus:"M12 5v14M5 12h14",down:"m6 9 6 6 6-6",chevron:"m9 5 7 7-7 7",close:"m6 6 12 12M6 18 18 6",check:"m5 12 4 4 10-10",filter:"M4 7h16M4 17h16"})[name] }),
  name==="filter" ? h("circle",{cx:9,cy:7,r:2.5,fill:"currentColor"}) : null,
  name==="filter" ? h("circle",{cx:15,cy:17,r:2.5,fill:"currentColor"}) : null,
]);

const CategoryList = defineComponent({
  name: "CategoryList",
  setup() {
    const api=useApi(), router=useRouter();
    const rows=ref([]), loading=ref(true), error=ref(""), page=ref(1), search=ref(""), sort=ref("-updated_at"), filters=ref({}), total=ref(null);
    const canCreate=ref(false), permissionReady=ref(false), permissionError=ref(false);
    const dialog=ref(null), opener=ref(null), parentInput=ref(null), parentMenu=ref(false), draft=ref({});
    const parentSearch=ref(""), parentPage=ref(1), parents=ref([]), parentError=ref(""), parentLoading=ref(false), parentLabel=ref("");
    let request=0, parentRequest=0, timer, parentTimer, live=true;
    const columns=[{field:"title",label:"Название и адрес"},{field:"parent",label:"Родительская категория"},{field:"status",label:"Статус"},{field:"show_on_homepage",label:"На главной"},{field:"sort_order",label:"Порядок"},{field:"updated_at",label:"Изменено"},{field:"open",label:"Открыть"}];
    const sortOptions=[["-updated_at","Изменённые недавно"],["updated_at","Изменённые давно"],["title","Название: А–Я"],["-title","Название: Я–А"],["slug","Адрес: А–Я"],["-slug","Адрес: Я–А"],["parent","Родитель: А–Я"],["-parent","Родитель: Я–А"],["status","Статус: А–Я"],["-status","Статус: Я–А"],["show_on_homepage","На главной: сначала нет"],["-show_on_homepage","На главной: сначала да"],["sort_order","Порядок: по возрастанию"],["-sort_order","Порядок: по убыванию"]];
    async function load() {
      const seq=++request; loading.value=true; error.value="";
      try {
        const r=await api.get("/items/categories",{params:buildCategoriesQuery({page:page.value,search:search.value,sort:sort.value,filters:filters.value})});
        if(seq!==request||!live)return;
        rows.value=data(r); total.value=Number.isFinite(r.data.meta?.filter_count)?r.data.meta.filter_count:null;
      } catch(e) { if(seq===request&&live){rows.value=[];total.value=null;error.value=errorText(e);} }
      finally {if(seq===request&&live)loading.value=false;}
    }
    async function loadParents() {
      const seq=++parentRequest; parentLoading.value=true; parentError.value="";
      try {
        const r=await api.get("/items/categories",{params:buildCollectionQuery({fields:["id","title"],page:parentPage.value,sort:"title,id",filter:parentSearch.value.trim()?{title:{_icontains:parentSearch.value.trim()}}:undefined})});
        if(seq===parentRequest&&live&&parentMenu.value)parents.value=data(r);
      } catch(e){if(seq===parentRequest&&live){parents.value=[];parentError.value=errorText(e);}}
      finally {if(seq===parentRequest&&live)parentLoading.value=false;}
    }
    const reset=()=>{clearTimeout(timer);page.value=1;load();};
    const resetAll=()=>{filters.value={};search.value="";parentLabel.value="";reset();};
    const selectPage=value=>{page.value=value;load();};
    const edit=row=>router.push(`/product-editor/sections/categories/${encodeURIComponent(row.id)}`);
    const parentText=row=>row.parent&&typeof row.parent==="object"?row.parent.title??"Связанная категория недоступна":row.parent?"Связанная категория недоступна":"—";
    const chosenParent=()=>draft.value.parent==="__root__"?"Без родителя":draft.value.parent?draft.value.parentLabel||"Выбранная категория":"Все категории";
    function closeParent(){parentMenu.value=false;parentRequest++;clearTimeout(parentTimer);parentLoading.value=false;}
    function openFilters(){
      draft.value={...filters.value,parentLabel:parentLabel.value};parentSearch.value="";parentPage.value=1;closeParent();
      dialog.value?.showModal();
    }
    function closeFilters(){closeParent();dialog.value?.close();}
    function filterKeydown(event){
      if(event.key==="Escape"){event.preventDefault();event.stopPropagation();closeFilters();return;}
      if(event.key!=="Tab")return;
      event.stopPropagation();
      const panel=event.currentTarget,active=panel.ownerDocument.activeElement;
      const controls=[...panel.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length);
      const target=event.shiftKey&&active===controls[0]?controls.at(-1):!event.shiftKey&&active===controls.at(-1)?controls[0]:null;
      if(target){event.preventDefault();target.focus();}
    }
    function applyFilters(event){
      event.preventDefault();
      filters.value={...filters.value,parent:draft.value.parent||null,show_on_homepage:draft.value.show_on_homepage||null,is_indexable:draft.value.is_indexable||null};
      parentLabel.value=draft.value.parentLabel||"";closeFilters();reset();
    }
    function selectParent(value,label){draft.value={...draft.value,parent:value,parentLabel:label};closeParent();}
    const textValue=(value,className="")=>h("span",{class:`a1cat-full ${className}`,tabindex:0,title:value,"aria-label":value,"data-full-value":value},h("span",{class:"a1cat-clamp"},value));
    function cell({row,column}) {
      if(column.field==="title")return [
        h("a",{class:"a1cat-name",href:`/admin/product-editor/sections/categories/${encodeURIComponent(row.id)}`,title:row.title??"Без названия","aria-label":`${row.title??"Без названия"}; адрес: ${row.slug??"—"}`,onClick:e=>{e.stopPropagation();if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.defaultPrevented)return;e.preventDefault();edit(row);},onKeydown:e=>e.stopPropagation()},row.title??"Без названия"),
        textValue(row.slug??"—","a1cat-slug"),
      ];
      if(column.field==="parent")return h("span",{class:"a1cat-parent"},[h("span",{class:"a1cat-parent-prefix"},"Родитель: "),textValue(parentText(row))]);
      if(column.field==="status")return h("span",{class:`a1cat-badge a1cat-badge--${["draft","published","archived"].includes(row.status)?row.status:"other"}`},STATUS[row.status]??row.status??"—");
      if(column.field==="show_on_homepage")return row.show_on_homepage==null?"—":row.show_on_homepage?h("span",{class:"a1cat-yes"},[categoryIcon("check"),"Да"]):h("span",{class:"a1cat-muted"},"Нет");
      if(column.field==="updated_at"){
        if(!row.updated_at)return "—";
        const date=new Date(row.updated_at);
        return h("time",{class:"a1cat-date",datetime:row.updated_at},[date.toLocaleDateString("ru-RU"),h("small",date.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}))]);
      }
      if(column.field==="open")return categoryIcon("chevron");
      return row[column.field]==null?"—":String(row[column.field]);
    }
    const filterChips=()=>{
      const labels={parent:`Родитель: ${filters.value.parent==="__root__"?"без родителя":parentLabel.value||"выбранная категория"}`,show_on_homepage:`На главной: ${filters.value.show_on_homepage==="true"?"да":"нет"}`,is_indexable:`Индексация: ${filters.value.is_indexable==="true"?"разрешена":"запрещена"}`};
      const active=["parent","show_on_homepage","is_indexable"].filter(f=>filters.value[f]);
      return active.length?h("div",{class:"a1cat-chips"},[...active.map(f=>h("button",{type:"button",class:"a1cat-chip","aria-label":`Убрать фильтр ${labels[f]}`,title:labels[f],onClick:()=>{filters.value={...filters.value,[f]:null};reset();}},[h("span",labels[f]),categoryIcon("close")])),h("button",{type:"button",class:"a1cat-reset",onClick:resetAll},"Сбросить фильтры")]):null;
    };
    const controls=()=>h("div",[
      h("form",{class:"a1cat-controls",onSubmit:e=>{e.preventDefault();reset();}},[
        h("label",{class:"a1cat-search"},[categoryIcon("search"),h("input",{type:"search",value:search.value,"aria-label":"Поиск категорий",placeholder:"Поиск по названию, адресу или H1",onInput:e=>{search.value=e.target.value;page.value=1;clearTimeout(timer);request++;timer=setTimeout(load,250);}})]),
        h("select",{class:"a1cat-control a1cat-status","aria-label":"Статус",value:filters.value.status??"",onChange:e=>{filters.value={...filters.value,status:e.target.value||null};reset();}},[h("option",{value:""},"Все статусы"),h("option",{value:"published"},"Опубликованные"),h("option",{value:"draft"},"Черновики"),h("option",{value:"archived"},"В архиве")]),
        h("button",{ref:opener,type:"button",class:"a1cat-btn","aria-haspopup":"dialog",onClick:openFilters},[categoryIcon("filter"),"Фильтры",...(["parent","show_on_homepage","is_indexable"].some(f=>filters.value[f])?[h("span",{class:"a1cat-filter-count"},String(["parent","show_on_homepage","is_indexable"].filter(f=>filters.value[f]).length))]:[])]),
        h("select",{class:"a1cat-control a1cat-sort","aria-label":"Сортировка",value:sort.value,onChange:e=>{sort.value=e.target.value;reset();}},sortOptions.map(([value,label])=>h("option",{value},label))),
      ]),filterChips(),
    ]);
    const booleanField=(field,label,all,yes,no)=>h("label",{class:"a1cat-field"},[h("span",label),h("select",{class:"a1cat-control","aria-label":label,value:draft.value[field]??"",onChange:e=>draft.value={...draft.value,[field]:e.target.value}},[h("option",{value:""},all),h("option",{value:"true"},yes),h("option",{value:"false"},no)])]);
    const filterDialog=()=>h("dialog",{ref:dialog,class:"a1cat-dialog","aria-labelledby":"a1cat-filters-title",onKeydown:filterKeydown,onCancel:e=>{e.preventDefault();closeFilters();},onClose:()=>{closeParent();opener.value?.focus();}},[
      h("div",{class:"a1cat-dialog-head"},[h("h2",{id:"a1cat-filters-title"},"Фильтры категорий"),h("button",{type:"button",class:"a1cat-icon-btn","aria-label":"Закрыть фильтры",onClick:closeFilters},categoryIcon("close"))]),
      h("form",{onSubmit:applyFilters},[
        h("div",{class:"a1cat-dialog-body"},[
          h("div",{class:"a1cat-field"},[h("span",{id:"a1cat-parent-label"},"Родительская категория"),
            h("button",{type:"button",class:"a1cat-btn a1cat-parent-trigger","aria-labelledby":"a1cat-parent-label a1cat-parent-value","aria-expanded":String(parentMenu.value),onClick:()=>{if(parentMenu.value)closeParent();else{parentMenu.value=true;parentPage.value=1;loadParents();Promise.resolve().then(()=>parentInput.value?.focus());}}},[h("span",{id:"a1cat-parent-value"},chosenParent()),categoryIcon("down")]),
            parentMenu.value?h("div",{class:"a1cat-parent-menu"},[
              h("label",{class:"a1cat-search"},[categoryIcon("search"),h("input",{ref:parentInput,type:"search","aria-label":"Найти родительскую категорию",placeholder:"Найти категорию",value:parentSearch.value,onInput:e=>{parentSearch.value=e.target.value;parentPage.value=1;parentRequest++;clearTimeout(parentTimer);parentTimer=setTimeout(loadParents,250);}})]),
              h("div",{class:"a1cat-parent-options"},[h("button",{type:"button",class:"a1cat-parent-option",onClick:()=>selectParent("","")},"Все категории"),h("button",{type:"button",class:"a1cat-parent-option",onClick:()=>selectParent("__root__","Без родителя")},"Без родителя"),
                parentLoading.value?h("p",{role:"status"},"Загрузка категорий…"):parentError.value?h("p",{role:"alert"},[parentError.value,h("button",{type:"button",class:"a1cat-btn",onClick:loadParents},"Повторить")]):parents.value.length?parents.value.map(p=>h("button",{type:"button",class:"a1cat-parent-option",title:p.title??p.id,onClick:()=>selectParent(p.id,p.title??"Без названия")},p.title??"Без названия")):h("p",{role:"status"},"Ничего не найдено"),
              ]),
              h("div",{class:"a1cat-parent-pages"},[parentPage.value>1?h("button",{type:"button",class:"a1cat-btn a1cat-quiet",disabled:parentLoading.value,onClick:()=>{parentPage.value--;loadParents();}},"Назад"):null,h("button",{type:"button",class:"a1cat-btn a1cat-quiet",disabled:parentLoading.value||parents.value.length<25,onClick:()=>{parentPage.value++;loadParents();}},"Показать ещё")]),
            ]):null,
          ]),
          booleanField("show_on_homepage","На главной странице","Все категории","Показываются","Не показываются"),
          booleanField("is_indexable","Индексация","Любая","Разрешена","Запрещена"),
        ]),
        h("div",{class:"a1cat-dialog-foot"},[h("button",{type:"button",class:"a1cat-btn a1cat-quiet",onClick:()=>{draft.value={};closeParent();}},"Сбросить"),h("button",{type:"submit",class:"a1cat-btn a1cat-primary"},"Применить")]),
      ]),
    ]);
    api.get("/permissions/me").then(r=>{if(live){const p=categoryPermissions(data(r));canCreate.value=["title","slug","status"].every(f=>has(p.create,f));permissionReady.value=true;}}).catch(()=>{if(live)permissionError.value=true;});
    load();
    onUnmounted(()=>{live=false;request++;closeParent();clearTimeout(timer);dialog.value?.close();});
    return ()=>h(AdminShell,{class:"a1cat-list",mode:"list",title:"Категории",readonly:true}, {
      heading:()=>h("div",{class:"a1cat-title"},[h("h1","Категории"),total.value!=null?h("span",{class:"a1cat-total","aria-label":"Количество результатов"},String(total.value)):null]),
      toolbar:()=>canCreate.value?h("button",{type:"button",class:"a1cat-btn a1cat-primary","aria-label":"Создать категорию",onClick:()=>router.push("/product-editor/sections/categories/+")},[categoryIcon("plus"),h("span",{class:"a1cat-create-desktop"},"Создать категорию"),h("span",{class:"a1cat-create-mobile"},"Создать")]):null,
      default:()=>[h("style",categoryListStyle),
        permissionReady.value&&!canCreate.value?h("p",{class:"a1cat-permission",role:"status"},"Создание категорий недоступно по текущим правам."):permissionError.value?h("p",{class:"a1cat-permission",role:"status"},"Не удалось проверить право создания категорий. Повторите загрузку страницы."):null,
        h(CollectionList,{rows:rows.value,columns,page:page.value,pageSize:25,total:total.value,loading:loading.value,error:error.value,onSelect:edit,onRetry:load,"onUpdate:page":selectPage},{
          controls,cell,
          loading:()=>h("div",{class:"a1cat-empty",role:"status"},"Загрузка категорий…"),
          empty:()=>h("div",{class:"a1cat-empty",role:"status"},[h("h2","Категории не найдены"),h("p","Измените запрос или сбросьте фильтры."),h("button",{type:"button",class:"a1cat-btn",onClick:resetAll},"Сбросить фильтры")]),
          error:()=>h("div",{class:"a1cat-empty",role:"alert"},[h("h2","Не удалось загрузить категории"),h("p",error.value),h("button",{type:"button",class:"a1cat-btn",onClick:load},"Повторить")]),
          pagination:({nextEnabled})=>h("nav",{class:"a1cat-pagination","aria-label":"Страницы списка"},[
            h("span",{"aria-live":"polite"},loading.value?"Загрузка…":rows.value.length?`${(page.value-1)*25+1}–${(page.value-1)*25+rows.value.length}${total.value==null?"":` из ${total.value}`}`:"Нет результатов"),
            h("div",{class:"a1cat-pager"},[h("button",{type:"button",class:"a1cat-icon-btn",disabled:page.value===1||loading.value,"aria-label":"Предыдущая страница",onClick:()=>selectPage(page.value-1)},h("span",{class:"a1cat-prev"},categoryIcon("chevron"))),h("span",total.value==null?`Страница ${page.value}`:`${page.value} / ${Math.max(1,Math.ceil(total.value/25))}`),h("button",{type:"button",class:"a1cat-icon-btn",disabled:!nextEnabled||loading.value||Boolean(error.value),"aria-label":"Следующая страница",onClick:()=>selectPage(page.value+1)},categoryIcon("chevron"))]),
          ]),
        }),filterDialog(),
      ],
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
    const save=async()=>{notice.value="";const result=await run(()=>controller.save());if(result.error&&!result.conflict)notice.value="Не удалось сохранить категорию. Проверьте данные и повторите попытку.";if(result.createdId)router.replace(`/product-editor/sections/categories/${encodeURIComponent(result.createdId)}`);};
    const compare=async()=>{const r=await run(()=>controller.compare());if(r.error)notice.value="Не удалось сравнить данные. Ваши правки остались в форме.";};
    const recoverCreate=async()=>{const r=await run(()=>controller.recoverCreate());if(r.error)notice.value=errorText(r.error);};
    return()=>{
      const s=snapshot.value, writable=s.permissions.update;
      const nativePermissions={read:s.permissions.read,update:s.creating?s.permissions.create:writable};
      const delta=Object.fromEntries(Object.keys(s.values).filter(f=>!same(s.values[f],s.baseline[f])).map(f=>[f,s.values[f]]));
      const seoPreview=categorySeoPreview(s.values,Object.fromEntries(s.dirtyFields.map(field=>[field,true])),s.permissions.read);
      const seoPreviewReadable=has(s.permissions.read,"seo_title")||has(s.permissions.read,"seo"),seoDescriptionReadable=has(s.permissions.read,"seo_description")||has(s.permissions.read,"seo");
      const form=(fields)=>{
        const editableFields=fields.filter(f=>!MEDIA.includes(f)&&!TECHNICAL.has(f));
        const metadata=s.metadata.map(m=>{
          const parent=m.field==="parent",locked=parent||s.creating&&m.field==="status";
          return {...m,name:parent?`${m.name} (только просмотр)`:m.name,meta:{...m.meta,...(HALF_WIDTH_FIELDS.has(m.field)?{width:"half"}:{}),...(locked?{readonly:true,options:{...m.meta?.options,enableCreate:false,enableSelect:false}}:{})}};
        });
        return h(NativeFieldGroup,{metadata,fieldSubset:editableFields,primaryKey:props.id,initialValues:s.baseline,modelValue:delta,permissions:nativePermissions,readonly:s.readonly,disabled:s.loading||s.saving||s.writeUncertain,validationErrors:s.validation,"onUpdate:modelValue":v=>{controller.changeTab(editableFields,v);revision.value++;}});
      };
      const media=field=>{const metadata=s.metadata.find(m=>m.field===field);if(!metadata||!has(s.permissions.read,field))return null;const selected=Boolean(unwrapId(s.values[field]));return h("div",{class:"category-media-field"},[assetErrors.value[field]?h("p",{role:"status"},"Связанный файл недоступен. Связь сохранена до вашего явного изменения."):null,h(MediaPicker,{field:{...metadata,name:field==="og_image"?"Изображение для ссылок":metadata.name,meta:{...metadata.meta,interface:"file-image",options:{...metadata.meta?.options}}},primaryKey:props.id,initialValue:{[field]:s.baseline[field]},modelValue:s.values[field],permissions:nativePermissions,readonly:s.readonly||!controller.canChange(field),disabled:s.loading||s.saving||s.writeUncertain,allowSelect:["full","partial"].includes(s.filePermissions.read?.access),allowUpload:s.filePermissions.create?.access==="full","onUpdate:modelValue":v=>change(field,v)}),selected?h("p",{class:"category-media-note"},"Связь можно снять без удаления файла из Directus."):null]);};
      const title=s.creating?"Новая категория":s.values.title||"Категория";
      return h(AdminShell,{class:"a1cat-editor",title,state:{...s,readError:s.readError?true:null,saveError:s.saveError?true:null},readonly:s.readonly,cancelTitle:"Отменить изменения категории?",onCancel:()=>run(()=>controller.discardChanges()),onRetry:()=>{if(!s.dirty)run(()=>controller.open(props.id));else compare();}}, {
        toolbar:({requestCancel,requestDiscard})=>h(EditorToolbar,{title:"Категории",state:s,readonly:s.readonly,cancelLabel:"Отменить изменения",backLabel:"К списку категорий",onSave:save,onCancel:requestCancel,onReconcile:compare,onBack:()=>router.push("/product-editor/sections/categories")},{default:()=>s.comparison?h("button",{type:"button",disabled:s.saving,onClick:()=>requestDiscard().then(confirmed=>confirmed&&run(()=>controller.reconcile(false)))},"Отменить мои правки"):null}),
        default:()=>[h("style",categoryStyle),notice.value?h("p",{role:"alert"},notice.value):null,s.readError?h("p",{role:"alert"},errorText(s.readError)):null,
          s.writeUncertain&&s.creating?h("section",{class:"category-comparison"},[h("p","Ответ создания не подтверждён. Повторная отправка заблокирована. Проверьте запись по точному slug."),h("button",{type:"button",disabled:s.saving,onClick:recoverCreate},"Проверить результат создания"),
            s.createRecovery?s.createRecovery.record?h("div",[h("p","Найдена запись с этим slug. Это не подтверждает, что она создана вашим запросом. Сравните данные перед переходом; локальный ввод остаётся в этой форме."),h(ReadonlyDetails,{values:s.createRecovery.record,fields:Object.keys(s.createRecovery.record).map(field=>({field,label:s.metadata.find(m=>m.field===field)?.name??field}))}),h("button",{type:"button",disabled:s.saving,onClick:()=>router.push(`/product-editor/sections/categories/${encodeURIComponent(s.createRecovery.record.id)}`)},"Открыть найденную категорию")]):h("p",{role:"status"},"Запись пока не найдена. Проверьте связь и повторите проверку. Автоматическое создание отключено."):null]):null,
          s.comparison?h("section",{class:"category-comparison"},[h("h2","Сравнение изменений"),...s.dirtyFields.map(f=>h("div",[h("h3",s.metadata.find(item=>item.field===f)?.name??({title:"Название категории",slug:"Адрес категории",h1:"Заголовок страницы",seo_title:"SEO-заголовок"})[f]??"Значение"),h(ReadonlyDetails,{values:{local:comparisonValue(f,s.values[f]),current:comparisonValue(f,s.comparison[f])},fields:[{field:"local",label:"Ваш вариант"},{field:"current",label:"Сохранённый вариант"}]})])),h("button",{type:"button",disabled:s.saving,onClick:()=>run(()=>controller.reconcile(true))},"Оставить мои правки"),h("p","Ваш ввод сохранён в форме, но не записан. Проверьте форму и нажмите «Сохранить».")]):null,
          s.validation.length?h("ul",{role:"alert"},s.validation.map(e=>h("li",e.message))):null,
          !s.loading&&Object.keys(s.values).length?h(SectionTabs,{tabs:CATEGORY_TABS,modelValue:active.value,"onUpdate:modelValue":v=>active.value=v},{default:({tab})=>[
            tab.id==="main"&&s.creating?h("p",{class:"category-note"},"Новая категория создаётся черновиком. Публикация доступна после создания."):null,
            s.dirtyFields.some(f=>EFFECTS.includes(f))?h("p",{role:"status"},"Изменены поля, влияющие на сайт."):null,
            tab.id==="seo"?h("div",{class:"category-seo-layout"},[
              h("section",{class:"category-seo-fields"},[form(["seo_title","seo_description"])]),
              h("section",{class:"category-seo-preview", "aria-label":"Предпросмотр"},[
                h("h2","Предпросмотр в поиске"),
                seoPreview.title!==null?h("strong",seoPreview.title):null,
                seoPreview.description!==null?h("p",seoPreview.description):null,
                seoPreview.title===null&&seoPreview.description===null?h("p",seoPreviewReadable&&seoDescriptionReadable?"Заголовок и описание не заполнены.":"Предпросмотр недоступен."):null,
              ]),
              h("section",{class:"category-seo-settings"},[
                h("div",[form(["is_indexable"])]),
                h("div",[form(["redirect_target"])]),
                h("div",[media("og_image")]),
              ]),
            ]):form(tab.fields),
            tab.id==="other"?h(ReadonlyDetails,{values:s.values,fields:[{field:"id",label:"Идентификатор"},{field:"created_at",label:"Создано"},{field:"updated_at",label:"Обновлено"}].filter(f=>has(s.permissions.read,f.field))}):null,
          ]}):null],
        ...(!s.loading&&active.value==="main"?{context:()=>[media("image"),media("icon")]}:{}),
      });
    };
  },
});
const categoryListStyle = `
.a1cat-list{--cat-ink:var(--theme--foreground,#243448);--cat-muted:#68788b;--cat-line:var(--theme--border-color,#e2e7ee);--cat-bg:var(--theme--background,#fff);--cat-soft:var(--theme--background-subdued,#f7f9fc);--cat-accent:var(--theme--primary,#6644ff)}
.a1cat-list .ac-shell{max-width:none;padding:28px;container-type:inline-size;color:var(--cat-ink)}
.a1cat-list .ac-shell__header{margin-bottom:24px;gap:16px}.a1cat-list .ac-shell__grid{margin-top:0}
.a1cat-list .a1cat-title{display:flex;align-items:baseline;gap:12px}.a1cat-list .a1cat-title h1{font-size:28px;line-height:36px;letter-spacing:-.025em;font-weight:650;margin:0}.a1cat-total{font-size:14px;color:var(--cat-muted)}
.a1cat-list svg{width:18px;height:18px;flex:none;vertical-align:middle;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.a1cat-list button,.a1cat-list input,.a1cat-list select{font:inherit;color:inherit}.a1cat-list button{cursor:pointer}.a1cat-list button:disabled{cursor:default;opacity:.45}
.a1cat-list button:focus-visible,.a1cat-list a:focus-visible,.a1cat-list input:focus-visible,.a1cat-list select:focus-visible,.a1cat-list [tabindex]:focus-visible{outline:3px solid var(--cat-accent);outline-offset:3px}
.a1cat-list .a1cat-btn,.a1cat-list .a1cat-icon-btn{height:40px;min-height:40px;border:1px solid var(--cat-line);border-radius:7px;background:var(--cat-bg);display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 14px;font-size:14px;font-weight:500;white-space:nowrap}
.a1cat-list .a1cat-primary{color:#fff;background:var(--cat-accent);border-color:var(--cat-accent)}.a1cat-list .a1cat-btn:hover:not(:disabled){filter:brightness(.98)}.a1cat-create-mobile{display:none}
.a1cat-list .a1cat-controls{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.a1cat-list .a1cat-search{display:flex;align-items:center;gap:10px;min-width:280px;flex:1;border:1px solid var(--cat-line);border-radius:7px;padding:0 12px;height:40px;color:var(--cat-muted);background:var(--cat-bg)}
.a1cat-list .a1cat-search:focus-within{border-color:var(--cat-accent)}
.a1cat-list .a1cat-search input{height:38px;min-height:0;min-width:0;width:100%;padding:0;border:0;background:transparent;outline:none}
.a1cat-list .a1cat-search input::placeholder{color:var(--cat-muted);opacity:1}
.a1cat-list .a1cat-control{height:40px;min-height:40px;border:1px solid var(--cat-line);background-color:var(--cat-bg);border-radius:7px;padding:0 34px 0 12px;min-width:0;max-width:100%;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2368788b' stroke-width='1.7'%3E%3Cpath d='m7 10 5 5 5-5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;font-size:13px}
.a1cat-list .a1cat-status{width:166px;flex:none}.a1cat-list .a1cat-sort{width:208px;flex:none}
.a1cat-filter-count{background:var(--cat-soft);color:var(--cat-accent);min-width:20px;height:20px;border-radius:4px;font-size:12px;display:inline-flex;align-items:center;justify-content:center}
.a1cat-chips{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:-5px 0 18px}
.a1cat-list .a1cat-chip{display:inline-flex;align-items:center;gap:7px;max-width:100%;padding:5px 9px;background:var(--cat-soft);color:var(--cat-accent);border:1px solid var(--cat-line);border-radius:5px;font-size:12px}.a1cat-chip>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.a1cat-chip svg{width:12px;height:12px}
.a1cat-list .a1cat-reset{background:transparent;border:0;font-size:12px;color:var(--cat-muted);text-decoration:underline;padding:6px}
.a1cat-list .ac-list__scroll{overflow:visible;border-top:1px solid var(--cat-line);border-bottom:1px solid var(--cat-line)}.a1cat-list .ac-list table{table-layout:fixed}
.a1cat-list .ac-list thead{background:var(--cat-soft)}
.a1cat-list .ac-list th{font-size:12px;font-weight:500;line-height:18px;padding:12px;color:var(--cat-muted);border:0}
.a1cat-list .ac-list td{padding:12px;border:0;border-top:1px solid var(--cat-line);vertical-align:middle;font-size:13px;overflow-wrap:anywhere}
.a1cat-list .ac-list th:first-child,.a1cat-list .ac-list td:first-child{padding-left:16px}
.a1cat-list .ac-list th:nth-child(1){width:31%}.a1cat-list .ac-list th:nth-child(2){width:21%}.a1cat-list .ac-list th:nth-child(3){width:15%}.a1cat-list .ac-list th:nth-child(4){width:10%}.a1cat-list .ac-list th:nth-child(5){width:7%}.a1cat-list .ac-list th:nth-child(6){width:13%}.a1cat-list .ac-list th:nth-child(7){width:3%;font-size:0}
.a1cat-list .ac-list td:nth-child(5),.a1cat-list .ac-list th:nth-child(5){text-align:center;font-variant-numeric:tabular-nums}
.a1cat-list .ac-list td:last-child{color:var(--cat-muted);padding-left:0;padding-right:6px}.a1cat-list .ac-list td:last-child svg{width:14px}
.a1cat-list .ac-list tr:hover{background:var(--cat-soft)}
.a1cat-list .a1cat-name{font-size:14px;font-weight:560;line-height:20px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;text-decoration:none;color:var(--cat-ink)}
.a1cat-list .a1cat-name:hover{color:var(--cat-accent)}
.a1cat-full{display:block;position:relative;min-width:0;outline-offset:2px}.a1cat-clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:19px;overflow-wrap:anywhere}
.a1cat-full:focus-visible::after{content:attr(data-full-value);position:absolute;top:100%;left:0;z-index:5;background:var(--cat-bg);color:var(--cat-ink);border:1px solid var(--cat-line);padding:8px;border-radius:6px;width:max-content;max-width:min(320px,70vw);white-space:normal;overflow-wrap:anywhere;font-size:13px}
.a1cat-slug{margin-top:3px;font-size:12px;color:var(--cat-muted)}.a1cat-slug .a1cat-clamp{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.a1cat-parent-prefix{display:none}.a1cat-badge{display:inline-flex;gap:6px;align-items:center;font-size:12px;line-height:22px;padding:1px 8px;border-radius:4px;white-space:nowrap;background:#edf7f0;color:#248157}
.a1cat-badge::before{content:"";width:5px;height:5px;border-radius:50%;background:currentColor}.a1cat-badge--draft{background:#f2f4f7;color:#617185}.a1cat-badge--archived{background:#fff4e8;color:#9f672b}
.a1cat-yes{display:inline-flex;align-items:center;gap:5px}.a1cat-yes svg{width:14px;color:#698377}.a1cat-muted{color:var(--cat-muted)}
.a1cat-date{display:block;white-space:nowrap;font-size:12px;color:var(--cat-muted);font-variant-numeric:tabular-nums}.a1cat-date small{display:block;font-size:11px;margin-top:2px}
.a1cat-pagination{display:flex;align-items:center;justify-content:space-between;padding:16px 0;gap:12px;color:var(--cat-muted);font-size:12px}.a1cat-pager{display:flex;align-items:center;gap:10px}.a1cat-list .a1cat-pager .a1cat-icon-btn{height:36px;min-height:36px;width:36px;padding:0}.a1cat-prev{transform:rotate(180deg);display:flex}
.a1cat-empty{padding:62px 20px;text-align:center;border-block:1px solid var(--cat-line)}.a1cat-empty h2{margin:0 0 8px;font-size:17px}.a1cat-empty p{margin:0 0 20px;color:var(--cat-muted)}.a1cat-permission{padding:10px 0 18px;font-size:13px;color:var(--cat-muted)}
.a1cat-list .a1cat-dialog{padding:0;border:1px solid var(--cat-line);color:var(--cat-ink);background:var(--cat-bg);border-radius:12px;width:380px;max-width:calc(100vw - 32px);max-height:calc(100dvh - 32px);margin:16px 16px 16px auto;overflow:auto;position:fixed;inset:0;box-shadow:0 16px 70px #14233420}
.a1cat-dialog::backdrop{background:rgba(20,35,52,.25)}.a1cat-dialog:not([open]){display:none}.a1cat-dialog[open]{display:block}
.a1cat-dialog-head{display:flex;align-items:center;justify-content:space-between;padding:20px 22px;border-bottom:1px solid var(--cat-line)}.a1cat-dialog-head h2{margin:0;font-size:19px;font-weight:600}
.a1cat-list .a1cat-dialog-head .a1cat-icon-btn{border:0;width:32px;min-height:32px;height:32px;padding:0}.a1cat-dialog-body{padding:22px}
.a1cat-field{display:grid;gap:8px;margin-bottom:22px;font-size:13px}.a1cat-field>span{font-weight:550}.a1cat-field>.a1cat-control{width:100%}
.a1cat-list .a1cat-parent-trigger{width:100%;justify-content:space-between;font-weight:400;overflow:hidden;font-size:13px}.a1cat-parent-trigger>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.a1cat-parent-menu{border:1px solid var(--cat-line);border-radius:7px;background:var(--cat-bg);padding:8px}
.a1cat-list .a1cat-parent-menu .a1cat-search{height:38px;min-width:0;padding:0 10px}.a1cat-list .a1cat-parent-menu .a1cat-search input{height:36px;font-size:13px}
.a1cat-parent-options{max-height:178px;overflow:auto;margin-top:7px}.a1cat-list .a1cat-parent-option{border:0;display:block;width:100%;text-align:left;border-radius:4px;font-size:13px;padding:9px;background:var(--cat-bg);overflow-wrap:anywhere}
.a1cat-parent-option:hover{color:var(--cat-accent);background:var(--cat-soft)}.a1cat-parent-pages{display:flex;justify-content:center}.a1cat-list .a1cat-quiet{border-color:transparent;background:transparent}.a1cat-list .a1cat-parent-pages .a1cat-btn{font-size:12px;min-height:34px;height:34px}
.a1cat-dialog-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid var(--cat-line);padding:16px 22px}
@container(max-width:820px){.a1cat-controls{flex-wrap:wrap}.a1cat-list .a1cat-search{flex-basis:calc(100% - 180px);min-width:0}.a1cat-list .a1cat-sort{flex:1}.a1cat-list .a1cat-status{width:164px}.a1cat-controls>.a1cat-btn{flex:0 0 145px}}
@container(max-width:600px){
.a1cat-list .a1cat-controls{display:grid;grid-template-columns:minmax(0,1fr) 126px;gap:10px;margin-bottom:18px}
.a1cat-list .a1cat-search{grid-column:1/-1;min-width:0;width:100%;height:44px}.a1cat-list .a1cat-search input{height:42px}
.a1cat-list .a1cat-status{width:100%;height:44px}.a1cat-controls>.a1cat-btn{height:44px;min-width:0;padding:0 12px}
.a1cat-list .a1cat-sort{width:100%;grid-column:1/-1;height:40px;border-color:transparent;padding-left:0;color:var(--cat-muted);background-position:right 6px center}
.a1cat-create-desktop{display:none}.a1cat-create-mobile{display:inline}
.a1cat-list .ac-list table,.a1cat-list .ac-list tbody{display:block;width:100%}.a1cat-list .ac-list thead{display:none}
.a1cat-list .ac-list tbody tr{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:12px;padding:15px 0;min-width:0;border-top:1px solid var(--cat-line)}.a1cat-list .ac-list tbody tr:first-child{border-top:0}
.a1cat-list .ac-list td{border:0;padding:0;min-width:0}.a1cat-list .ac-list td:first-child{padding-left:0;grid-column:1;grid-row:1}
.a1cat-list .ac-list td:nth-child(2){grid-column:1/-1;grid-row:2;padding-top:8px}.a1cat-parent{display:flex;min-width:0;gap:3px;font-size:12px;color:var(--cat-muted)}.a1cat-parent-prefix{display:inline;white-space:nowrap}
.a1cat-parent .a1cat-full{min-width:0;flex:1}.a1cat-parent .a1cat-clamp{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.a1cat-list .ac-list td:nth-child(3){grid-column:2;grid-row:1;align-self:start}.a1cat-badge{font-size:10px;gap:4px;padding:1px 6px;line-height:21px}.a1cat-slug{font-size:11px}
.a1cat-list .ac-list td:nth-child(n+4){display:none}.a1cat-pagination{font-size:11px;gap:6px}.a1cat-pager{gap:8px}.a1cat-list .a1cat-pager .a1cat-icon-btn{width:38px;height:38px;min-height:38px}
}
@media(max-width:720px){.a1cat-list .ac-shell{padding:22px 16px}.a1cat-list .ac-shell__header{flex-direction:row;align-items:center;gap:10px;margin-bottom:20px}.a1cat-list .a1cat-title{gap:8px}.a1cat-list .a1cat-title h1{font-size:24px;line-height:32px}.a1cat-list .a1cat-total{font-size:13px}.a1cat-list .ac-shell__header>.a1cat-btn{padding:0 12px;font-size:13px}}
@media(max-width:600px){.a1cat-list .a1cat-dialog{margin:0;max-width:100vw;width:100vw;border-radius:0;height:100dvh;max-height:100dvh;border:0}.a1cat-dialog[open]{display:flex;flex-direction:column}.a1cat-dialog form{display:flex;flex-direction:column;flex:1;min-height:0}.a1cat-dialog-body{flex:1;overflow:auto;padding:20px}.a1cat-dialog-head{padding:18px 20px}.a1cat-dialog-foot{padding-bottom:max(18px,env(safe-area-inset-bottom))}.a1cat-list .a1cat-dialog .a1cat-control,.a1cat-list .a1cat-dialog .a1cat-btn{height:44px;min-height:44px}}
`;
const categoryStyle = `
.a1cat-editor .ac-shell{container-type:inline-size;--theme--foreground-subdued:var(--theme--foreground,#4f5464)}
.a1cat-editor .ac-shell__header{display:flex;align-items:stretch;flex-direction:column;gap:12px;margin-bottom:0}
.a1cat-editor .ac-shell__header>div:first-child h1{font-size:20px;line-height:1.3;margin:0;overflow-wrap:anywhere}
.a1cat-editor .ac-toolbar{display:flex;align-items:center;flex-direction:row;width:100%;gap:16px;padding:10px 0;border-bottom:1px solid var(--theme--border-color,#d9e1e8)}
.a1cat-editor .ac-toolbar>div:first-child{min-width:0;flex:1}
.a1cat-editor .ac-toolbar>div:first-child strong{display:none}
.a1cat-editor .ac-toolbar>div:first-child p{margin:0;color:var(--theme--foreground,#4f5464)}
.a1cat-editor .ac-toolbar__actions{width:auto;flex:0 0 auto;justify-content:flex-end}
.a1cat-editor .ac-toolbar__actions>button:first-child:not(:disabled){background:var(--theme--primary,#286b51);border-color:var(--theme--primary,#286b51);color:#fff}
.a1cat-editor .ac-toolbar__actions>button:disabled,.a1cat-editor .ac-tabs__list>button:disabled{opacity:1;color:var(--theme--foreground,#4f5464)}
.a1cat-editor .ac-shell__grid:not(.ac-shell__grid--single){grid-template-columns:minmax(0,1fr) minmax(280px,300px);gap:16px;margin-top:12px}
.a1cat-editor .ac-shell__main{container-type:inline-size;min-width:0;--theme--form--field--input--height:40px;--input-height:40px}
.a1cat-editor .ac-shell__main .v-form.grid{row-gap:16px;column-gap:16px}
.a1cat-editor .ac-shell__main .v-textarea,.a1cat-editor .ac-shell__main .v-textarea textarea{--input-height-md:80px;min-height:80px}
.a1cat-editor .ac-shell__main input::placeholder,.a1cat-editor .ac-shell__main textarea::placeholder{color:var(--theme--foreground,#4f5464);opacity:1}
.a1cat-editor .ac-shell__main .field-note,.a1cat-editor .ac-shell__main .field__note,.a1cat-editor .ac-shell__main .field-hint{color:var(--theme--foreground,#4f5464)}
.a1cat-editor .ac-tabs__list>button:not([aria-selected=true]){color:var(--theme--foreground,#4f5464)}
.a1cat-editor .category-note{color:var(--theme--foreground,#4f5464);margin:8px 0;overflow-wrap:anywhere}
.a1cat-editor .category-comparison{max-width:100%;overflow-wrap:anywhere;border:1px solid var(--theme--border-color);padding:12px;margin:12px 0}
.a1cat-editor .category-comparison button{min-height:40px;padding:8px 12px;border:1px solid var(--theme--border-color);border-radius:6px;margin:4px}
.a1cat-editor .ac-shell__context{min-width:0}
.a1cat-editor .category-media-field{min-width:0;margin-bottom:12px}
.a1cat-editor .ac-shell__context .v-upload{--input-height-md:80px;min-height:80px;padding:8px}
.a1cat-editor .ac-shell__context .image-preview{max-height:140px;overflow:hidden}
.a1cat-editor .ac-shell__context .image-preview>img{max-height:140px;object-fit:contain}
.a1cat-editor .category-media-note{margin:4px 0;color:var(--theme--foreground,#4f5464);font-size:12px}
.a1cat-editor .category-media-field [role=status]{margin:4px 0;color:var(--theme--foreground,#4f5464);font-size:12px}
.a1cat-editor .category-seo-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px 24px;min-width:0}
.a1cat-editor .category-seo-layout>section{min-width:0}
.a1cat-editor .category-seo-layout h2{font-size:15px;line-height:1.4;font-weight:600;margin:0 0 12px;overflow-wrap:anywhere}
.a1cat-editor .category-seo-preview{border-left:1px solid var(--theme--border-color,#d9e1e8);padding-left:20px;overflow-wrap:anywhere}
.a1cat-editor .category-seo-preview strong{display:block;color:var(--theme--primary,#286b51);font-weight:600}
.a1cat-editor .category-seo-preview p{margin:6px 0 0;white-space:pre-wrap}
.a1cat-editor .category-seo-settings{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px 20px;border-top:1px solid var(--theme--border-color,#d9e1e8);padding-top:14px}
.a1cat-editor .category-seo-settings>div{min-width:0}
.a1cat-editor .category-seo-settings .category-media-field{margin-bottom:0}
.a1cat-editor .category-seo-settings .v-upload{--input-height-md:80px;min-height:80px;padding:8px}
.a1cat-editor .category-seo-settings .image-preview{max-height:140px;overflow:hidden}
.a1cat-editor .category-seo-settings .image-preview>img{max-height:140px;object-fit:contain}
@container (max-width:720px){
  .a1cat-editor .ac-shell__grid:not(.ac-shell__grid--single){grid-template-columns:minmax(0,1fr);gap:16px}
  .a1cat-editor .ac-shell__main{--theme--form--field--input--height:44px;--input-height:44px}
  .a1cat-editor .ac-shell__main input,.a1cat-editor .ac-shell__main select{min-height:44px}
  .a1cat-editor .ac-toolbar{align-items:flex-start;flex-wrap:wrap}
  .a1cat-editor .ac-toolbar__actions{flex:1 1 100%;justify-content:flex-start}
  .a1cat-editor .ac-shell__context{max-width:100%}
  .a1cat-editor .category-seo-layout{grid-template-columns:minmax(0,1fr);gap:16px}
  .a1cat-editor .category-seo-preview{border-left:0;border-top:1px solid var(--theme--border-color,#d9e1e8);padding:14px 0 0}
  .a1cat-editor .category-seo-settings{grid-column:auto;grid-template-columns:minmax(0,1fr);gap:16px}
}
@container (max-width:520px){
  .a1cat-editor .ac-shell__main .v-form.grid [data-field]{grid-column:1/-1!important}
  .a1cat-editor .ac-shell__main .v-form.grid{row-gap:14px}
}
`;
export const CategoriesSection=defineComponent({name:"CategoriesSection",props:{id:{type:[String,Number],default:null}},setup:props=>()=>props.id==null||props.id===""?h(CategoryList):h(CategoryEditor,{id:props.id})});
export default CategoriesSection;
