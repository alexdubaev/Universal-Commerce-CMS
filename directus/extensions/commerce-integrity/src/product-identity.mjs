import {createHash} from 'node:crypto';

/** Manufacturer aliases are deliberately not guessed. Keep original labels/SKUs. */
export const normalizeBrand = value => typeof value === 'string'
  ? value.normalize('NFKC').trim().replace(/\s+/gu,' ').toLowerCase() : '';
export const normalizeArticle = value => typeof value === 'string'
  ? value.trim().toUpperCase().replace(/[^A-Z0-9]+/g,'') : '';

export function productIdentity(brand,sku) {
  const brand_key=normalizeBrand(brand), sku_normalized=normalizeArticle(sku);
  if(!brand_key)throw new TypeError('A confirmed brand is required for product identity');
  if(!sku_normalized)throw new TypeError('A nonempty normalized SKU/article is required');
  return {brand_key,sku_normalized,
    identity_key:createHash('sha256').update(JSON.stringify([brand_key,sku_normalized])).digest('hex')};
}

/** Dry-run is the same deterministic scan used under the migration table lock. */
export function planProductIdentity(rows) {
  const updates=[],conflicts=[],seen=new Map();
  for(const row of rows) {
    try {
      const derived=productIdentity(row.brand,row.sku);
      const previous=seen.get(derived.identity_key);
      if(previous!==undefined)conflicts.push({reason:'duplicate-brand-article',ids:[String(previous),String(row.id)]});
      else seen.set(derived.identity_key,row.id);
      if(Object.entries(derived).some(([key,value])=>row[key]!==value))updates.push({id:row.id,...derived});
    }catch(error){conflicts.push({reason:error.message,ids:[String(row.id)]});}
  }
  return {updates,conflicts};
}
