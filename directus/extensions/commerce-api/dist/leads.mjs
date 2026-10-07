import { createHash } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = new Set(['name', 'phone', 'email', 'message', 'product', 'category', 'page_url',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'request_items',
  'marketing_consent', 'marketing_consent_at', 'marketing_consent_version']);
const OMIT = new Set(['page_url', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'marketing_consent_at', 'marketing_consent_version']);
const fail = (status, message, code = 'INVALID_PAYLOAD') => Object.assign(new Error(message), { status, code });
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const stable = value => Array.isArray(value) ? value.map(stable) : plain(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value ?? null;

export function leadFingerprint(lead, manifest) {
  return createHash('sha256').update(JSON.stringify(stable({
    lead: Object.fromEntries(Object.entries(lead).filter(([key]) => !OMIT.has(key))), attachments: manifest,
  }))).digest('hex');
}

// Same deterministic ID contract as commerce/installation.mjs. The deployed
// extension is standalone; the folder is derived from the stored site profile.
function privateFolder(siteId) {
  if (typeof siteId !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(siteId)) throw fail(409, 'Профиль магазина не настроен.');
  const hex = createHash('sha256').update(`commerce:${siteId}:lead-attachments`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function validate(body) {
  const { request_key: key, lead, attachments = [], attachment_manifest: manifest = [], action = 'create' } = body ?? {};
  if (typeof key !== 'string' || !UUID.test(key) || !plain(lead) || !['create', 'lookup'].includes(action) ||
      JSON.stringify(body).length > 512_000 || Object.keys(lead).some(field => !FIELDS.has(field)) ||
      typeof lead.name !== 'string' || lead.name.trim().length < 2 || lead.name.length > 100 ||
      typeof lead.page_url !== 'string' || lead.page_url.length > 1000 || !/^https?:\/\//.test(lead.page_url) ||
      !((typeof lead.phone === 'string' && lead.phone.length >= 7 && lead.phone.length <= 40) ||
        (typeof lead.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)))) throw fail(400, 'Проверьте данные заявки.');
  for (const [field, value] of Object.entries(lead)) {
    if (value == null || ['request_items', 'marketing_consent'].includes(field)) continue;
    if (typeof value !== 'string' || value.length > (field === 'message' ? 3000 : 1000)) throw fail(400, 'Недопустимые данные заявки.');
  }
  if (lead.marketing_consent != null && typeof lead.marketing_consent !== 'boolean') throw fail(400, 'Недопустимые данные согласия.');
  if (['product', 'category'].some(field => lead[field] != null && !UUID.test(lead[field]))) throw fail(400, 'Недопустимая ссылка на товар или категорию.');
  if (lead.request_items != null && (!Array.isArray(lead.request_items) || lead.request_items.length > 100 ||
      lead.request_items.some(item => !plain(item) || typeof item.article !== 'string' || !item.article || item.article.length > 128 ||
        !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100_000))) throw fail(400, 'Проверьте список позиций.');
  if (!Array.isArray(manifest) || manifest.length > 2 || manifest.some(file => !plain(file) ||
      !['photo', 'spreadsheet'].includes(file.kind) || typeof file.name !== 'string' || !file.name || file.name.length > 100 ||
      !Number.isSafeInteger(file.size) || file.size < 1 || file.size > 10 * 1024 * 1024 || typeof file.type !== 'string' || file.type.length > 150 ||
      typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256)) || new Set(manifest.map(file => file.kind)).size !== manifest.length ||
      !Array.isArray(attachments) || attachments.some(id => typeof id !== 'string' || !UUID.test(id)) ||
      new Set(attachments).size !== attachments.length || (action === 'create' && attachments.length !== manifest.length) ||
      (action === 'lookup' && attachments.length)) throw fail(400, 'Проверьте вложения заявки.');
  return { key: key.toLowerCase(), lead: { ...lead, phone: lead.phone ?? null }, attachments, manifest, action };
}

/** Durable first-party lead submission. Lost acknowledgements reuse the same
 * key and return the committed lead; private uploads are never deleted here.
 * A lookup uses the same fingerprint before Next uploads files on a retry.
 * All record reads/writes retain caller accountability on one transaction.
 */
export function createAtomicLeadHandler({ database, services, getSchema, logger, ownerId = null, allowAttachments = true, acknowledgeOnly = false }) {
  return async (req, res) => {
    if (!req.accountability?.user) return res.status(403).json({ errors: [{ code: 'FORBIDDEN', message: 'Требуется авторизация.' }] });
    try {
      const { key, lead, attachments, manifest, action } = validate(req.body);
      if (!allowAttachments && (attachments.length || manifest.length)) throw fail(400, 'Вложения заявок недоступны.');
      const fingerprint = leadFingerprint(lead, manifest), schema = await getSchema();
      const result = await database.transaction(async trx => {
        await trx.raw("SET LOCAL lock_timeout = '5s'");
        await trx.raw("SET LOCAL statement_timeout = '20s'");
        const lock = createHash('sha256').update(`commerce-lead:${key}`).digest();
        await trx.raw('SELECT pg_advisory_xact_lock(?, ?)', [lock.readInt32BE(0), lock.readInt32BE(4)]);
        const service = collection => new services.ItemsService(collection, { schema, accountability: req.accountability, knex: trx });
        const leads = service('leads');
        const ownerFilter = ownerId ? { user_created: { _eq: ownerId } } : null;
        const previous = await leads.readByQuery({ filter: ownerFilter
          ? { _and: [{ request_key: { _eq: key } }, ownerFilter] }
          : { request_key: { _eq: key } }, fields: ['id', 'request_fingerprint', 'attachments'], limit: 1 });
        if (previous.length) {
          if (previous[0].request_fingerprint !== fingerprint) throw fail(409, 'Этот идентификатор уже относится к другой заявке.', 'IDEMPOTENCY_CONFLICT');
          return { id: previous[0].id, replayed: true, attachments: previous[0].attachments ?? [] };
        }
        if (action === 'lookup') return { id: null, replayed: false, attachments: [] };
        const settings = await service('site_settings').readByQuery({ fields: ['commerce_profile'], limit: 1 });
        const profile = settings[0]?.commerce_profile;
        if (!profile || ((manifest.length || lead.request_items?.length) && profile.features?.parts_request !== true)) throw fail(409, 'Приём списка позиций недоступен.');
        if (attachments.length) {
          const folder = privateFolder(profile.site_id);
          await trx('directus_files').whereIn('id', attachments).orderBy('id').forUpdate();
          const files = await service('directus_files').readByQuery({ filter: { id: { _in: attachments } },
            fields: ['id', 'folder', 'uploaded_by', 'description', 'filesize', 'filename_download', 'type'], limit: attachments.length });
          const byId = new Map(files.map(file => [file.id, file]));
          attachments.forEach((id, index) => {
            const file = byId.get(id), expected = manifest[index];
            if (!file || file.folder !== folder || file.uploaded_by !== req.accountability.user ||
                file.description !== `commerce-lead:${key}:${expected.kind}:${expected.sha256}` ||
                Number(file.filesize) !== expected.size || file.filename_download !== expected.name || file.type !== expected.type) {
              throw fail(400, 'Приватное вложение заявки не подтверждено.');
            }
          });
        }
        const id = await leads.createOne({ ...lead, status: 'new', attachments, request_key: key, request_fingerprint: fingerprint,
          ...(ownerId ? { user_created: ownerId } : {}) });
        return { id, replayed: false, attachments };
      });
      return res.json({ data: acknowledgeOnly ? { id: result.id, replayed: result.replayed } : result });
    } catch (error) {
      const status = error.status ?? (error.code === 'FORBIDDEN' ? 403 : ['RECORD_NOT_UNIQUE', '23505'].includes(error.code) ? 409 : 500);
      logger?.warn?.({ code: error.code ?? 'LEAD_WRITE_FAILED' }, 'Atomic lead request failed');
      return res.status(status).json({ errors: [{ code: error.code ?? 'LEAD_WRITE_FAILED', message: status < 500 ? error.message : 'Сохранение не подтверждено. Повторяйте с тем же идентификатором заявки.' }] });
    }
  };
}
