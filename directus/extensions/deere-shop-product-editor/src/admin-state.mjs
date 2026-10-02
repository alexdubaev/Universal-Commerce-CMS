/**
 * Immutable per-record editor state for guarded compare-and-swap writes.
 * Loader signature: loader(id, fields). Saver signature:
 * saver(collection, id, { expected, changes }). A failed or malformed save
 * blocks retry until reconcile succeeds.
 */
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const forbidden = new Set(["id", "created_at", "updated_at", "user_created", "user_updated"]);
const equal = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

function permitted(config, field, action) {
  const permission = config.permissions?.[action];
  return permission === true || (Array.isArray(permission) && (permission.includes("*") || permission.includes(field)));
}

function metadataAllowsWrite(config, field) {
  const metadata = config.fieldMetadata?.[field];
  return !metadata || (metadata.type !== "alias" && metadata.readonly !== true && metadata.schema?.is_generated !== true && metadata.meta?.readonly !== true &&
    !String(metadata.field ?? field).startsWith("group_") &&
    !["group-detail", "presentation", "note"].includes(metadata.meta?.interface));
}

export function mergeTabValues(previous, next, fields, baseline = {}) {
  const merged = clone(previous ?? {});
  for (const field of fields ?? []) {
    if (next && Object.hasOwn(next, field) && next[field] !== undefined) merged[field] = clone(next[field]);
    else if (Object.hasOwn(baseline, field)) merged[field] = clone(baseline[field]);
    else delete merged[field];
  }
  return merged;
}

export function createEditorState(config = {}) {
  let baseline = null;
  let values = {};
  let identity = null;
  let generation = 0;
  let loading = false;
  let saving = false;
  let conflict = false;
  let writeUncertain = false;
  let readError = null;
  let saveError = null;
  let saved = false;
  const editable = new Set((config.editableFields ?? []).filter((field) =>
    !forbidden.has(field) && metadataAllowsWrite(config, field)));

  const readableFields = () => ["id", "updated_at", ...[...editable].filter((field) => permitted(config, field, "read"))];
  const hasIdentityBaseline = () => Boolean(baseline && baseline.id != null && String(baseline.id) === String(identity) &&
    Object.hasOwn(baseline, "updated_at") && baseline.updated_at != null);
  const dirtyFields = () => [...editable].filter((field) =>
    Object.hasOwn(values, field) && Object.hasOwn(baseline ?? {}, field) && !equal(values[field], baseline[field]));
  const canWrite = (field) => config.guardedContract === true && hasIdentityBaseline() && !loading && !saving &&
    !readError && !writeUncertain && editable.has(field) && permitted(config, "id", "read") &&
    permitted(config, "updated_at", "read") && permitted(config, field, "read") &&
    permitted(config, field, "update") && metadataAllowsWrite(config, field);

  async function load(loader, id, { discardEdits = false } = {}) {
    if (saving) return { ok: false, reason: "busy" };
    if (dirtyFields().length && !discardEdits) return { ok: false, reason: "dirty" };
    if (!permitted(config, "id", "read") || !permitted(config, "updated_at", "read")) {
      readError = new Error("Read permission for id and updated_at is required");
      return { ok: false, reason: "permission", error: readError };
    }
    const request = ++generation;
    const changedIdentity = identity !== null && String(identity) !== String(id);
    identity = id;
    if (changedIdentity || baseline === null) { baseline = null; values = {}; }
    loading = true;
    readError = null;
    saved = false;
    try {
      const record = await loader(id, readableFields());
      if (request !== generation || String(identity) !== String(id)) return { ok: false, stale: true };
      if (!record || String(record.id) !== String(id) || record.updated_at == null) throw new Error("Invalid record acknowledgement");
      baseline = clone(record);
      values = clone(record);
      conflict = false;
      writeUncertain = false;
      saveError = null;
      return { ok: true, record: clone(record) };
    } catch (error) {
      if (request === generation && String(identity) === String(id)) readError = error;
      return { ok: false, error };
    } finally {
      if (request === generation) loading = false;
    }
  }

  function change(field, value) {
    if (value === undefined || !canWrite(field) || !Object.hasOwn(baseline, field)) return false;
    values[field] = clone(value);
    saved = false;
    saveError = null;
    return true;
  }

  function changeTab(fields, nextValues) {
    if (loading || saving || !hasIdentityBaseline() || readError || writeUncertain) return false;
    const candidate = mergeTabValues(values, nextValues, fields, baseline);
    for (const field of fields ?? []) {
      if (!Object.hasOwn(candidate, field) || equal(candidate[field], values[field])) continue;
      if (!canWrite(field) || !Object.hasOwn(baseline, field)) return false;
    }
    values = candidate;
    saved = false;
    saveError = null;
    return true;
  }

  function payload() {
    if (!hasIdentityBaseline() || readError || loading || saving || writeUncertain || config.guardedContract !== true ||
        !permitted(config, "id", "read") || !permitted(config, "updated_at", "read")) return null;
    const dirty = dirtyFields();
    if (!dirty.length || dirty.some((field) => !canWrite(field))) return null;
    const changes = {};
    for (const field of dirty) changes[field] = clone(values[field]);
    const expected = { id: baseline.id, updated_at: baseline.updated_at };
    for (const field of dirty) expected[field] = clone(baseline[field]);
    return { expected, changes };
  }

  async function save(saver) {
    if (saving || loading || conflict || writeUncertain || !hasIdentityBaseline() || readError || config.guardedContract !== true) return { ok: false, reason: "unavailable" };
    const requestPayload = payload();
    if (!requestPayload) return { ok: false, reason: "no-changes-or-permission" };
    const request = generation;
    const requestIdentity = identity;
    saving = true;
    saved = false;
    saveError = null;
    try {
      const result = await saver(config.collection, baseline.id, clone(requestPayload));
      if (request !== generation || requestIdentity !== identity) return { ok: false, stale: true };
      const acknowledged = result?.data ?? result;
      if (!acknowledged || String(acknowledged.id) !== String(baseline.id) || acknowledged.updated_at == null ||
          Object.keys(requestPayload.changes).some((field) => !Object.hasOwn(acknowledged, field))) {
        throw new Error("Save acknowledgement does not contain the changed fields and version");
      }
      baseline = { ...clone(baseline), updated_at: clone(acknowledged.updated_at) };
      values = { ...values, updated_at: clone(acknowledged.updated_at) };
      for (const field of Object.keys(requestPayload.changes)) {
        baseline[field] = clone(acknowledged[field]);
        values[field] = clone(acknowledged[field]);
      }
      saved = true;
      return { ok: true, record: clone(acknowledged) };
    } catch (error) {
      if (request === generation && requestIdentity === identity) {
        saveError = error;
        writeUncertain = true;
        if (error?.status === 409 || error?.response?.status === 409) conflict = true;
      }
      return { ok: false, error, conflict };
    } finally {
      if (request === generation && requestIdentity === identity) saving = false;
    }
  }

  async function reconcile(loader, id = identity, { keepEdits = false } = {}) {
    if (id == null) return { ok: false, reason: "identity" };
    const sameRecord = identity !== null && String(identity) === String(id);
    const retained = keepEdits && sameRecord ? Object.fromEntries(dirtyFields().map((field) => [field, clone(values[field])])) : {};
    const result = await load(loader, id, { discardEdits: true });
    if (result.ok && sameRecord && keepEdits) {
      for (const [field, value] of Object.entries(retained)) if (Object.hasOwn(baseline, field)) values[field] = value;
      saved = false;
    }
    return result;
  }

  return {
    load, change, changeTab, payload, save, reconcile,
    get collection() { return config.collection ?? null; },
    get identity() { return identity; },
    get baseline() { return clone(baseline); },
    get values() { return clone(values); },
    get dirty() { return dirtyFields().length > 0; },
    get dirtyFields() { return dirtyFields(); },
    get canSave() { return Boolean(payload()) && !saving && !conflict && !readError && !writeUncertain; },
    get loading() { return loading; },
    get saving() { return saving; },
    get conflict() { return conflict; },
    get writeUncertain() { return writeUncertain; },
    get readError() { return readError; },
    get saveError() { return saveError; },
    get saved() { return saved; },
    canWrite,
  };
}
