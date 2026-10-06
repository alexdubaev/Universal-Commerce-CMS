import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const directory = path.join(repoRoot, "dev", ".storefront-acceptance");
const journalPath = path.join(directory, "live-results.json");
const manifestPath = path.join(directory, "manifest.json");

export async function recordLiveLead(runId, requestKey, id, source, attempts = 1) {
  if (!runId || !requestKey || !id || !source) throw new Error("Cannot journal an incomplete synthetic lead acknowledgement.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.runId !== runId || manifest.phase !== "active") throw new Error("Live journal run does not match the active fixture.");
  let journal = { schema: "universal-cms/storefront-acceptance-results/v1", runId, leads: [] };
  try { journal = JSON.parse(await readFile(journalPath, "utf8")); } catch {}
  if (journal.schema !== "universal-cms/storefront-acceptance-results/v1" || journal.runId !== runId || !Array.isArray(journal.leads)) {
    throw new Error("Private live journal belongs to another run or is malformed.");
  }
  const existing = journal.leads.find((lead) => lead.requestKey === requestKey && lead.id === id);
  if (existing) {
    existing.attempts = Math.max(existing.attempts || 1, attempts);
    if (!existing.sources.includes(source)) existing.sources.push(source);
  } else journal.leads.push({ requestKey, id, sources: [source], attempts });
  await mkdir(directory, { recursive: true });
  const temporary = `${journalPath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(journal, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, journalPath);
}
