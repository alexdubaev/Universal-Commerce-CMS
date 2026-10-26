import { createAtomicOrderHandler } from './orders.mjs';
import { createAtomicLeadHandler } from './leads.mjs';
import { createGuardedVersionSaveHandler, createGuardedVersionPromoteHandler } from './versions.mjs';
import { createGuardedMutationHandler } from './mutations.mjs';
import { createHmac } from "node:crypto";
import { registerStorefrontGateway } from './storefront.mjs';
import { registerStorefrontConfig } from './storefront-config.mjs';

// commerce-search — Directus endpoint extension (zero dependencies).
//
// Registers GET /commerce/search (the extension mounts at /commerce,
// derived from the package.json "name" field; the route below adds /search).
// The endpoint answers SKU/OEM lookups for the Commerce catalog through the
// indexed normalized columns instead of a full catalog scan:
//
//   GET /commerce/search?q=re-5048&page=1&limit=6
//   -> { data: [{id,slug,title,sku,mpn,brand,category:{slug,title}}], meta:{total,page,limit,source} }
//
// Contract:
// - q is required and must normalize (uppercase, trim, strip non-alphanumerics
//   — the same derivation as the backfill migration) to 2..64 characters,
//   otherwise 400;
// - page >= 1 (default 1); limit 1..20 (default 10), otherwise 400;
// - every Directus query carries a bounded positive numeric limit; tier counts
//   use Directus aggregates and rows are limited to the requested page;
// - only published products and only the bounded result fields are returned;
// - product_codes is optional: a missing collection or a failing lookup
//   degrades to normalized-only results instead of breaking the search.

export const ROUTE_PATH = "/search";
export const PREVIEW_ROUTE_PATH = "/preview/:collection/:item";

const PREVIEW_COLLECTIONS = new Set(["articles", "pages", "home_page"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SAFE_VERSION_KEY = /^[\w][\w.-]*$/u;
const PREVIEW_TTL_SECONDS = 15 * 60;

export const DEFAULT_PAGE_LIMIT = 10;
export const MAX_PAGE_LIMIT = 20;
export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 64;
export const MAX_SEARCH_PAGE = 10_000;

/**
 * Maximum optional product_codes lookup window. Native product search does
 * not use a candidate window; its rows come from counted database tiers.
 */
export const CANDIDATE_LIMIT = 200;

export const SEARCH_SORT = ["-popularity_score", "title"];

export const PRODUCT_FIELDS = [
  "id",
  "slug",
  "title",
  "sku",
  "mpn",
  "category.slug",
  "category.title",
  "brand",
];

/**
 * The shared normalization contract: uppercase, trim, and strip every
 * non-alphanumeric character. Identical logic lives in
 * migrations/backfill-product-search.mjs so stored keys and query keys agree.
 */
export function normalizeCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

const parameter = (params, key) => {
  if (!params) return null;
  if (typeof params.get === "function") return params.get(key);
  const value = params[key];
  return value === undefined || value === null ? null : String(value);
};

const parseStrictPositiveInt = (raw) => {
  if (!/^\d+$/.test(raw)) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
};

/**
 * Pure validation of the raw query parameters (accepts an Express req.query
 * object or a URLSearchParams). Returns raw q, normalized code and filters or
 * { ok: false, errors: [{ code, message }] }.
 */
export function parseSearchParameters(params) {
  const errors = [];

  const rawQuery = (parameter(params, "q") ?? "").trim();
  const q = rawQuery;
  const normalized = normalizeCode(rawQuery);
  if (!rawQuery) {
    errors.push({ code: "missing-q", message: "q is required" });
  } else if (rawQuery.length < MIN_QUERY_LENGTH) {
    errors.push({
      code: "invalid-q",
      message: `q must contain at least ${MIN_QUERY_LENGTH} characters`,
    });
  } else if (rawQuery.length > MAX_QUERY_LENGTH) {
    errors.push({
      code: "invalid-q",
      message: `q must contain at most ${MAX_QUERY_LENGTH} characters`,
    });
  }

  const rawPage = parameter(params, "page");
  let page = 1;
  if (rawPage !== null && rawPage !== "") {
    const parsed = parseStrictPositiveInt(rawPage);
    if (parsed === null) {
      errors.push({ code: "invalid-page", message: "page must be an integer >= 1" });
    } else {
      page = parsed;
      if (page > MAX_SEARCH_PAGE) errors.push({ code: "invalid-page", message: `page must be an integer <= ${MAX_SEARCH_PAGE}` });
    }
  }

  const rawLimit = parameter(params, "limit");
  let limit = DEFAULT_PAGE_LIMIT;
  if (rawLimit !== null && rawLimit !== "") {
    const parsed = parseStrictPositiveInt(rawLimit);
    if (parsed === null || parsed > MAX_PAGE_LIMIT) {
      errors.push({
        code: "invalid-limit",
        message: `limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`,
      });
    } else {
      limit = parsed;
    }
  }

  const brand = parameter(params, "brand");
  const category = parameter(params, "category");
  const availability = parameter(params, "availability");
  const partType = parameter(params, "partType");
  const sort = parameter(params, "sort");
  const mode = parameter(params, "mode");
  if (brand !== null && (!brand.trim() || brand.length > 80)) errors.push({ code: "invalid-brand", message: "brand is invalid" });
  if (category !== null && !/^[a-z0-9][a-z0-9-]{0,79}$/i.test(category)) errors.push({ code: "invalid-category", message: "category is invalid" });
  if (availability !== null && !["in_stock", "on_request", "out_of_stock"].includes(availability)) errors.push({ code: "invalid-availability", message: "availability is invalid" });
  if (partType !== null && !["original", "oem", "analog"].includes(partType)) errors.push({ code: "invalid-partType", message: "partType is invalid" });
  if (sort !== null && !["popular", "price_asc", "price_desc", "title"].includes(sort)) errors.push({ code: "invalid-sort", message: "sort is invalid" });
  if (mode !== null && mode !== "suggestions") errors.push({ code: "invalid-mode", message: "mode is invalid" });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, q, normalized, page, limit, brand: brand?.trim() ?? null, category, availability, partType, sort, mode };
}

const assertValidPagination = (page, limit) => {
  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError("page must be an integer >= 1");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_LIMIT) {
    throw new RangeError(`limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`);
  }
};

/**
 * PURE legacy query builder retained for callers that still need the bounded
 * alias lookup payload. The live handler counts and pages product tiers.
 */
export function buildSearchQueries(q, { page = 1, limit = DEFAULT_PAGE_LIMIT } = {}) {
  const normalizedQuery = normalizeCode(q);
  if (normalizedQuery.length < MIN_QUERY_LENGTH || normalizedQuery.length > MAX_QUERY_LENGTH) {
    throw new RangeError(
      `q must normalize to ${MIN_QUERY_LENGTH}..${MAX_QUERY_LENGTH} alphanumeric characters`,
    );
  }
  assertValidPagination(page, limit);

  return {
    products: {
      collection: "products",
      query: {
        filter: {
          status: { _eq: "published" },
          _or: [
            { sku_normalized: { _starts_with: normalizedQuery } },
            { mpn_normalized: { _starts_with: normalizedQuery } },
          ],
        },
        fields: [...PRODUCT_FIELDS],
        sort: [...SEARCH_SORT],
        limit: CANDIDATE_LIMIT,
        page: 1,
      },
    },
    codes: {
      collection: "product_codes",
      query: {
        filter: {
          is_active: { _eq: true },
          normalized_code: { _starts_with: normalizedQuery },
        },
        fields: ["product"],
        limit: CANDIDATE_LIMIT,
        page: 1,
      },
    },
    pagination: { page, limit, offset: (page - 1) * limit },
  };
}

/**
 * PURE merge: dedupes the candidate products (normalized matches first, then
 * code-only matches), reports the merged total, and slices the requested page.
 */
export function mergeSearchResults(
  { productItems = [], codeProductItems = [] } = {},
  { page = 1, limit = DEFAULT_PAGE_LIMIT } = {},
) {
  assertValidPagination(page, limit);

  const seen = new Set();
  const merged = [];
  for (const item of [...productItems, ...codeProductItems]) {
    if (!item || item.id === undefined || item.id === null) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }

  const offset = (page - 1) * limit;
  return {
    data: merged.slice(offset, offset + limit),
    total: merged.length,
    candidateLimitReached: merged.length >= CANDIDATE_LIMIT,
    source: codeProductItems.length > 0 ? "codes" : "normalized",
  };
}

/**
 * Projects a bounded product item onto the endpoint response shape.
 */
export function mapSuggestion(item) {
  return {
    id: item?.id ?? null,
    slug: item?.slug ?? null,
    title: item?.title ?? null,
    sku: item?.sku ?? null,
    mpn: item?.mpn ?? null,
    brand: item?.brand ?? null,
    category: item?.category
      ? {
          slug: item.category.slug ?? null,
          title: item.category.title ?? null,
        }
      : null,
  };
}

const EMPTY_ACCOUNTABILITY = { role: null, user: null, admin: false, app: false };

const isUuid = (value) => typeof value === "string" && UUID_PATTERN.test(value);

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const signPreviewToken = (context, secret, now = Date.now()) => {
  const encoded = Buffer.from(JSON.stringify({
    ...context,
    exp: Math.floor(now / 1000) + PREVIEW_TTL_SECONDS,
  }), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
};

const previewForm = (consumeUrl, token) => `<!doctype html>
<html><head><meta charset="utf-8"><title>Live Preview</title></head>
<body><form method="post" action="${escapeHtml(consumeUrl)}"><input type="hidden" name="token" value="${escapeHtml(token)}"></form><script>document.forms[0].submit()</script></body></html>`;

/**
 * Returns an auto-posting form for an authenticated Studio user. Directus
 * validates the current user's access before the signature is minted; Next.js
 * validates it again before it sets the httpOnly draft cookie.
 */
export function createPreviewHandler(context) {
  const { services, database, getSchema, logger, env = process.env } = context ?? {};

  return async function previewHandler(req, res) {
    if (!req?.accountability?.user) {
      res.status(403).send("Forbidden");
      return;
    }
    const collection = req.params?.collection;
    const item = req.params?.item;
    const versionKey = req.query?.version;
    if (
      !PREVIEW_COLLECTIONS.has(collection) ||
      !isUuid(item) ||
      typeof versionKey !== "string" ||
      !SAFE_VERSION_KEY.test(versionKey)
    ) {
      res.status(404).send("Not found");
      return;
    }
    const secret = env.PREVIEW_SECRET;
    const consumeUrl = env.NEXT_PREVIEW_CONSUME_URL;
    let destination;
    try {
      destination = new URL(consumeUrl);
    } catch {
      res.status(503).send("Preview unavailable");
      return;
    }
    const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    const isLoopbackHttp =
      destination.protocol === "http:" && loopbackHosts.has(destination.hostname);
    if ((destination.protocol !== "https:" && !isLoopbackHttp) || !secret) {
      res.status(503).send("Preview unavailable");
      return;
    }

    try {
      const schema = await getSchema();
      const versions = new services.ItemsService("directus_versions", {
        schema,
        accountability: req.accountability,
        knex: database,
      });
      const rows = await versions.readByQuery({
        filter: {
          collection: { _eq: collection },
          item: { _eq: item },
          key: { _eq: versionKey },
        },
        fields: ["id", "key", "collection", "item"],
        limit: 1,
      });
      const version = rows?.[0];
      if (
        !isUuid(version?.id) ||
        version?.key !== versionKey ||
        version?.collection !== collection ||
        version?.item !== item
      ) {
        res.status(404).send("Not found");
        return;
      }
      const token = signPreviewToken({
        collection,
        id: item,
        version: version.id,
        versionKey,
      }, secret);
      res.set({
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": `default-src 'none'; script-src 'unsafe-inline'; form-action ${destination.origin}; base-uri 'none'; frame-ancestors 'self'`,
      }).status(200).send(previewForm(destination.toString(), token));
    } catch (error) {
      logger?.error?.(`commerce preview bridge failed: ${error?.message ?? error}`);
      res.status(503).send("Preview unavailable");
    }
  };
}

/**
 * Builds the Express route handler from the Directus endpoint context
 * ({ services, database, getSchema, logger }). Separated from the register
 * function so tests can drive it with mocked services.
 */
export function createSearchHandler(context) {
  const { services, database, getSchema, logger } = context ?? {};

  return async function searchHandler(req, res) {
    const parameters = parseSearchParameters(req?.query);
    if (!parameters.ok) {
      res.status(400).json({ errors: parameters.errors });
      return;
    }

    try {
      const schema = await getSchema();
      const serviceOptions = {
        schema,
        // NEVER default to null accountability: null means admin bypass in
        // Directus. A request without accountability behaves as public.
        accountability: req?.accountability ?? EMPTY_ACCOUNTABILITY,
        knex: database,
      };
      const productsService = new services.ItemsService("products", serviceOptions);
      const base = [{ status: { _eq: "published" } }];
      if (parameters.brand) base.push({ brand: { _eq: parameters.brand } });
      if (parameters.category) base.push({ category: { slug: { _eq: parameters.category } } });
      if (parameters.availability) base.push({ availability_status: { _eq: parameters.availability } });
      if (parameters.partType) base.push({ part_type: { _eq: parameters.partType } });
      if (context.forcePublishedCategory === true) base.push({ _or: [{ category: { _null: true } }, { category: { status: { _eq: "published" } } }] });
      const and = (...conditions) => ({ _and: [...base, ...conditions] });
      const codePrefix = parameters.normalized ? { _or: [
        { sku_normalized: { _starts_with: parameters.normalized } },
        { mpn_normalized: { _starts_with: parameters.normalized } },
      ] } : null;
      const titleMatch = { title: { _icontains: parameters.q } };
      const brandMatch = { brand: { _icontains: parameters.q } };
      const sortMap = { popular: [...SEARCH_SORT, "id"], price_asc: ["price", "title", "id"], price_desc: ["-price", "title", "id"], title: ["title", "id"] };
      let rows = [];
      let total = 0;
      let partial = false;
      let source = "normalized";
      const explicitSort = Boolean(parameters.sort && parameters.sort !== "popular");
      if (explicitSort) {
        const match = codePrefix ? { _or: [codePrefix._or[0], codePrefix._or[1], titleMatch, brandMatch] } : { _or: [titleMatch, brandMatch] };
        const filter = and(match);
        const counts = await productsService.readByQuery({ filter, aggregate: { count: ["id"] }, limit: 1 });
        total = Number(counts?.[0]?.count?.id ?? 0);
        rows = await productsService.readByQuery({ filter, fields: [...PRODUCT_FIELDS], sort: sortMap[parameters.sort], limit: parameters.limit, page: parameters.page });
      } else {
        const excluded = (field, value) => ({ _or: [{ [field]: { _null: true } }, { [field]: { _neq: value } }] });
        const tiers = [];
        if (parameters.normalized) {
          tiers.push(and({ sku_normalized: { _eq: parameters.normalized } }));
          tiers.push(and({ mpn_normalized: { _eq: parameters.normalized } }, excluded("sku_normalized", parameters.normalized)));
          tiers.push(and({ _or: [...codePrefix._or, titleMatch, brandMatch] }, excluded("sku_normalized", parameters.normalized), excluded("mpn_normalized", parameters.normalized)));
        } else tiers.push(and({ _or: [titleMatch, brandMatch] }));
        const counts = await Promise.all(tiers.map(filter => productsService.readByQuery({ filter, aggregate: { count: ["id"] }, limit: 1 })));
        const totals = counts.map(result => Number(result?.[0]?.count?.id ?? 0));
        total = totals.reduce((sum, count) => sum + count, 0);
        let offset = (parameters.page - 1) * parameters.limit;
        let remaining = parameters.limit;
        for (let index = 0; index < tiers.length && remaining > 0; index++) {
          if (offset >= totals[index]) { offset -= totals[index]; continue; }
          const size = Math.min(remaining, totals[index] - offset);
          const result = await productsService.readByQuery({ filter: tiers[index], fields: [...PRODUCT_FIELDS], sort: [...SEARCH_SORT, "id"], limit: size, page: 1, offset });
          rows.push(...(result ?? []));
          remaining -= size;
          offset = 0;
        }
      }
      const baseTotal = total;
      const aliasEnabled = (context.env ?? process.env).COMMERCE_ENABLE_ADDITIONAL_CODES === "true"
        && Boolean(schema?.collections?.product_codes) && Boolean(parameters.normalized);
      if (aliasEnabled) {
        try {
          const codesService = new services.ItemsService("product_codes", serviceOptions);
          const codeFilter = { is_active: { _eq: true }, normalized_code: { _starts_with: parameters.normalized } };
          const countedCodes = await codesService.readByQuery({ filter: codeFilter, aggregate: { count: ["id"] }, limit: 1 });
          const codeCount = Number(countedCodes?.[0]?.count?.id ?? 0);
          const codeRows = await codesService.readByQuery({ filter: codeFilter, fields: ["product"], sort: ["product"], limit: CANDIDATE_LIMIT, page: 1 });
          const aliasIds = [...new Set((codeRows ?? []).map(row => row?.product).filter(Boolean))];
          partial = codeCount > (codeRows ?? []).length;
          const aliasItems = aliasIds.length ? await productsService.readByQuery({ filter: and({ id: { _in: aliasIds } }), fields: [...PRODUCT_FIELDS, "sku_normalized", "mpn_normalized"], sort: [...SEARCH_SORT, "id"], limit: aliasIds.length, page: 1 }) : [];
          const textQuery = parameters.q.toLocaleLowerCase();
          const eligibleItems = (aliasItems ?? []).filter(item => {
            const nativeCodeMatch = [item?.sku_normalized, item?.mpn_normalized].some(value => String(value ?? "").startsWith(parameters.normalized));
            const nativeTextMatch = [item?.title, item?.brand].some(value => String(value ?? "").toLocaleLowerCase().includes(textQuery));
            return !nativeCodeMatch && !nativeTextMatch;
          });
          const eligibleAliasIds = [...new Set(eligibleItems.map(item => item?.id).filter(Boolean))];
          if (eligibleAliasIds.length) source = "codes";
          total += eligibleAliasIds.length;
          const start = (parameters.page - 1) * parameters.limit;
          const offset = Math.max(0, start - baseTotal);
          const baseItemsInPage = Math.max(0, Math.min(parameters.limit, baseTotal - start));
          const aliasSlots = parameters.limit - baseItemsInPage;
          const selectedIds = eligibleAliasIds.slice(offset, offset + aliasSlots);
          if (selectedIds.length) {
            const itemById = new Map(eligibleItems.map(item => [String(item.id), item]));
            rows.push(...selectedIds.map(id => itemById.get(String(id))).filter(Boolean));
          }
        } catch (error) {
          partial = true;
          logger?.warn?.(`commerce-search: additional-code lookup failed: ${error?.message ?? error}`);
        }
      }
      const data = (rows ?? []).map(mapSuggestion);

      res.json({
        data,
        meta: {
          total,
          page: parameters.page,
          limit: parameters.limit,
          source,
          ...(partial ? { partial: true } : {}),
        },
      });
    } catch (error) {
      const forbidden = error?.code === "FORBIDDEN";
      logger?.error?.(
        `commerce-search: search failed: ${error?.message ?? error}`,
      );
      res
        .status(forbidden ? 403 : 500)
        .json({ error: forbidden ? "forbidden" : "search_failed" });
    }
  };
}

/**
 * Directus endpoint entrypoint: mounts GET /search on the scoped router the
 * extension manager provides. Plain function export (no SDK helpers needed —
 * the bundle is dependency-free by design).
 */
export default function registerSearchEndpoint(router, context) {
  registerStorefrontConfig(router, context);
  registerStorefrontGateway(router, context);
  router.post("/mutations/:collection/:id", createGuardedMutationHandler(context));
  router.post("/orders", createAtomicOrderHandler(context));
  router.post("/leads", createAtomicLeadHandler(context));
  router.post("/versions/:id/save", createGuardedVersionSaveHandler(context));
  router.post("/versions/:id/promote", createGuardedVersionPromoteHandler(context));
  router.get(ROUTE_PATH, createSearchHandler(context));
  router.get(PREVIEW_ROUTE_PATH, createPreviewHandler(context));
}
