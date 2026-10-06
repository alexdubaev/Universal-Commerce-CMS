import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cmsUrl = "http://127.0.0.1:18056";
const localOrigin = "http://127.0.0.1";
const storefrontRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(storefrontRoot, "..");
const manifestPath = path.join(repoRoot, "dev", ".storefront-acceptance", "manifest.json");
const nextCli = path.join(storefrontRoot, "node_modules", "next", "dist", "bin", "next");
const args = new Set(process.argv.slice(2));

class ProbeError extends Error {}

function fail(message) {
  throw new ProbeError(message);
}

async function readManifest() {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    fail("Live acceptance manifest is missing or unreadable.");
  }
  if (manifest.schema !== "universal-cms/storefront-acceptance/v1"
    || manifest.target !== cmsUrl || manifest.phase !== "active"
    || !manifest.service?.token || !manifest.namedRefs?.primaryProductId
    || !manifest.namedRefs?.primaryProductSlug || !manifest.namedRefs?.publicDocumentFileId
    || !manifest.namedRefs?.documentId || !manifest.namedRefs?.privateAssetId) {
    fail("Live acceptance manifest is incomplete, inactive, or targets an unsupported instance.");
  }
  return manifest;
}

async function assertClosed(port) {
  try {
    await fetch(`${localOrigin}:${port}/`, { signal: AbortSignal.timeout(700) });
    fail("A probe port is already occupied; no process was stopped.");
  } catch (error) {
    if (error instanceof Error && error.message === "A probe port is already occupied; no process was stopped.") throw error;
  }
}

async function unusedPort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to reserve a local probe port.")));
        return;
      }
      const { port } = address;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function storefrontEnv(manifest, port, directusUrl = cmsUrl) {
  const env = {
    ...process.env,
    DIRECTUS_URL: directusUrl,
    DIRECTUS_TOKEN: manifest.service.token,
    STOREFRONT_DIRECTUS_GATEWAY: "true",
    STOREFRONT_MOCK_MODE: "false",
    STOREFRONT_ALLOW_MOCK_FALLBACK: "false",
    NEXT_PUBLIC_SITE_URL: `${localOrigin}:${port}`,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
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
  return env;
}

async function startNext(manifest, port, directusUrl = cmsUrl) {
  await assertClosed(port);
  const child = spawn(process.execPath, [nextCli, "start", "--port", String(port)], {
    cwd: storefrontRoot,
    env: storefrontEnv(manifest, port, directusUrl),
    stdio: "ignore",
  });
  child.on("error", () => {});
  const startedAt = Date.now();
  while (Date.now() - startedAt < 60_000) {
    if (child.exitCode !== null) fail("An isolated live probe server exited before becoming ready.");
    try {
      const response = await fetch(`${localOrigin}:${port}/api/health`, { signal: AbortSignal.timeout(1500) });
      if (directusUrl === cmsUrl ? response.ok : response.status === 503) return child;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await stopNext(child);
  fail("An isolated live probe server did not become ready in time.");
}

async function stopNext(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(resolve, 10_000); });
  const result = await Promise.race([exited.then(() => "exited"), timeout.then(() => "timeout")]);
  clearTimeout(timer);
  if (result !== "exited") fail("An isolated probe server did not stop cleanly; no other process was targeted.");
}

async function postLead(origin, payload) {
  const response = await fetch(`${origin}/api/lead`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  let body = null;
  try { body = await response.json(); } catch {}
  return { response, body };
}

async function restartDurabilityProbe(manifest) {
  const port = await unusedPort();
  const origin = `${localOrigin}:${port}`;
  const payload = {
    request_key: randomUUID(),
    company: "Synthetic live acceptance",
    name: "Live acceptance probe",
    phone: "+79990000003",
    email: "live-probe@example.invalid",
    message: "synthetic restart durability probe",
    request_items: [{ article: "LIVE-RESTART-PROBE", quantity: 1 }],
    page_url: `${origin}/request`,
  };
  let child = await startNext(manifest, port);
  try {
    const first = await postLead(origin, payload);
    if (!first.response.ok || typeof first.body?.id !== "string" || first.body.replayed !== false) {
      fail("The first synthetic RFQ was not acknowledged as a new durable lead.");
    }
    await stopNext(child);
    child = null;
    child = await startNext(manifest, port);
    const retry = await postLead(origin, payload);
    if (!retry.response.ok || retry.body?.id !== first.body.id || retry.body?.replayed !== true) {
      fail("Same-key RFQ replay did not return the persisted acknowledgement after process restart.");
    }
    const conflict = await postLead(origin, { ...payload, message: "changed synthetic payload" });
    if (conflict.response.status !== 409) fail("Changed same-key RFQ payload did not conflict.");
    const invalid = await postLead(origin, { ...payload, request_key: randomUUID(), name: "x" });
    if (invalid.response.status !== 400) fail("Invalid synthetic RFQ was not rejected before persistence.");
  } finally {
    if (child) await stopNext(child);
  }
}

async function failClosedProbe(manifest) {
  const port = await unusedPort();
  const cmsPort = await unusedPort();
  const origin = `${localOrigin}:${port}`;
  let child = await startNext(manifest, port, `${localOrigin}:${cmsPort}`);
  try {
    const response = await fetch(`${origin}/api/search?q=LIVE-OUTAGE-PROBE`, { signal: AbortSignal.timeout(15_000) });
    if (response.status !== 500) fail("Directus outage did not fail closed on storefront search.");
    const health = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(15_000) });
    if (health.status !== 503) fail("Directus outage health probe did not report the unavailable backend.");
  } finally {
    await stopNext(child);
  }
}

async function adminToken() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) fail("Admin observer credentials are unavailable in the supplied env file.");
  const response = await fetch(`${cmsUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) fail("Read-only CMS observer authentication failed.");
  const body = await response.json().catch(() => null);
  if (typeof body?.data?.access_token !== "string") fail("CMS observer did not return an access token.");
  return body.data.access_token;
}

async function adminFetch(token, route, init = {}) {
  return fetch(`${cmsUrl}${route}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(15_000),
  });
}

function ownedDocumentFilter(documentId, status, fileId, productId, title) {
  return {
    _and: [
      { id: { _eq: documentId } },
      { status: { _eq: status } },
      { file: { _eq: fileId } },
      { product: { _eq: productId } },
      title === null ? { title: { _null: true } } : { title: { _eq: title } },
    ],
  };
}

function pendingContains(manifest, collection, id) {
  const entries = manifest.pending?.[collection];
  if (Array.isArray(entries)) return entries.includes(id);
  return Boolean(entries && typeof entries === "object" && Object.hasOwn(entries, id));
}

async function setDocumentStatus(token, documentId, from, to, fileId, productId, title) {
  const filter = encodeURIComponent(JSON.stringify(ownedDocumentFilter(documentId, from, fileId, productId, title)));
  const response = await adminFetch(token, `/items/product_documents?filter=${filter}`, {
    method: "PATCH",
    body: JSON.stringify({ status: to }),
  });
  if (!response.ok) fail("CAS document status update was rejected.");
  const body = await response.json().catch(() => null);
  if (!Array.isArray(body?.data) || body.data.length !== 1 || body.data[0]?.id !== documentId || body.data[0]?.status !== to) {
    fail("CAS document update did not affect exactly the owned fixture record.");
  }
}

async function revocationProbe(manifest) {
  const refs = manifest.namedRefs;
  const documentId = refs.documentId;
  const publicFileId = refs.publicDocumentFileId;
  const productId = refs.primaryProductId;
  const ownedDocuments = manifest.created?.product_documents;
  const ownedProducts = manifest.created?.products;
  const ownedFiles = manifest.created?.directus_files;
  const expectedDocument = manifest.ownership?.product_documents?.[documentId];
  const expectedFile = manifest.ownership?.directus_files?.[publicFileId];
  if (!Array.isArray(ownedDocuments) || !ownedDocuments.includes(documentId)
    || !Array.isArray(ownedProducts) || !ownedProducts.includes(productId)
    || !Array.isArray(ownedFiles) || !ownedFiles.includes(publicFileId)
    || !expectedDocument || expectedDocument.id !== documentId
    || expectedDocument.product !== productId || expectedDocument.file !== publicFileId
    || expectedDocument.status !== "published"
    || !(expectedDocument.title === null || typeof expectedDocument.title === "string")
    || !expectedFile || expectedFile.id !== publicFileId
    || expectedFile.folder !== manifest.publicFolderId
    || typeof expectedFile.filename_download !== "string"
    || pendingContains(manifest, "product_documents", documentId)
    || pendingContains(manifest, "products", productId)
    || pendingContains(manifest, "directus_files", publicFileId)) {
    fail("Manifest does not establish ownership of every record used for CAS revocation.");
  }

  const token = await adminToken();
  const fileFilter = encodeURIComponent(JSON.stringify({ id: { _eq: publicFileId } }));
  const fileResponse = await adminFetch(token, `/files?filter=${fileFilter}&fields=id,folder,filename_download`);
  const fileRows = fileResponse.ok ? (await fileResponse.json().catch(() => null))?.data : null;
  if (!Array.isArray(fileRows) || fileRows.length !== 1
    || fileRows[0]?.id !== publicFileId || fileRows[0]?.folder !== manifest.publicFolderId
    || fileRows[0]?.filename_download !== expectedFile.filename_download) {
    fail("Admin file observer does not match the manifest-owned synthetic public file.");
  }
  const read = await adminFetch(token, `/items/product_documents/${encodeURIComponent(documentId)}?fields=id,status,file,product,title`);
  if (!read.ok) fail("Unable to read the owned document before CAS revocation.");
  const record = (await read.json().catch(() => null))?.data;
  if (record?.id !== documentId || record?.status !== expectedDocument.status
    || record?.file !== publicFileId || record?.product !== productId
    || record?.title !== expectedDocument.title) {
    fail("The manifest-owned document no longer matches the expected published fixture state.");
  }

  const port = await unusedPort();
  const origin = `${localOrigin}:${port}`;
  let child = await startNext(manifest, port);
  let changed = false;
  let restored = false;
  try {
    const before = await fetch(`${origin}/api/assets/${publicFileId}`, { signal: AbortSignal.timeout(15_000) });
    if (!before.ok) fail("Public synthetic document was unavailable before revocation.");
    changed = true;
    await setDocumentStatus(token, documentId, expectedDocument.status, "draft", publicFileId, productId, expectedDocument.title);
    const revoked = await fetch(`${origin}/api/assets/${publicFileId}`, { signal: AbortSignal.timeout(15_000) });
    if (revoked.ok) fail("Asset remained accessible after its published reference was revoked.");
  } finally {
    if (changed) {
      const filter = encodeURIComponent(JSON.stringify(ownedDocumentFilter(documentId, "draft", publicFileId, productId, expectedDocument.title)));
      const currentResponse = await adminFetch(token, `/items/product_documents?filter=${filter}&fields=id,status,file,product,title`);
      const current = currentResponse.ok ? await currentResponse.json().catch(() => null) : null;
      if (Array.isArray(current?.data) && current.data.length === 1
        && current.data[0]?.id === documentId && current.data[0]?.file === publicFileId
        && current.data[0]?.product === productId && current.data[0]?.status === "draft"
        && current.data[0]?.title === expectedDocument.title) {
        try {
          await setDocumentStatus(token, documentId, "draft", expectedDocument.status, publicFileId, productId, expectedDocument.title);
          restored = true;
        } catch {}
      }
    }
    try { await stopNext(child); } catch {
      if (restored) restored = false;
      throw new Error("An isolated asset-probe server did not stop cleanly.");
    }
  }
  if (changed && !restored) fail("CAS restoration was not confirmed; inspect the fixture before reuse.");
  const verifyPort = await unusedPort();
  let verifyChild = await startNext(manifest, verifyPort);
  try {
    const restoredAsset = await fetch(`${localOrigin}:${verifyPort}/api/assets/${publicFileId}`, { signal: AbortSignal.timeout(15_000) });
    if (!restoredAsset.ok) fail("Restored public asset did not become available from a fresh storefront process.");
  } finally {
    await stopNext(verifyChild);
  }
}

if (!args.has("--runtime-approved")) fail("Pass --runtime-approved only after the root reviewer activates the local fixture runtime.");
if (args.size !== 1) fail("Unexpected live probe arguments.");

try {
  const manifest = await readManifest();
  if (process.env.DIRECTUS_URL !== cmsUrl) fail("Observer env file must target only the isolated local CMS URL.");
  await restartDurabilityProbe(manifest);
  console.log("LIVE_PROBE restart-durability changed-payload-conflict invalid-input: pass");
  await failClosedProbe(manifest);
  console.log("LIVE_PROBE directus-outage fail-closed: pass");
  await revocationProbe(manifest);
  console.log("LIVE_PROBE asset-revocation cas-restore: pass");
} catch (error) {
  process.exitCode = 1;
  console.error(error instanceof ProbeError ? error.message : "Live probe failed without details; no raw request or credential data was printed.");
}
