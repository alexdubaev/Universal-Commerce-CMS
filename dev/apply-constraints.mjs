import { access, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sqlRoot = resolve(root, "directus/migrations/sql");
const composeFile = resolve(root, "dev/compose.yml");
const envFile = resolve(root, "dev/.env");
const dockerDesktopCli = process.env.LOCALAPPDATA
  ? resolve(process.env.LOCALAPPDATA, "Programs/DockerDesktop/resources/bin/docker.exe")
  : null;
let docker = process.env.DOCKER_CLI ?? "docker";
if (!process.env.DOCKER_CLI && process.platform === "win32" && dockerDesktopCli) {
  try { await access(dockerDesktopCli); docker = dockerDesktopCli; } catch { /* use PATH */ }
}
const files = [
  "page-section-owner-xor-up.sql",
  "product-analogs-constraints-up.sql",
  "product-search-indexes-up.sql",
  "seo-work-items-constraints-up.sql",
];

if (!process.env.DB_USER || !process.env.DB_DATABASE) {
  throw new Error("Load the generated dev/.env before applying local schema constraints.");
}

for (const file of files) {
  const sql = await readFile(resolve(sqlRoot, file), "utf8");
  const result = spawnSync(docker, [
    "compose", "--project-name", "universal-commerce-cms-dev",
    "--env-file", envFile, "-f", composeFile,
    "exec", "-T", "db", "psql", "-v", "ON_ERROR_STOP=1",
    "-v", "release_id=initial-local-bootstrap", "-U", process.env.DB_USER,
    "-d", process.env.DB_DATABASE, "-f", "-",
  ], { input: sql, encoding: "utf8", stdio: ["pipe", "inherit", "inherit"] });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Could not apply ${file} to the isolated local database.`);
  console.log(`Applied ${file}`);
}
