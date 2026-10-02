import { randomBytes, randomUUID } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const template = resolve(root, "dev/.env.example");
const output = resolve(root, "dev/.env");

try {
  await access(output);
  throw new Error("dev/.env already exists; preserve the current instance credentials.");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const values = {
  CMS_PORT: "18056",
  DIRECTUS_URL: "http://127.0.0.1:18056",
  ADMIN_EMAIL: "admin@example.com",
  ADMIN_PASSWORD: randomBytes(32).toString("base64url"),
  DIRECTUS_SECRET: randomBytes(48).toString("base64url"),
  DIRECTUS_KEY: randomBytes(32).toString("base64url"),
  DB_DATABASE: "universal_commerce_cms",
  DB_USER: "universal_cms",
  DB_PASSWORD: randomBytes(32).toString("base64url"),
};
for (const key of ["DIRECTUS_PUBLIC_ASSETS_FOLDER_ID", "DIRECTUS_PRIVATE_UPLOADS_FOLDER_ID", "DIRECTUS_WORKSPACE_DASHBOARD_ID", ...Array.from({ length: 8 }, (_, index) => `DIRECTUS_WORKSPACE_PANEL_${["PUBLISHED_COUNT", "LEADS_COUNT", "ORDERS_COUNT", "LEADS_LIST", "PRODUCTS_LIST", "ARTICLES_LIST", "SEO_COUNT", "SEO_LIST"][index]}_ID`)]) {
  values[key] = randomUUID();
}
const templateText = await readFile(template, "utf8");
const outputText = templateText.split(/\r?\n/u).filter(Boolean).map((line) => {
  const key = line.slice(0, line.indexOf("="));
  return `${key}=${values[key] ?? line.slice(line.indexOf("=") + 1)}`;
}).join("\n") + "\n";
await writeFile(output, outputText, { flag: "wx", mode: 0o600 });
console.log("Wrote ignored dev/.env with new instance credentials and IDs.");
