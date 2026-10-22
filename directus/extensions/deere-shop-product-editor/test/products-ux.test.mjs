import test from "node:test";
import assert from "node:assert/strict";
import { buildProductListQuery, createProductListController } from "../src/editor-state.mjs";

const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const response = (rows, total) => ({ data: { data: rows, meta: total == null ? undefined : { filter_count: total } } });

 test("product list query is explicit, bounded, filtered, sorted with stable id, and paged", () => {
  const query = buildProductListQuery({ page: 3, search: " pump ", sort: "title", filters: { status: "published", availability_status: "in_stock" } });
  assert.deepEqual(query, { fields: "id,title,brand,sku,status,availability_status,updated_at", limit: 25, offset: 50, sort: "title,id", meta: "filter_count", filter: { _and: [{ _or: ["title","brand","sku"].map(field => ({ [field]: { _icontains: "pump" } })) }, { status: { _eq: "published" } }, { availability_status: { _eq: "in_stock" } }] } });
  assert.equal(buildProductListQuery({ sort: "-updated_at" }).sort, "-updated_at,id");
  assert.throws(() => buildProductListQuery({ sort: "secret" }));
});

test("latest product list response wins, context survives controller recreation, and page changes reset", async () => {
  const calls = []; const pending=[];
  const api = { get(path, options) { calls.push(options.params); const d=deferred(); pending.push(d); return d.promise; } };
  const session = {};
  const first=createProductListController(api,session);
  first.setSearch("old"); const old=first.load();
  first.setSearch("new"); const current=first.load();
  pending[1].resolve(response([{id:"new",title:"New"}],1)); await current;
  pending[0].resolve(response([{id:"old",title:"Old"}],1)); await old;
  assert.equal(first.snapshot().rows[0].id,"new");
  first.setFilters({status:"draft"}); assert.equal(first.snapshot().page,1);
  first.setPage(3); first.setSort("title"); assert.equal(first.snapshot().page,1);
  const restored=createProductListController(api,session).snapshot();
  assert.equal(restored.search,"new"); assert.deepEqual(restored.filters,{status:"draft"}); assert.equal(restored.sort,"title");
  assert.equal(calls[0].limit,25);
});

test("product list reports honest totals and distinguishes empty, no matches, denied and recoverable failure", async () => {
  let mode="empty"; let count=0;
  const api={async get(path,options){ if(path==="/permissions/me")return {data:{data:{products:{read:{access:"full",fields:["id","title","brand","sku","slug","status"]},create:{access:"full",fields:["title","brand","sku","slug","status"]}}}}}; count++; if(mode==="denied")throw Object.assign(Error(),{response:{status:403}}); if(mode==="failure")throw Error(); return response([], mode==="empty"?0:0); }};
  const c=createProductListController(api,{}); await c.checkCreatePermission(); await c.load();
  assert.equal(c.snapshot().empty,"catalog"); assert.equal(c.snapshot().canCreate,true); assert.equal(c.snapshot().total,0);
  c.setSearch("none"); mode="nomatch"; await c.load(); assert.equal(c.snapshot().empty,"matches"); assert.equal(c.snapshot().total,0);
  mode="denied"; await c.load(); assert.equal(c.snapshot().errorKind,"denied");
  mode="failure"; await c.retry(); assert.equal(c.snapshot().errorKind,"failure"); assert.ok(count>=4);
  const missing=createProductListController({get:async()=>({data:{data:{products:{create:{access:"full",fields:["title"]}}}}})},{});
  await missing.checkCreatePermission(); assert.equal(missing.snapshot().canCreate,false);
  const denied=createProductListController({get:async()=>({data:{data:{products:{create:{access:"none",fields:["*"]}}}}})},{});
  await denied.checkCreatePermission(); assert.equal(denied.snapshot().canCreate,false);
});

test("unknown totals stay unknown and a disposed list ignores its pending response", async () => {
  const pending=deferred(); const c=createProductListController({get:()=>pending.promise},{});
  const loading=c.load(); c.dispose(); pending.resolve(response([{id:"late"}],undefined)); await loading;
  assert.deepEqual(c.snapshot().rows,[]); assert.equal(c.snapshot().total,null);
});

test("an empty later page is not reported as an empty catalog", async () => {
  const c=createProductListController({get:async()=>response([],12)},{});
  c.setPage(2); await c.load();
  assert.equal(c.snapshot().empty,"page"); assert.equal(c.snapshot().total,12);
});
