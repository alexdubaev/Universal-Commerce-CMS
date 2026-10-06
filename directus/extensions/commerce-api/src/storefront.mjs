import { createAtomicLeadHandler } from './leads.mjs';
import { createSearchHandler } from './index.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStore = { 'Cache-Control': 'no-store' };
const fields = {
  products: ['id','slug','title','sku','mpn','brand','short_description','full_description','price','currency','price_status','availability_status','part_type','main_image','specifications','delivery_status','seo_title','seo_description','updated_at','is_indexable','category.id','category.slug','category.title','category.description','category.h1','category.intro','category.image','category.seo_title','category.seo_description','category.is_indexable'],
  categories: ['id','slug','title','description','h1','intro','image','seo_title','seo_description','is_indexable'],
  pages: ['id','title','slug','page_type','h1','eyebrow','intro','seo_title','seo_description','seo_text','og_image','canonical_url','is_indexable','updated_at'],
  navigation_items: ['id','label','url','location','open_in_new_tab'],
  page_sections: ['id','section_type','title','subtitle','text','image','image_alt','button_text','button_url','items','settings'],
  home_page: ['id','status','h1','hero_title','hero_text','hero_image','hero_image_alt','hero_primary_button_text','hero_primary_button_url','hero_secondary_button_text','hero_secondary_button_url','hero_search_label','hero_search_placeholder','hero_search_button_text','seo_title','seo_description','canonical_url','is_indexable'],
  site_settings: ['company_name','phone','email','primary_cta_text','primary_cta_url','address','city','working_hours','delivery_region','legal_name','inn','kpp','ogrn','legal_address','vat_info','footer_text','footer_disclaimer'],
};
const relationProductFields = ['id','status','slug','title','sku','mpn','brand','price','currency','price_status','availability_status','part_type','main_image','category.id','category.slug','category.title'];
const fixedFields = {
  product_images: ['image','alt_text'], product_documents: ['file','title'], product_specifications: ['group_name','name','value','unit'], products_analogs: ['relation_type', ...relationProductFields.map(field => `product_from.${field}`), ...relationProductFields.map(field => `product_to.${field}`)], product_codes: ['code','code_type','source_name'],
};
const childCollections = new Set(['product_images','product_documents','product_specifications','products_analogs','product_codes']);
const allowed = new Set(['products','categories','pages','navigation_items','page_sections','home_page','site_settings', ...childCollections]);
const error = (res, status = 403) => res.status(status).set(noStore).json({ error: status === 403 ? 'forbidden' : 'invalid_request' });
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function configuration(env = process.env) {
  return env.COMMERCE_STOREFRONT_ENABLED === 'true' && UUID.test(env.COMMERCE_STOREFRONT_USER_ID ?? '') &&
    UUID.test(env.COMMERCE_STOREFRONT_PUBLIC_FOLDER_ID ?? '')
    ? { userId: env.COMMERCE_STOREFRONT_USER_ID.toLowerCase(), folderId: env.COMMERCE_STOREFRONT_PUBLIC_FOLDER_ID.toLowerCase() }
    : null;
}

function gate(req, res, env) {
  const config = configuration(env);
  const user = req?.accountability?.user;
  if (!config || typeof user !== 'string' || user.toLowerCase() !== config.userId || req.accountability.admin === true) {
    error(res); return null;
  }
  return config;
}

function decodeFilter(raw) {
  if (!raw || raw.length > 16384) return {};
  let input;
  try { input = JSON.parse(raw); } catch { throw new Error('filter'); }
  if (!plain(input)) throw new Error('filter');
  const terms = Array.isArray(input._and) && Object.keys(input).length === 1 ? input._and : [input];
  if (terms.length > 6) throw new Error('filter');
  const result = {};
  for (const term of terms) {
    if (!plain(term) || Object.keys(term).length !== 1) throw new Error('filter');
    if ('_or' in term) {
      if (!Array.isArray(term._or) || term._or.length !== 2 || term._or.some(item => !plain(item) || Object.keys(item).length !== 1)) throw new Error('filter');
      const branches = term._or.map(item => { const [key, value] = Object.entries(item)[0]; if (!['product_from','product_to'].includes(key) || !plain(value) || !UUID.test(value._eq ?? '') || Object.keys(value).length !== 1) throw new Error('filter'); return { [key]: { _eq: value._eq } }; });
      result._or = branches; continue;
    }
    let [field, expression] = Object.entries(term)[0];
    if (field === 'status' || field === 'is_visible') {
      const expected = field === 'status' ? 'published' : true;
      if (!plain(expression) || expression._eq !== expected || Object.keys(expression).length !== 1) throw new Error('filter');
      if (field === 'is_visible') result.is_visible = { _eq: true };
      continue;
    }
    if (field === 'location') {
      if (!plain(expression) || !['header','footer','legal'].includes(expression._eq) || Object.keys(expression).length !== 1) throw new Error('filter');
      result.location = { _eq: expression._eq }; continue;
    }
    if (field === 'parent') {
      if (!plain(expression) || expression._null !== true || Object.keys(expression).length !== 1) throw new Error('filter');
      result.parent = { _null: true }; continue;
    }
    if (field === 'page' || field === 'home_page' || field === 'product') {
      if (!plain(expression) || typeof expression._eq !== 'string' || !UUID.test(expression._eq) || Object.keys(expression).length !== 1) throw new Error('filter');
      result[field] = { _eq: expression._eq }; continue;
    }
    if (field === 'category') {
      if (!plain(expression) || Object.keys(expression).length !== 1 || !plain(expression.slug) || Object.keys(expression.slug).length !== 1 || typeof expression.slug._eq !== 'string') throw new Error('filter');
      field = 'category.slug'; expression = expression.slug;
    }
    const operators = { brand: ['_eq','_nnull'], 'category.slug': ['_eq'], availability_status: ['_eq'], part_type: ['_eq'], id: ['_eq','_in'], slug: ['_eq'], is_indexable: ['_eq','_neq','_null'], is_active: ['_eq'] };
    if (!operators[field] || !plain(expression) || Object.keys(expression).length !== 1) throw new Error('filter');
    const [op, value] = Object.entries(expression)[0];
    if (!operators[field].includes(op)) throw new Error('filter');
    if (field === 'id') {
      if (op === '_eq' ? (typeof value !== 'string' || !UUID.test(value)) : op !== '_in' || !Array.isArray(value) || value.length > 200 || value.some(id => typeof id !== 'string' || !UUID.test(id))) throw new Error('filter');
    } else if (field === 'is_indexable' || field === 'is_active') { if (!['_eq','_neq','_null'].includes(op) || typeof value !== 'boolean') throw new Error('filter'); }
    else if (field === 'brand' && op === '_nnull') { if (value !== true) throw new Error('filter'); }
    else if (field === 'id' && op === '_eq') { /* UUID was checked above. */ }
    else if (typeof value !== 'string' || value.length > 160) throw new Error('filter');
    if (field === 'category.slug') result.category = { slug: { [op]: value } };
    else result[field] = { [op]: value };
  }
  return result;
}

function queryParams(req, collection) {
  const query = req.query ?? {};
  const allowedParams = new Set(['fields','limit','page','sort','meta','filter','aggregate[count]','groupBy[]','aggregate','groupBy','offset']);
  const aggregateValue = query['aggregate[count]'] ?? (plain(query.aggregate) && Object.keys(query.aggregate).length === 1 ? query.aggregate.count : undefined);
  const groupRaw = query['groupBy[]'] ?? query.groupBy;
  const groupValue = Array.isArray(groupRaw) && groupRaw.length === 1 ? groupRaw[0] : groupRaw;
  const aggregate = aggregateValue !== undefined || groupValue !== undefined;
  if (('aggregate' in query && (!plain(query.aggregate) || Object.keys(query.aggregate).length !== 1 || !('count' in query.aggregate))) ||
      ('groupBy' in query && groupValue !== 'brand') || ('groupBy[]' in query && groupValue !== 'brand') ||
      ('aggregate' in query && 'aggregate[count]' in query) || ('groupBy' in query && 'groupBy[]' in query)) throw new Error('query');
  if (aggregate && (collection !== 'products' || aggregateValue !== '*' || groupValue !== 'brand' || Object.keys(query).some(key => !['aggregate[count]','groupBy[]','aggregate','groupBy','limit','filter'].includes(key)))) throw new Error('query');
  const fieldAllowlist = fields[collection] ?? fixedFields[collection] ?? [];
  const requestedFieldList = query.fields === undefined ? null : query.fields.split(',');
  if (requestedFieldList && (requestedFieldList.length > 50 || new Set(requestedFieldList).size !== requestedFieldList.length || requestedFieldList.some(field => !fieldAllowlist.includes(field)))) throw new Error('query');
  const scalarEntries = Object.entries(query).filter(([key]) => !['aggregate','groupBy','groupBy[]'].includes(key));
  if (Object.keys(query).some(key => !allowedParams.has(key)) || scalarEntries.some(([key, value]) => typeof value !== 'string' || value.length > (key === 'filter' ? 16384 : 4096)) ||
      scalarEntries.reduce((sum, [, value]) => sum + String(value).length, 0) > 18432) throw new Error('query');
  if (aggregate && String(query.limit) !== '500') throw new Error('query');
  const filters = decodeFilter(query.filter);
  const hasIdWindow = collection === 'products' && Array.isArray(filters.id?._in);
  const isSitemap = collection === 'products' && query.fields === 'slug,updated_at' && query.sort === 'id';
  const maxLimit = query['aggregate[count]'] === '*' ? 500 : isSitemap ? 500 : collection === 'products' ? (hasIdWindow ? 200 : 24) : ({ categories: 200, navigation_items: 100, page_sections: 100, pages: query.fields === 'slug,updated_at' ? 500 : 1, home_page: 1, site_settings: 1, product_images: 50, product_documents: 50, product_specifications: 200, products_analogs: 100, product_codes: 100 }[collection] ?? 24);
  const limit = Number(query.limit ?? (collection === 'categories' ? 200 : 24));
  const page = Number(query.page ?? 1);
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit || !Number.isInteger(page) || page < 1 || page > 1000) throw new Error('query');
  const offset = Number(query.offset ?? 0);
  if (!Number.isInteger(offset) || offset < 0 || offset > 1000000) throw new Error('query');
  if (offset && !['products','pages'].includes(collection)) throw new Error('query');
  if (query.meta !== undefined && query.meta !== 'filter_count') throw new Error('query');
  const defaults = { products: aggregate ? '' : '-popularity_score,title', categories: 'sort_order,title', navigation_items: 'sort_order', page_sections: 'sort_order', product_images: 'sort_order', product_documents: 'sort_order', product_specifications: 'sort_order', product_codes: 'code_type,code', pages: query.fields === 'slug,updated_at' ? 'slug' : '' };
  const sort = (query.sort ?? defaults[collection] ?? '').split(',').filter(Boolean);
  const allowedSort = {
    products: ['-popularity_score,title','price,title','-price,title','title','id'], categories: ['sort_order,title'], navigation_items: ['sort_order'], page_sections: ['sort_order'],
    product_images: ['sort_order'], product_documents: ['sort_order'], product_specifications: ['sort_order'], product_codes: ['code_type,code'], pages: ['slug'],
  }[collection] ?? [];
  if (query.sort !== undefined && !allowedSort.includes(query.sort) || query.sort === undefined && sort.length && !allowedSort.includes(sort.join(','))) throw new Error('query');
  return { limit, page, offset, filters, aggregate, sort };
}

function makeItemsHandler(context) {
  return async (req, res) => {
    const config = gate(req, res, context.env); if (!config) return;
    const collection = req.params?.collection;
    if (!allowed.has(collection)) return error(res, 404);
    let parsed;
    try { parsed = queryParams(req, collection); } catch { return error(res, 400); }
    try {
      const schema = await context.getSchema();
      const serviceOptions = { schema, accountability: { user: config.userId, role: null, admin: true, app: false }, knex: context.database };
      const service = new context.services.ItemsService(collection, serviceOptions);
      let filter = { ...(['product_codes','products_analogs','site_settings'].includes(collection) ? {} : { status: { _eq: 'published' } }), ...parsed.filters };
      if (collection === 'products') {
        if (filter.category) filter.category = { ...filter.category, status: { _eq: 'published' } };
        filter._or = [{ category: { _null: true } }, { category: { status: { _eq: 'published' } } }];
      }
      if (collection === 'navigation_items') filter = { ...filter, is_visible: { _eq: true }, parent: { _null: true } };
      if (collection === 'page_sections') {
        if (Boolean(filter.page) === Boolean(filter.home_page)) return error(res, 400);
        filter = { ...filter, is_visible: { _eq: true }, ...(filter.page ? { page: { ...filter.page, status: { _eq: 'published' } } } : {}), ...(filter.home_page ? { home_page: { ...filter.home_page, status: { _eq: 'published' } } } : {}) };
      }
      if (collection === 'product_codes') filter.is_active = { _eq: true };
      if (childCollections.has(collection)) {
        if (collection === 'products_analogs') {
          const publishedProduct = { status: { _eq: 'published' }, category: { status: { _eq: 'published' } } };
          filter = { ...filter, product_from: publishedProduct, product_to: publishedProduct };
        } else filter = { ...filter, product: { status: { _eq: 'published' } } };
      }
      const requestedFields = parsed.aggregate ? ['brand'] : req.query?.fields ? req.query.fields.split(',') : (fields[collection] ?? fixedFields[collection]);
      const readQuery = { filter, fields: requestedFields, limit: parsed.limit, page: parsed.page, ...(req.query?.offset !== undefined ? { offset: parsed.offset } : {}), ...(parsed.sort.length ? { sort: parsed.sort } : {}), meta: ['filter_count'] };
      if (parsed.aggregate) { readQuery.aggregate = { count: ['*'] }; readQuery.groupBy = ['brand']; }
      if (collection === 'home_page' || collection === 'site_settings') readQuery.limit = 1;
      const rows = await service.readByQuery(readQuery);
      const result = Array.isArray(rows) ? rows : rows?.data ?? [];
      let total = rows?.meta?.filter_count ?? result.length;
      if (req.query?.meta === 'filter_count' && !parsed.aggregate) {
        const primary = schema?.collections?.[collection]?.primary ?? 'id';
        const counted = await service.readByQuery({ filter, aggregate: { count: [primary] }, limit: 1 });
        const countValue = counted?.[0]?.count;
        const numeric = Number(plain(countValue) ? Object.values(countValue)[0] : countValue);
        if (Number.isFinite(numeric)) total = numeric;
      }
      return res.set(noStore).json({ data: collection === 'home_page' || collection === 'site_settings' ? (result[0] ?? null) : result, meta: { filter_count: total } });
    } catch { return error(res, 500); }
  };
}

function makeAssetHandler(context) {
  return async (req, res) => {
    const config = gate(req, res, context.env); if (!config) return;
    const id = req.params?.id;
    if (typeof id !== 'string' || !UUID.test(id)) return error(res, 404);
    try {
      const schema = await context.getSchema();
      const accountability = { user: config.userId, role: null, admin: true, app: false };
      const files = new context.services.ItemsService('directus_files', { schema, accountability, knex: context.database });
      const file = (await files.readByQuery({ filter: { id: { _eq: id }, folder: { _eq: config.folderId } }, fields: ['id','folder','type','filesize','filename_download'], limit: 1 }))[0];
      if (!file) return error(res, 404);
      const refs = [
        ['products', 'main_image', { status: { _eq: 'published' } }], ['product_images', 'image', { status: { _eq: 'published' }, product: { status: { _eq: 'published' } } }],
        ['product_documents', 'file', { status: { _eq: 'published' }, product: { status: { _eq: 'published' } } }], ['categories', 'image', { status: { _eq: 'published' } }], ['categories', 'icon', { status: { _eq: 'published' } }], ['categories', 'og_image', { status: { _eq: 'published' } }],
        ['pages', 'og_image', { status: { _eq: 'published' } }], ['page_sections', 'image', { status: { _eq: 'published' }, is_visible: { _eq: true }, page: { status: { _eq: 'published' } } }],
        ['home_page', 'hero_image', { status: { _eq: 'published' } }], ['home_page', 'og_image', { status: { _eq: 'published' } }], ['site_settings', 'logo', {}], ['site_settings', 'favicon', {}], ['site_settings', 'default_og_image', {}], ['site_settings', 'company_image', {}],
        ['page_sections', 'image', { status: { _eq: 'published' }, is_visible: { _eq: true }, home_page: { status: { _eq: 'published' } } }],
      ];
      let referenced = false;
      for (const [collection, field, parentFilter] of refs) {
        const rows = await new context.services.ItemsService(collection, { schema, accountability, knex: context.database }).readByQuery({ filter: { [field]: { _eq: id }, ...parentFilter }, fields: ['id'], limit: 1 });
        if (rows?.length) { referenced = true; break; }
      }
      if (!referenced) return error(res, 404);
      const asset = await new context.services.AssetsService({ schema, accountability, knex: context.database }).getAsset(id, null, undefined, true);
      const mime = /^image\/(?:png|jpeg|gif|webp|avif)$/.test(asset.file.type ?? '') || asset.file.type === 'application/pdf' ? asset.file.type : 'application/octet-stream';
      const filename = encodeURIComponent(String(asset.file.filename_download ?? 'download').replace(/[\r\n"\\]/g, '_'));
      res.set({ ...noStore, 'X-Content-Type-Options':'nosniff', 'Cross-Origin-Resource-Policy':'same-origin', 'Content-Security-Policy':"sandbox; default-src 'none'", 'Content-Type': mime, 'Content-Disposition': `${mime === 'application/octet-stream' ? 'attachment' : 'inline'}; filename*=UTF-8''${filename}` });
      return asset.stream().pipe(res);
    } catch { return error(res, 404); }
  };
}

export function registerStorefrontGateway(router, context) {
  const gatewayContext = { ...context, env: context.env ?? process.env };
  router.get('/storefront/items/:collection', makeItemsHandler(gatewayContext));
  router.get('/storefront/search', (req, res) => {
    const config = gate(req, res, gatewayContext.env); if (!config) return;
    if (Object.keys(req.query ?? {}).some(key => !['q','page','limit'].includes(key))) return error(res, 400);
    if (Object.values(req.query ?? {}).some(value => typeof value !== 'string' || value.length > 128)) return error(res, 400);
    if (req.query?.page !== undefined && (!/^\d+$/.test(req.query.page) || Number(req.query.page) > 200)) return error(res, 400);
    if (req.query?.limit !== undefined && (!/^\d+$/.test(req.query.limit) || Number(req.query.limit) > 20)) return error(res, 400);
    req.accountability = { user: config.userId, role: null, admin: true, app: false };
    res.set(noStore);
    return createSearchHandler({ ...gatewayContext, env: { COMMERCE_ENABLE_ADDITIONAL_CODES: 'false' }, forcePublishedCategory: true })(req, res);
  });
  router.get('/storefront/assets/:id', makeAssetHandler(gatewayContext));
  router.get('/storefront/health', async (req, res) => {
    const config = gate(req, res, gatewayContext.env); if (!config) return;
    try { await gatewayContext.database.raw('select 1'); return res.set(noStore).json({ data: { status: 'ok' } }); }
    catch { return error(res, 503); }
  });
  const lead = createAtomicLeadHandler({ ...gatewayContext, ownerId: gatewayContext.env.COMMERCE_STOREFRONT_USER_ID, allowAttachments: false, acknowledgeOnly: true });
  router.post('/storefront/leads', (req, res) => {
    const config = gate(req, res, gatewayContext.env); if (!config) return;
    res.set(noStore);
    req.accountability = { user: config.userId, role: null, admin: true, app: false };
    return lead(req, res);
  });
  router.post('/storefront/orders', (req, res) => { if (!gate(req, res, gatewayContext.env)) return; return res.set(noStore).status(404).json({ error: 'disabled' }); });
}
