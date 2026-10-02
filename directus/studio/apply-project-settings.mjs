import { DirectusAdminClient, isMainModule } from "../schema/apply-schema.mjs";
import { commerceProfile } from "../../profiles/commerce/profile.mjs";

const PROJECT_NAME = "Universal Commerce CMS";
const PROJECT_COLOR = "#3B5B7A";
const PRODUCT_EDITOR_MODULE = Object.freeze({
  type: "module",
  id: "product-editor",
  enabled: true,
});

// Directus 12.1.1 app default, confirmed in the installed app bundle's module-bar config.
const DIRECTUS_DEFAULT_MODULE_BAR = Object.freeze([
  { type: "module", id: "content", enabled: true },
  { type: "module", id: "visual", enabled: false },
  { type: "module", id: "users", enabled: true },
  { type: "module", id: "files", enabled: true },
  { type: "module", id: "insights", enabled: true },
  { type: "module", id: "deployments", enabled: false },
  {
    type: "link",
    id: "docs",
    enabled: true,
    name: "$t:documentation",
    icon: "help",
    url: "https://docs.directus.io",
  },
  { type: "module", id: "settings", enabled: true, locked: true },
]);

function parseModuleBar(value) {
  if (value == null) return null;
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed) || parsed.some((item) => !item || typeof item !== "object")) {
    throw new Error("Directus settings module_bar must be an array of module/link entries");
  }
  return parsed;
}

export function mergeProductEditorModuleBar(value) {
  const current = parseModuleBar(value);
  const moduleBar = current ?? DIRECTUS_DEFAULT_MODULE_BAR.map((entry) => ({ ...entry }));
  const existingIndex = moduleBar.findIndex(
    (entry) => entry.type === "module" && entry.id === PRODUCT_EDITOR_MODULE.id,
  );
  if (existingIndex >= 0) {
    if (moduleBar[existingIndex].enabled === true) return moduleBar;
    const updated = [...moduleBar];
    updated[existingIndex] = { ...updated[existingIndex], enabled: true };
    return updated;
  }

  const contentIndex = moduleBar.findIndex(
    (entry) => entry.type === "module" && entry.id === "content",
  );
  const insertAt = contentIndex >= 0 ? contentIndex + 1 : moduleBar.length;
  return [
    ...moduleBar.slice(0, insertAt),
    { ...PRODUCT_EDITOR_MODULE },
    ...moduleBar.slice(insertAt),
  ];
}

const sameValue = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

export async function applyCommerceProjectSettings(
  client,
  profile = commerceProfile,
  { dryRun = false } = {},
) {
  if (typeof profile.locale !== "string" || !profile.locale.trim()) {
    throw new Error("Commerce profile locale is required for the Directus project settings");
  }

  const current = await client.request("/settings");
  const desired = {
    project_name: PROJECT_NAME,
    default_language: profile.locale,
    project_color: PROJECT_COLOR,
    module_bar: mergeProductEditorModuleBar(current.module_bar),
  };
  const patch = Object.fromEntries(
    Object.entries(desired).filter(([key, value]) => !sameValue(current[key], value)),
  );
  if (Object.keys(patch).length === 0) return [];

  if (!dryRun) {
    await client.request("/settings", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  }
  return [`update commerce project settings (${Object.keys(patch).join(", ")})`];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const client = await DirectusAdminClient.connectFromEnvironment();
  const actions = await applyCommerceProjectSettings(client, commerceProfile, { dryRun });
  console.log(`${dryRun ? "Planned" : "Applied"} ${actions.length} project settings actions:`);
  for (const action of actions) console.log(`- ${action}`);
}

if (isMainModule(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
