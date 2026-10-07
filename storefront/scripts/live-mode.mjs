import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const cmsUrl = "http://127.0.0.1:18056";
const storefrontUrl = "http://127.0.0.1:3001";
const storefrontRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(storefrontRoot, "..");
const manifestPath = path.join(repoRoot, "dev", ".storefront-acceptance", "manifest.json");

async function readManifest() {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    throw new Error("Live acceptance fixture manifest is missing or unreadable.");
  }
  const target = typeof manifest.target === "string" ? manifest.target : manifest.target?.url;
  if (manifest.schema !== "universal-cms/storefront-acceptance/v1" || target !== cmsUrl
    || typeof manifest.service?.token !== "string" || !manifest.service.token
    || typeof manifest.service?.userId !== "string"
    || typeof manifest.namedRefs?.primaryProductId !== "string"
    || typeof manifest.namedRefs?.primaryProductSlug !== "string"
    || typeof manifest.namedRefs?.nonIndexableProductSlug !== "string") {
    throw new Error("Live acceptance manifest is incomplete or targets an unsupported instance.");
  }
  if (manifest.phase !== "active") {
    throw new Error("Live build and start require active reviewed synthetic fixtures.");
  }
  return manifest;
}

const action = process.argv[2];
if (action !== "build" && action !== "start") throw new Error("Expected build or start.");
const manifest = await readManifest();
const env = {
  ...process.env,
  DIRECTUS_URL: cmsUrl,
  DIRECTUS_TOKEN: manifest.service.token,
  STOREFRONT_DIRECTUS_GATEWAY: "true",
  STOREFRONT_MOCK_MODE: "false",
  STOREFRONT_ALLOW_MOCK_FALLBACK: "false",
  NEXT_PUBLIC_SITE_URL: storefrontUrl,
  PORT: "3001",
};
delete env.COMMERCE_STOREFRONT_ENABLED;
delete env.COMMERCE_STOREFRONT_USER_ID;
delete env.COMMERCE_STOREFRONT_PUBLIC_FOLDER_ID;
delete env.ADMIN_EMAIL;
delete env.ADMIN_PASSWORD;
delete env.DIRECTUS_SECRET;
delete env.DIRECTUS_KEY;
delete env.DB_DATABASE;
delete env.DB_USER;
delete env.DB_PASSWORD;

const nextCli = path.join(storefrontRoot, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextCli, action], { cwd: storefrontRoot, env, stdio: "inherit" });
child.on("error", () => { process.exitCode = 1; });
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
