import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const cwd = resolve(dirname(fileURLToPath(import.meta.url)), "../directus");
if (process.env.DIRECTUS_URL !== "http://127.0.0.1:18056") {
  throw new Error("Bootstrap is restricted to this project's http://127.0.0.1:18056 dev instance.");
}
const commands = [
  ["schema:apply"], ["schema:studio"], ["project:settings"], ["studio:workspace"],
  ["studio:versioning", "--", "--apply"], ["access:folders"], ["db:constraints"],
  ["product-editor:setup", "--", "--apply"],
];
for (const [script, ...args] of commands) {
  const result = spawnSync(npm, ["run", script, ...args], { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Commerce profile, Studio metadata, workspace, versioning, and local asset folders are applied.");
