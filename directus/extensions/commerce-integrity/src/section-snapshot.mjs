export const SECTION_TYPES = new Set(['hero','categories','company_trust','featured_products','advantages','steps','cta','catalog_preview','seo_text','lead_form','parts_request','recent_supplies','faq','contacts','articles','custom']);
const owns=(value,key)=>Object.hasOwn(value,key);

/** A snapshot is one parent publication unit. Legacy children are never changed. */
export function validateSectionSnapshot(payload,original={}) {
  const source=owns(payload,'sections_source')?payload.sections_source:original.sections_source??'children';
  if(!['children','snapshot'].includes(source))throw new TypeError('Invalid sections snapshot source');
  if(!owns(payload,'sections_snapshot')&&source!=='snapshot')return payload;
  const snapshot=owns(payload,'sections_snapshot')?payload.sections_snapshot:original.sections_snapshot;
  if(snapshot==null&&source==='children')return payload;
  if(!Array.isArray(snapshot)||snapshot.length>500)throw new TypeError('Sections snapshot must be an array with at most 500 blocks');
  if(Buffer.byteLength(JSON.stringify(snapshot),'utf8')>1024*1024)throw new TypeError('Sections snapshot exceeds 1 MiB');
  const ids=new Set();
  for(const section of snapshot) {
    if(!section||typeof section!=='object'||Array.isArray(section)||!SECTION_TYPES.has(section.section_type))throw new TypeError('Invalid section type in snapshot');
    if(typeof section.id!=='string'||!section.id||ids.has(section.id))throw new TypeError('Invalid or duplicate snapshot id');
    ids.add(section.id);
    if(section.status!==undefined&&section.status!=='published')throw new TypeError('Snapshot blocks must use published status; parent version controls publication');
    if(typeof section.is_visible!=='boolean')throw new TypeError('Invalid snapshot visibility');
    if(section.sort_order!=null&&(!Number.isFinite(section.sort_order)||!Number.isInteger(section.sort_order)))throw new TypeError('Invalid snapshot order');
    for(const key of ['title','subtitle','text','image_alt','button_text','button_url'])if(section[key]!=null&&typeof section[key]!=='string')throw new TypeError('Invalid snapshot text');
  }
  return payload;
}
