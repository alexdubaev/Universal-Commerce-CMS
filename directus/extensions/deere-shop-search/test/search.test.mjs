import test from "node:test";
import assert from "node:assert/strict";

import {
  CANDIDATE_LIMIT,
  createSearchHandler,
  mapSuggestion,
} from "../src/index.js";

// ---------------------------------------------------------------------------
// Mocked Directus endpoint context (no live Directus)
// ---------------------------------------------------------------------------

const productItem = (id, overrides = {}) => ({
  id,
  slug: `product-${id}`,
  title: `Товар ${id}`,
  sku: `SKU${id}`,
  mpn: null,
  category: { slug: "engine", title: "Двигатель" },
  ...overrides,
});

const createMockContext = ({ products, codeRows, collections, codesFail = false } = {}) => {
  const queries = [];
  const warnings = [];
  const serviceInstances = [];

  class MockItemsService {
    constructor(collection, options) {
      this.collection = collection;
      this.options = options;
      serviceInstances.push({ collection, options });
    }

    async readByQuery(query) {
      queries.push({ collection: this.collection, query });
      if (this.collection === "products") return products ?? [];
      if (codesFail) {
        const error = new Error("permission denied");
        error.code = "FORBIDDEN";
        throw error;
      }
      return codeRows ?? [];
    }
  }

  return {
    context: {
      services: { ItemsService: MockItemsService },
      database: { mock: "knex" },
      getSchema: async () => ({
        collections: Object.fromEntries(
          (collections ?? ["products", "product_codes"]).map((name) => [name, {}]),
        ),
      }),
      logger: {
        warn: (message) => warnings.push(message),
        error: () => {},
      },
    },
    queries,
    warnings,
    serviceInstances,
  };
};

const mockRequest = (query = {}, accountability = { role: "public-role" }) => ({
  query,
  accountability,
});

const mockResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return response;
};

const handlerOf = async (context, query) => {
  const response = mockResponse();
  await createSearchHandler(context)(mockRequest(query), response);
  return response;
};

const positiveLimits = (queries) =>
  queries.map(({ query }) => query.limit);

test("handler answers with merged, deduped, paginated suggestions", async () => {
  const products = [productItem("a"), productItem("c")];
  const codeRows = [{ product: "c" }, { product: "d" }, { product: "a" }, { product: null }];
  const { context, queries } = createMockContext({ products, codeRows });

  // "c" is matched by both sources but hydrated once; "d" is fetched by id.
  const hydrated = new Map([
    ["a", products[0]],
    ["c", products[1]],
    ["d", productItem("d")],
  ]);
  context.services.ItemsService = class extends context.services.ItemsService {
    async readByQuery(query) {
      const call = { collection: this.collection, query };
      queries.push(call);
      if (this.collection === "product_codes") return codeRows;
      if (query.filter?.id?._in) {
        return query.filter.id._in.map((id) => hydrated.get(id)).filter(Boolean);
      }
      return products;
    }
  };

  const response = await handlerOf(context, { q: "RE", limit: "2" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.data.map(({ id }) => id), ["a", "c"]);
  assert.deepEqual(response.body.meta, { total: 3, page: 1, limit: 2, source: "codes" });
  assert.deepEqual(
    response.body.data[0],
    mapSuggestion(products[0]),
  );

  // The by-ids hydration query filters published products and stays bounded.
  const byIds = queries.find(({ query }) => query.filter?.id?._in);
  assert.ok(byIds, "products matched via codes are hydrated through a bounded by-id query");
  assert.deepEqual(byIds.query.filter.id._in, ["c", "d", "a"]);
  assert.deepEqual(byIds.query.filter.status, { _eq: "published" });
  assert.equal(byIds.query.limit, CANDIDATE_LIMIT);
});

test("handler never issues an unbounded readByQuery (limit=-1 is forbidden)", async () => {
  const { context, queries } = createMockContext({
    products: [productItem("a")],
    codeRows: [{ product: "b" }],
  });
  const response = await handlerOf(context, { q: "RE" });

  assert.equal(response.statusCode, 200);
  assert.ok(queries.length >= 2, "products + codes queries were issued");
  for (const limit of positiveLimits(queries)) {
    assert.ok(
      Number.isInteger(limit) && limit >= 1 && limit <= CANDIDATE_LIMIT,
      `every readByQuery limit must be a bounded positive integer, got ${limit}`,
    );
    assert.notEqual(limit, -1);
  }
});

test("handler returns 400 for an invalid query", async () => {
  const { context, queries } = createMockContext();
  const response = await handlerOf(context, { q: "-" });

  assert.equal(response.statusCode, 400);
  assert.ok(response.body.errors.some(({ code }) => code === "invalid-q"));
  assert.equal(queries.length, 0, "no service query is issued for invalid input");

  const badLimit = await handlerOf(context, { q: "RE50", limit: "50" });
  assert.equal(badLimit.statusCode, 400);
  assert.ok(badLimit.body.errors.some(({ code }) => code === "invalid-limit"));
});

test("handler skips product_codes when the collection is absent", async () => {
  const { context, queries } = createMockContext({
    products: [productItem("a")],
    collections: ["products"],
  });
  const response = await handlerOf(context, { q: "RE" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.meta.source, "normalized");
  assert.deepEqual(
    queries.map(({ collection }) => collection),
    ["products"],
    "no product_codes query is issued when the collection is missing",
  );
});

test("handler degrades to normalized results when product_codes fails", async () => {
  const { context, queries, warnings } = createMockContext({
    products: [productItem("a")],
    codeRows: [{ product: "b" }],
    codesFail: true,
  });
  const response = await handlerOf(context, { q: "RE" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.meta.source, "normalized");
  assert.deepEqual(response.body.data.map(({ id }) => id), ["a"]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /product_codes lookup failed/);
});

test("handler never defaults to admin accountability", async () => {
  const { context, serviceInstances } = createMockContext({
    products: [productItem("a")],
    codeRows: [],
  });
  await handlerOf(context, { q: "RE" });

  for (const { options } of serviceInstances) {
    assert.ok(options.accountability, "accountability is always set");
    assert.notEqual(options.accountability, null);
    assert.notEqual(options.accountability.admin, true);
  }

  // A request without accountability (middleware regression) stays public —
  // null accountability would mean an admin bypass in Directus.
  const { context: bareContext, serviceInstances: bareInstances } =
    createMockContext({ products: [productItem("a")] });
  await createSearchHandler(bareContext)(
    { query: { q: "RE" } },
    mockResponse(),
  );
  for (const { options } of bareInstances) {
    assert.deepEqual(options.accountability, {
      role: null,
      user: null,
      admin: false,
      app: false,
    });
  }
});
