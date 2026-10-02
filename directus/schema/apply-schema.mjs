import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { schemaBlueprint } from "./blueprint.mjs";

const interfaceByType = {
  alias: "list-o2m",
  boolean: "boolean",
  decimal: "input",
  integer: "input",
  json: "input-code",
  string: "input",
  text: "input-multiline",
  timestamp: "datetime",
  uuid: "input",
};

const specialForField = (field) => {
  if (field.special) return field.special;
  if (field.type === "alias") {
    return [field.interface === "list-m2m" ? "m2m" : "o2m"];
  }
  if (field.relatedCollection) return ["m2o"];
  if (field.type === "json") return ["cast-json"];
  if (field.type === "uuid" && field.primary) return ["uuid"];
  return null;
};

const optionsForField = (field) => {
  if (field.choices) {
    return {
      choices: field.choices.map((value) => ({
        text: String(value).replaceAll("_", " "),
        value,
      })),
    };
  }
  if (field.type === "json") return { language: "json" };
  if (field.interface === "translations") {
    return { languageField: "languages_code" };
  }
  return null;
};

export function buildFieldPayload(field) {
  const isAlias = field.type === "alias";
  const payload = {
    field: field.name,
    type: field.type,
    meta: {
      interface:
        field.interface ??
        (field.relatedCollection
          ? "select-dropdown-m2o"
          : interfaceByType[field.type]),
      special: specialForField(field),
      options: optionsForField(field),
      readonly: field.readonly ?? false,
      required: field.required ?? false,
      hidden: field.hidden ?? false,
      width: "full",
    },
    schema: isAlias
      ? null
      : {
          is_primary_key: field.primary ?? false,
          is_nullable: !(field.required ?? false),
          // Product identity migration owns the old single-SKU unique index.
          // Generic schema setup must neither recreate it nor remove it early.
          ...(field.identityManagedUnique ? {} : { is_unique: field.unique ?? false }),
          is_indexed: field.index ?? field.primary ?? false,
          default_value:
            field.default === "uuid" ? null : (field.default ?? null),
          max_length: field.maxLength ?? null,
          numeric_precision: field.precision ?? null,
          numeric_scale: field.scale ?? null,
        },
  };

  return payload;
}

export function buildCollectionPayload(collection) {
  if (collection.folder) {
    return {
      collection: collection.name,
      meta: {
        icon: collection.icon ?? "folder",
        hidden: false,
        singleton: false,
        sort: collection.sort ?? null,
      },
      schema: null,
    };
  }

  const primary = collection.fields.find((field) => field.primary);
  if (!primary) {
    throw new Error(`Collection ${collection.name} has no primary field`);
  }

  const status = collection.fields.find((field) => field.name === "status");
  const canArchive =
    !collection.singleton &&
    status?.choices?.includes("archived") &&
    status?.choices?.includes("draft");
  return {
    collection: collection.name,
    meta: {
      icon: collection.icon ?? "database",
      hidden: collection.hidden ?? false,
      singleton: collection.singleton ?? false,
      // Versioning is deliberately opt-in. Omitting the key for all other
      // collections prevents schema reconciliation from changing their
      // existing Directus content-versioning state.
      ...(collection.versioning === true ? { versioning: true } : {}),
      archive_field: canArchive ? "status" : null,
      archive_value: canArchive ? "archived" : null,
      unarchive_value: canArchive ? "draft" : null,
      archive_app_filter: Boolean(canArchive),
      sort_field:
        collection.fields.some(({ name }) => name === "sort_order")
          ? "sort_order"
          : null,
    },
    schema: { name: collection.name },
    fields: [buildFieldPayload(primary)],
  };
}

export function buildRelationPayload(collectionName, field, junctionFields = []) {
  if (!field.relatedCollection) {
    throw new Error(`${collectionName}.${field.name} is not relational`);
  }

  return {
    collection: collectionName,
    field: field.name,
    related_collection: field.relatedCollection,
    meta: {
      one_field: field.oneField ?? null,
      one_deselect_action: field.translationRelation ? "delete" : "nullify",
      junction_field: field.junctionField ?? null,
      // A dangling sort_field (column absent from the junction, e.g.
      // products_analogs) breaks every fields=* read of the parent with a
      // 403 "field does not exist" — only reference sort_order when the
      // junction collection actually declares it.
      sort_field:
        field.oneField && junctionFields.includes("sort_order")
          ? "sort_order"
          : null,
    },
    schema: {
      on_update: "NO ACTION",
      on_delete:
        field.onDelete ?? (field.required ? "NO ACTION" : "SET NULL"),
    },
  };
}

export function isMainModule(moduleUrl, argvPath, cwd = process.cwd()) {
  if (!argvPath) return false;
  return fileURLToPath(moduleUrl) === resolve(cwd, argvPath);
}

export class DirectusAdminClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  static async connectFromEnvironment() {
    const baseUrl = process.env.DIRECTUS_URL ?? "http://127.0.0.1:18056";
    if (process.env.DIRECTUS_TOKEN) {
      return new DirectusAdminClient(baseUrl, process.env.DIRECTUS_TOKEN);
    }

    const email =
      process.env.DIRECTUS_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL;
    const password =
      process.env.DIRECTUS_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error(
        "Set DIRECTUS_TOKEN or DIRECTUS_ADMIN_EMAIL/DIRECTUS_ADMIN_PASSWORD",
      );
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      throw new Error(`Directus login failed with HTTP ${response.status}`);
    }
    const body = await response.json();
    return new DirectusAdminClient(baseUrl, body.data.access_token);
  }

  async request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        `${options.method ?? "GET"} ${path} failed: HTTP ${response.status} ${message}`,
      );
    }
    if (response.status === 204) return null;
    return (await response.json()).data;
  }
}

const relationKey = (collection, field) => `${collection}.${field}`;

export async function applyBlueprint(client, blueprint, { dryRun = false } = {}) {
  const actions = [];
  const currentCollections = await client.request("/collections");
  const collectionNames = new Set(
    currentCollections.map(({ collection }) => collection),
  );

  for (const collection of blueprint.collections) {
    if (!collectionNames.has(collection.name)) {
      actions.push(`create collection ${collection.name}`);
      if (!dryRun) {
        await client.request("/collections", {
          method: "POST",
          body: JSON.stringify(buildCollectionPayload(collection)),
        });
      }
    }
  }

  for (const collection of blueprint.collections) {
    if (collection.folder) continue;
    const currentFields = collectionNames.has(collection.name) || !dryRun
      ? await client.request(`/fields/${collection.name}`)
      : [];
    const fieldsByName = new Map(
      currentFields.map((item) => [item.field, item]),
    );

    for (const field of collection.fields) {
      if (field.primary) continue;
      const current = fieldsByName.get(field.name);
      if (current) {
        if (current.type !== field.type) {
          throw new Error(
            `Refusing to change ${collection.name}.${field.name} from ${current.type} to ${field.type}`,
          );
        }
        if (
          field.relaxNullable === true &&
          (current.schema?.is_nullable === false || current.meta?.required === true)
        ) {
          actions.push(`relax nullable field ${collection.name}.${field.name}`);
          if (!dryRun) {
            await client.request(`/fields/${collection.name}/${field.name}`, {
              method: "PATCH",
              body: JSON.stringify({
                schema: { is_nullable: true },
                meta: { required: false },
              }),
            });
          }
        }
        continue;
      }

      actions.push(`create field ${collection.name}.${field.name}`);
      if (!dryRun) {
        await client.request(`/fields/${collection.name}`, {
          method: "POST",
          body: JSON.stringify(buildFieldPayload(field)),
        });
      }
    }
  }

  // Existing databases can retain metadata generated by older releases.
  // Reconcile only our archive controls after any missing status field exists.
  const archiveKeys = ["archive_field", "archive_value", "unarchive_value", "archive_app_filter"];
  for (const collection of blueprint.collections) {
    if (collection.folder) continue;
    const current = currentCollections.find((item) => item.collection === collection.name);
    if (!current) continue;
    const desired = buildCollectionPayload(collection).meta;
    if (archiveKeys.every((key) => (current.meta?.[key] ?? null) === desired[key])) continue;
    const meta = Object.fromEntries(archiveKeys.map((key) => [key, desired[key]]));
    actions.push(`update archive metadata ${collection.name}`);
    if (!dryRun) {
      await client.request(`/collections/${collection.name}`, {
        method: "PATCH",
        body: JSON.stringify({ meta }),
      });
    }
  }

  // Content versioning is an explicit, opt-in capability. Reconcile only
  // collections that declare it, leaving every other collection's metadata
  // untouched (including an operator-managed true/false value).
  for (const collection of blueprint.collections) {
    if (collection.folder || collection.versioning !== true) continue;
    const current = currentCollections.find((item) => item.collection === collection.name);
    if (!current || current.meta?.versioning === true) continue;
    actions.push(`enable versioning ${collection.name}`);
    if (!dryRun) {
      await client.request(`/collections/${collection.name}`, {
        method: "PATCH",
        body: JSON.stringify({ meta: { versioning: true } }),
      });
    }
  }

  const currentRelations = await client.request("/relations");
  const relationNames = new Set(
    currentRelations.map(({ collection, field }) =>
      relationKey(collection, field),
    ),
  );

  for (const collection of blueprint.collections) {
    if (collection.folder) continue;
    for (const field of collection.fields) {
      if (!field.relatedCollection) continue;
      // Alias fields have no DB column, so posting their relation side makes
      // Directus generate a foreign key on a non-existent column (production
      // R7 lesson). The alias side is registered automatically when the
      // junction-side M2O carries meta.one_field, and /relations never lists
      // the alias side as its own row — skip it instead of POSTing.
      if (field.type === "alias") continue;
      const key = relationKey(collection.name, field.name);
      if (relationNames.has(key)) continue;

      actions.push(`create relation ${key} -> ${field.relatedCollection}`);
      if (!dryRun) {
        await client.request("/relations", {
          method: "POST",
          body: JSON.stringify(
            buildRelationPayload(
              collection.name,
              field,
              collection.fields.map(({ name }) => name),
            ),
          ),
        });
      }
    }
  }

  for (const [collection, items] of Object.entries(blueprint.seed)) {
    const isSingleton = blueprint.collections.some(
      (item) => item.name === collection && item.singleton,
    );
    for (const item of items) {
      if (dryRun && !collectionNames.has(collection)) {
        actions.push(`seed ${collection}.${isSingleton ? "singleton" : item.code ?? item.id}`);
        continue;
      }
      if (isSingleton) {
        const existingSingleton = await client.request(`/items/${collection}`);
        if (existingSingleton?.id) continue;
        actions.push(`seed ${collection}.singleton`);
        if (!dryRun) {
          await client.request(`/items/${collection}`, {
            method: "PATCH",
            body: JSON.stringify(item),
          });
        }
        continue;
      }
      const primaryField = item.code !== undefined ? "code" : item.slug !== undefined ? "slug" : "id";
      const primary = item[primaryField];
      const query = new URLSearchParams({
        [`filter[${primaryField}][_eq]`]: String(primary),
        limit: "1",
        fields: primaryField,
      });
      const existing = await client.request(
        `/items/${collection}?${query.toString()}`,
      );
      if (existing.length > 0) continue;

      actions.push(`seed ${collection}.${primary}`);
      if (!dryRun) {
        await client.request(`/items/${collection}`, {
          method: "POST",
          body: JSON.stringify(item),
        });
      }
    }
  }

  return actions;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const client = await DirectusAdminClient.connectFromEnvironment();
  const actions = await applyBlueprint(client, schemaBlueprint, { dryRun });

  if (actions.length === 0) {
    console.log("Schema is already up to date.");
    return;
  }

  console.log(`${dryRun ? "Planned" : "Applied"} ${actions.length} actions:`);
  for (const action of actions) console.log(`- ${action}`);
}

if (isMainModule(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
