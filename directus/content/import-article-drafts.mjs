import { readFile } from 'node:fs/promises';
import { DirectusAdminClient, isMainModule } from '../schema/apply-schema.mjs';

const OWN_INSTANCE = 'http://127.0.0.1:18056';
const draftFields = new Set(['status', 'title', 'slug', 'excerpt', 'content', 'seo_title', 'seo_description']);

function validateDrafts(drafts) {
  if (!Array.isArray(drafts) || !drafts.length || drafts.length > 100) throw new Error('Expected a nonempty draft list (up to 100).');
  const slugs = new Set();
  for (const draft of drafts) {
    if (!draft || typeof draft !== 'object' || Array.isArray(draft) || Object.keys(draft).some(field => !draftFields.has(field))) throw new Error('Unsupported draft field.');
    if (draft.status !== 'draft' || ['title', 'slug', 'excerpt', 'content'].some(field => typeof draft[field] !== 'string' || !draft[field].trim())) throw new Error('All articles must be complete drafts.');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug) || draft.slug.length > 160 || slugs.has(draft.slug)) throw new Error('Invalid or duplicate draft slug.');
    if (['seo_title', 'seo_description'].some(field => field in draft && typeof draft[field] !== 'string')) throw new Error('Invalid draft SEO field.');
    slugs.add(draft.slug);
  }
}

function requireOwnApply(client, { confirmOwnInstance, plannedDate }) {
  if (client?.baseUrl !== OWN_INSTANCE) throw new Error(`Directus target must be exactly ${OWN_INSTANCE}.`);
  if (confirmOwnInstance !== true) throw new Error('Confirm that this is the site’s own instance before applying.');
  const normalized = typeof plannedDate === 'string' && !plannedDate.includes('.') ? plannedDate.replace(/Z$/, '.000Z') : plannedDate;
  if (typeof plannedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(plannedDate) || !Number.isFinite(Date.parse(plannedDate)) || new Date(plannedDate).toISOString() !== normalized) throw new Error('Supply a valid UTC ISO planned date; check the actual date before publication.');
}

/** Offline by default. Apply creates drafts only; existing slugs are never edited. */
export async function importArticleDrafts(client, drafts, options = {}) {
  validateDrafts(drafts);
  if (options.apply !== true) return drafts.map(({ slug }) => ({ slug, action: 'plan', status: 'draft' }));
  requireOwnApply(client, options);
  const actions = [];
  for (const draft of drafts) {
    const query = new URLSearchParams({ fields: 'id,slug,status', limit: '1', filter: JSON.stringify({ slug: { _eq: draft.slug } }) });
    const existing = await client.request(`/items/articles?${query}`);
    if (!Array.isArray(existing)) throw new Error('Invalid article lookup response; stopping import.');
    if (existing.length) {
      actions.push({ slug: draft.slug, action: 'skip', status: 'draft' });
      continue;
    }
    // The existing schema requires published_at even for draft rows. This is an
    // explicitly supplied preliminary date, never an inferred publication date.
    await client.request('/items/articles', { method: 'POST', body: JSON.stringify({ ...draft, status: 'draft', published_at: options.plannedDate }) });
    actions.push({ slug: draft.slug, action: 'create', status: 'draft' });
  }
  return actions;
}

async function main() {
  const args = process.argv.slice(2);
  const dateIndex = args.indexOf('--planned-date');
  const options = { apply: args.includes('--apply'), confirmOwnInstance: args.includes('--confirm-own-instance'), plannedDate: dateIndex < 0 ? undefined : args[dateIndex + 1] };
  const known = new Set(['--apply', '--dry-run', '--confirm-own-instance', '--planned-date']);
  if (args.some((arg, index) => !(dateIndex >= 0 && index === dateIndex + 1) && !known.has(arg)) || (options.apply && args.includes('--dry-run'))) throw new Error('Invalid importer arguments.');
  const drafts = JSON.parse(await readFile(new URL('../../profiles/smtechno/article-drafts.json', import.meta.url), 'utf8'));
  validateDrafts(drafts);
  let client = null;
  if (options.apply) {
    // Check the explicit target before the existing native client can log in.
    requireOwnApply({ baseUrl: process.env.DIRECTUS_URL }, options);
    client = await DirectusAdminClient.connectFromEnvironment();
  }
  const actions = await importArticleDrafts(client, drafts, options);
  for (const { slug, action } of actions) console.log(`${action}: ${slug} (draft)`);
  console.log(options.apply ? 'Drafts only. Review text and replace/check planned date before publication.' : 'Offline dry run. No Directus connection or changes.');
}

if (isMainModule(import.meta.url, process.argv[1])) {
  main().catch(() => {
    // Native request failures may contain response bodies; do not print them.
    console.error('Article import stopped. Check arguments, own-instance URL, credentials and date. No existing article is overwritten.');
    process.exitCode = 1;
  });
}
