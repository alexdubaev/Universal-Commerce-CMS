import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const schema = readJson('research/schema.json');
const studio = readJson('research/studio.json');
const data = readJson('mockups-data.json');
const visible = schema.collections.filter((collection) => !collection.folder && !studio.collections[collection.name]?.hidden);
assert.equal(visible.length, 14, 'expected 14 visible section specs');
assert.equal(data.collections.length, 14, 'expected 14 mockup data sections');

let sectionFields = 0;
for (const collection of visible) {
  const directory = path.join(root, 'sections', collection.name);
  for (const file of ['TZ.md', 'LAUNCH.md', 'routes.md', 'FIELD-MAP.md', 'fields.json', 'fixture.json', 'mockup.html']) {
    assert.ok(fs.existsSync(path.join(directory, file)), `${collection.name} missing ${file}`);
  }
  const fields = readJson(path.relative(root, path.join(directory, 'fields.json'))).fields;
  const fieldNames = collection.fields.map((field) => field.name).sort();
  assert.deepEqual(Object.keys(fields).sort(), fieldNames, `${collection.name} schema mismatch`);
  const mockup = data.collections.find((item) => item.name === collection.name);
  assert.ok(mockup, `${collection.name} missing mockup data`);
  assert.deepEqual(mockup.fields.map((field) => field.name).sort(), fieldNames, `${collection.name} mockup field mismatch`);
  assert.deepEqual(mockup.tabs.flatMap((tab) => tab.fields).sort(), fieldNames, `${collection.name} tab coverage mismatch`);
  if (collection.name !== 'products') assert.equal(mockup.route, `/admin/product-editor/sections/${collection.name}`);
  if (['navigation_items', 'faq_items', 'recent_supplies', 'leads', 'orders', 'seo_work_items', 'products_analogs'].includes(collection.name)) {
    assert.equal(mockup.guarded, true, `${collection.name} gate missing`);
  }
  assert.match(readJson(path.relative(root, path.join(directory, 'fixture.json')))._warning, /OFFLINE/i);
  const mockupPage = fs.readFileSync(path.join(directory, 'mockup.html'), 'utf8');
  assert.ok(mockupPage.includes(`../../mockups.html#${collection.name}`), `${collection.name} mockup link target mismatch`);
  sectionFields += collection.fields.length;
}

const html = fs.readFileSync(path.join(root, 'mockups.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
const context = vm.createContext({
  document: { body: { classList: { toggle() {} } }, querySelector() { return { innerHTML: '', onclick: null }; }, querySelectorAll() { return []; } },
  location: { hash: '#products' }, window: { addEventListener() {} }, console,
});
for (const script of scripts) {
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(script), 'mockup must stay offline');
  new vm.Script(script).runInContext(context);
}
assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(DATA)', context)), data, 'embedded DATA differs from mockups-data.json');
const renderedTabs = vm.runInContext(`DATA.collections.map(c => { current=c; view='detail'; return c.tabs.map((_,i) => { activeTab=i; state='normal'; const s=app(); if(!s.includes('role="tablist"')) throw new Error(c.name+' missing tabs'); return [c.name,s.length]; }); }).flat()`, context);
assert.ok(renderedTabs.length >= 50, 'expected section mockup tabs to render');

let jsonFiles = 0;
let markdownFiles = 0;
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (entry.name.endsWith('.json')) { JSON.parse(fs.readFileSync(file, 'utf8')); jsonFiles++; }
    if (entry.name.endsWith('.md')) {
      markdownFiles++;
      const text = fs.readFileSync(file, 'utf8');
      for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
        const target = match[1].split('#')[0];
        if (!target || /^(https?:|mailto:|#)/.test(target)) continue;
        assert.ok(fs.existsSync(path.resolve(path.dirname(file), decodeURIComponent(target))), `${path.relative(root, file)} broken link ${target}`);
      }
    }
  }
}
walk(root);
const supportDirectories = fs.readdirSync(path.join(root, 'support'), { withFileTypes: true }).filter((entry) => entry.isDirectory());
assert.equal(supportDirectories.length, 9, 'expected nine supporting collection maps');
console.log(JSON.stringify({ passed: true, visibleSections: visible.length, sectionFields, supportCollections: supportDirectories.length, schemaFields: schema.collections.reduce((sum, collection) => sum + collection.fields.length, 0), renderedTabs: renderedTabs.length, jsonFiles, markdownFiles, browserCheck: 'Not run; this verifier checks offline source and data only.' }, null, 2));
