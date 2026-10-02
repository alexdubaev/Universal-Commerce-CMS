import { isMainModule, DirectusAdminClient } from "./apply-schema.mjs";
import { productEditorBlueprint } from "./product-editor-blueprint.mjs";
import { isDeepStrictEqual } from "node:util";

const ru = (translation) => [{ language: "ru-RU", translation }];
const metaKeys = ["translations", "interface", "options", "hidden", "readonly", "required", "display", "display_options", "group", "sort", "width", "note", "special"];

const same = (current, desired) => isDeepStrictEqual(current ?? null, desired ?? null);

function desiredMeta(config) {
  const meta = { translations: ru(config.label) };
  for (const key of metaKeys) {
    if (key === "translations" || config[key] === undefined) continue;
    meta[key] = config[key];
  }
  return meta;
}

function groupMeta(name, config) {
  return {
    ...desiredMeta({ ...config, width: "full" }),
    interface: config.interface ?? "group-accordion",
    options: config.options,
    special: ["alias", "no-data", "group"],
  };
}

function relationMatches(row, expected) {
  return row.collection === expected.collection &&
    row.field === expected.field &&
    row.related_collection === expected.related_collection &&
    (row.meta?.one_field ?? row.meta?.oneField ?? row.one_field) === expected.one_field;
}

async function readSnapshot(client, blueprint) {
  const collections = await client.request("/collections");
  const names = new Set(collections.map(({ collection }) => collection));
  for (const collection of blueprint.collections) {
    if (!names.has(collection)) throw new Error(`missing collection ${collection}`);
  }

  const fields = {};
  const collectionMeta = {};
  for (const collection of blueprint.collections) {
    fields[collection] = await client.request(`/fields/${encodeURIComponent(collection)}`);
    collectionMeta[collection] = await client.request(`/collections/${encodeURIComponent(collection)}`);
  }
  const relations = await client.request("/relations");

  for (const [collection, expectedFields] of Object.entries(blueprint.schema)) {
    const actual = new Map(fields[collection].map((row) => [row.field, row]));
    for (const [name, expected] of Object.entries(expectedFields)) {
      const row = actual.get(name);
      if (!row) throw new Error(`missing field ${collection}.${name}`);
      if (row.type !== expected.type) {
        throw new Error(`incompatible type ${collection}.${name}: expected ${expected.type}, found ${row.type}`);
      }
      if (expected.relatedCollection) {
        const relation = relations.find((candidate) =>
          candidate.collection === collection && candidate.field === name &&
          candidate.related_collection === expected.relatedCollection,
        );
        if (!relation) throw new Error(`missing relation ${collection}.${name} -> ${expected.relatedCollection}`);
      }
    }
  }
  for (const expected of blueprint.relations) {
    if (!relations.some((row) => relationMatches(row, expected))) {
      throw new Error(`incompatible relation ${expected.collection}.${expected.field} -> ${expected.related_collection}.${expected.one_field}`);
    }
  }
  return { fields, collectionMeta };
}

/**
 * Apply only Directus presentation metadata for the product editing forms.
 * The complete collection/field/relation snapshot and compatibility checks
 * finish before the first write; this function never writes item or schema data.
 * CLI: set DIRECTUS_URL to this repository's loopback dev instance and run
 * `npm run product-editor:setup -- --apply` from directus/.
 */
export async function applyProductEditorBlueprint(
  client,
  { dryRun = false, blueprint = productEditorBlueprint, publicFolderId } = {},
) {
  if (publicFolderId !== undefined && (typeof publicFolderId !== "string" || !publicFolderId.trim())) {
    throw new Error("publicFolderId must be a non-empty Directus folder ID");
  }
  if (publicFolderId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(publicFolderId)) {
    throw new Error("publicFolderId must be a UUID");
  }
  const targetBlueprint = structuredClone(blueprint);
  if (publicFolderId) {
    const folder = await client.request(`/folders/${encodeURIComponent(publicFolderId)}`);
    if (folder?.id !== publicFolderId) throw new Error("publicFolderId does not identify an existing Directus folder");
    for (const [collection, names] of Object.entries({ products: ["main_image", "og_image"], product_images: ["image"] })) {
      for (const name of names) targetBlueprint.fields[collection].fields[name].options = { ...(targetBlueprint.fields[collection].fields[name].options ?? {}), folder: publicFolderId };
    }
    const fileField = targetBlueprint.fields.products.fields.documents.options.fields.find((field) => field.field === "file");
    if (!fileField) throw new Error("products.documents must define a file child field");
    fileField.meta.options = { ...(fileField.meta.options ?? {}), folder: publicFolderId };
  }
  const snapshot = await readSnapshot(client, targetBlueprint);
  const actions = [];
  const writes = [];

  for (const [collection, layout] of Object.entries(targetBlueprint.fields)) {
    const currentRows = new Map(snapshot.fields[collection].map((row) => [row.field, row]));
    for (const [name, config] of Object.entries(layout.groups ?? {})) {
      const meta = groupMeta(name, config);
      const current = currentRows.get(name);
      const path = `/fields/${encodeURIComponent(collection)}/${encodeURIComponent(name)}`;
      if (!current) {
        actions.push(`create group ${collection}.${name}`);
        writes.push({ path: `/fields/${encodeURIComponent(collection)}`, method: "POST", body: {
          field: name,
          type: "alias",
          schema: null,
          meta,
        } });
      } else if (current.type !== "alias") {
        throw new Error(`incompatible group alias ${collection}.${name}`);
      } else if (!Object.entries(meta).every(([key, value]) => same(current.meta?.[key], value))) {
        actions.push(`update group ${collection}.${name}`);
        writes.push({ path, method: "PATCH", body: { meta } });
      }
    }

    for (const [name, config] of Object.entries(layout.fields ?? {})) {
      const current = currentRows.get(name);
      // All data fields were checked by readSnapshot before this loop.
      const meta = desiredMeta(config);
      if (Object.entries(meta).every(([key, value]) => same(current.meta?.[key], value))) continue;
      actions.push(`update field ${collection}.${name}`);
      writes.push({
        path: `/fields/${encodeURIComponent(collection)}/${encodeURIComponent(name)}`,
        method: "PATCH",
        body: { meta },
      });
    }
  }

  for (const collection of targetBlueprint.collections) {
    const current = snapshot.collectionMeta[collection];
    const meta = { ...(current.meta ?? {}), hidden: true, translations: ru(collection === "products" ? "Товары" : "Фотографии товаров") };
    if (!same(current.meta?.translations, meta.translations) || current.meta?.hidden !== true) {
      actions.push(`translate collection ${collection}`);
      writes.push({ path: `/collections/${encodeURIComponent(collection)}`, method: "PATCH", body: { meta } });
    }
  }

  if (!dryRun) {
    for (const write of writes) {
      await client.request(write.path, {
        method: write.method,
        body: JSON.stringify(write.body),
      });
    }
  }
  return { actions };
}

async function clientFromTestEnvironment() {
  const rawUrl = process.env.DIRECTUS_URL ?? "http://127.0.0.1:18056";
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "18056" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("DIRECTUS_URL must target this project's local http://127.0.0.1:18056 instance");
  }
  if (process.env.DIRECTUS_TOKEN) {
    return new DirectusAdminClient(url.toString(), process.env.DIRECTUS_TOKEN);
  }

  const email = process.env.DIRECTUS_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL;
  const password = process.env.DIRECTUS_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set DIRECTUS_ADMIN_EMAIL/DIRECTUS_ADMIN_PASSWORD or DIRECTUS_TOKEN in dev/.env");
  const response = await fetch(`${url.toString().replace(/\/$/, "")}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Directus login failed with HTTP ${response.status}`);
  const payload = await response.json();
  return new DirectusAdminClient(url.toString(), payload.data.access_token);
}

async function main() {
  const dryRun = !process.argv.includes("--apply") || process.argv.includes("--dry-run");
  const publicFolderId = process.env.DIRECTUS_PUBLIC_ASSETS_FOLDER_ID;
  const result = await applyProductEditorBlueprint(await clientFromTestEnvironment(), { dryRun, ...(publicFolderId ? { publicFolderId } : {}) });
  console.log(`${dryRun ? "Planned" : "Applied"} ${result.actions.length} product-editor metadata actions:`);
  for (const action of result.actions) console.log(`- ${action}`);
}

if (isMainModule(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
