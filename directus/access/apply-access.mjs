import { accessBlueprint } from "./blueprint.mjs";
import {
  DirectusAdminClient,
  isMainModule,
} from "../schema/apply-schema.mjs";

export function buildPermissionPayload(policyId, permission) {
  const payload = {
    policy: policyId,
    collection: permission.collection,
    action: permission.action,
    fields: permission.fields ?? ["*"],
  };
  if (permission.permissions) payload.permissions = permission.permissions;
  if (permission.validation) payload.validation = permission.validation;
  if (permission.presets) payload.presets = permission.presets;
  return payload;
}

const normalize = (value) => {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, normalize(nested)]),
  );
};

export function permissionMatches(
  existing,
  desired,
) {
  const rule = (value) =>
    value && typeof value === "object" && Object.keys(value).length === 0
      ? null
      : (value ?? null);
  const comparable = (permission) => ({
    policy: permission.policy,
    collection: permission.collection,
    action: permission.action,
    permissions: rule(permission.permissions),
    validation: rule(permission.validation),
    presets: rule(permission.presets),
    fields: permission.fields ?? ["*"],
  });

  const exact = (
    JSON.stringify(normalize(comparable(existing))) ===
    JSON.stringify(normalize(comparable(desired)))
  );
  return exact;
}

const permissionKey = (policyId, collection, action) =>
  `${policyId}:${collection}:${action}`;

const isResourceRestricted = (error) =>
  /RESOURCE_RESTRICTED/.test(String(error?.message ?? ""));

const publicRecord = (record, keys) => {
  if (!record || typeof record !== "object") return null;
  const result = {};
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) result[key] = record[key];
  }
  return Object.keys(result).length > 0 ? result : null;
};

/** Provision only the instance-local folders needed by the approved product editor. */
export async function applyAssetFolders(
  client,
  blueprint,
  { dryRun = false } = {},
) {
  const actions = [];
  const appliedActions = [];

  for (const folder of [
    blueprint.publicAssetFolder,
    blueprint.leadAttachmentFolder,
  ]) {
    const folderQuery = new URLSearchParams({
      "filter[id][_eq]": folder.id,
      limit: "1",
      fields: "id",
    });
    const folders = await client.request(`/folders?${folderQuery.toString()}`);
    if (folders.length === 0) {
      const action = `create folder ${folder.name}`;
      actions.push(action);
      if (!dryRun) {
        try {
          await client.request("/folders", {
            method: "POST",
            body: JSON.stringify(folder),
          });
          appliedActions.push(action);
        } catch (error) {
          error.failedAction ??= action;
          throw error;
        }
      }
    }
  }

  return { actions, appliedActions };
}

/** Build an allow-listed report for a fail-closed partial apply. */
export function buildPartialStateReport({ failedAction, state }) {
  return {
    schema: "universal-cms/access-partial-state/v1",
    error: { code: "RESOURCE_RESTRICTED", httpStatus: 403 },
    failedAction: failedAction ?? null,
    appliedActions: [...state.appliedActions],
    actual: {
      policies: [...state.policies.values()]
        .map((record) => publicRecord(record, ["id", "name"]))
        .filter(Boolean),
      roles: [...state.roles.values()]
        .map((record) => publicRecord(record, ["id", "name"]))
        .filter(Boolean),
      rolePolicyAccess: [...state.access.values()]
        .map((record) => publicRecord(record, ["id", "role", "policy"]))
        .filter(Boolean),
      permissions: [...state.permissions.values()]
        .map((record) =>
          publicRecord(record, ["id", "policy", "collection", "action"]),
        )
        .filter(Boolean),
    },
  };
}

const remember = (map, record) => {
  if (!record || typeof record !== "object" || record.id === undefined) return;
  const key = String(record.id);
  map.set(key, { ...(map.get(key) ?? {}), ...record });
};

export async function applyAccessBlueprint(
  client,
  blueprint,
  { dryRun = false } = {},
) {
  const actions = [];
  const state = {
    appliedActions: [],
    policies: new Map(),
    roles: new Map(),
    access: new Map(),
    permissions: new Map(),
  };
  let failedAction = null;

  try {
    const folderResult = await applyAssetFolders(client, blueprint, { dryRun });
    actions.push(...folderResult.actions);
    state.appliedActions.push(...folderResult.appliedActions);

    const roles = await client.request("/roles?limit=-1");
    const policies = await client.request("/policies?limit=-1");
    const accessRows = await client.request("/access?limit=-1");
    const permissions = await client.request(
      "/permissions?limit=-1&fields=id,policy,collection,action,permissions,validation,presets,fields",
    );

    for (const record of roles) remember(state.roles, record);
    for (const record of policies) remember(state.policies, record);
    for (const record of accessRows) {
      const key = record.id ?? `${record.role}:${record.policy}`;
      state.access.set(String(key), { ...record });
    }
    for (const record of permissions) remember(state.permissions, record);

    const roleByName = new Map(roles.map((role) => [role.name, role]));
    const policyByName = new Map(
      policies.map((policy) => [policy.name, policy]),
    );
    const managedPolicyIds = new Set();
    const desiredPermissionKeys = new Set();

    for (const policyDefinition of blueprint.policies) {
      const policyName =
        policyDefinition.existingPolicyName ?? policyDefinition.policyName;
      const desiredPolicyName = policyDefinition.policyName ?? policyName;
      let policy = policyByName.get(policyName) ?? policyByName.get(desiredPolicyName);
      if (!policy) {
        for (const legacyName of policyDefinition.existingPolicyNames ?? []) {
          policy = policyByName.get(legacyName);
          if (policy) break;
        }
      }
      if (!policy) {
        const action = `create policy ${desiredPolicyName}`;
        actions.push(action);
        failedAction = action;
        if (!dryRun) {
          policy = await client.request("/policies", {
            method: "POST",
            body: JSON.stringify({
              name: desiredPolicyName,
              icon: policyDefinition.role?.icon ?? "public",
              description:
                policyDefinition.role?.description ?? "Public website access.",
              app_access: policyDefinition.appAccess,
              admin_access: policyDefinition.adminAccess,
            }),
          });
          state.appliedActions.push(action);
        } else {
          policy = { id: `dry-run:${policyDefinition.key}`, name: desiredPolicyName };
        }
        remember(state.policies, policy);
        policyByName.set(desiredPolicyName, policy);
      } else if (
        policyDefinition.policyName &&
        policy.name !== policyDefinition.policyName
      ) {
        const action = `rename policy ${policy.name} -> ${policyDefinition.policyName}`;
        actions.push(action);
        failedAction = action;
        if (!dryRun) {
          await client.request(`/policies/${policy.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              name: policyDefinition.policyName,
              icon: policyDefinition.role?.icon ?? "public",
              description: policyDefinition.role?.description ?? null,
            }),
          });
          state.appliedActions.push(action);
        }
        policy = { ...policy, name: policyDefinition.policyName };
        remember(state.policies, policy);
        policyByName.set(policy.name, policy);
      } else {
        remember(state.policies, policy);
      }
      managedPolicyIds.add(policy.id);

      if (policyDefinition.role) {
        let role = roleByName.get(policyDefinition.role.name);
        if (!role) {
          for (const legacyName of policyDefinition.role.existingNames ?? []) {
            role = roleByName.get(legacyName);
            if (role) break;
          }
        }
        if (!role) {
          const action = `create role ${policyDefinition.role.name}`;
          actions.push(action);
          failedAction = action;
          if (!dryRun) {
            const { existingNames: _existingNames, ...rolePayload } = policyDefinition.role;
            role = await client.request("/roles", {
              method: "POST",
              body: JSON.stringify(rolePayload),
            });
            state.appliedActions.push(action);
          } else {
            role = {
              id: `dry-run:${policyDefinition.key}:role`,
              name: policyDefinition.role.name,
            };
          }
          remember(state.roles, role);
          roleByName.set(role.name, role);
        } else if (role.name !== policyDefinition.role.name) {
          const action = `rename role ${role.name} -> ${policyDefinition.role.name}`;
          actions.push(action);
          failedAction = action;
          if (!dryRun) {
            const { existingNames: _existingNames, ...rolePayload } = policyDefinition.role;
            await client.request(`/roles/${role.id}`, {
              method: "PATCH",
              body: JSON.stringify(rolePayload),
            });
            state.appliedActions.push(action);
          }
          role = { ...role, ...policyDefinition.role };
          remember(state.roles, role);
          roleByName.set(role.name, role);
        } else {
          remember(state.roles, role);
        }

        const hasAccess = accessRows.some(
          (row) => row.role === role.id && row.policy === policy.id,
        );
        if (!hasAccess) {
          const action = `attach ${desiredPolicyName} policy to ${role.name}`;
          actions.push(action);
          failedAction = action;
          if (!dryRun) {
            const created = await client.request("/access", {
              method: "POST",
              body: JSON.stringify({ role: role.id, policy: policy.id }),
            });
            const access = {
              ...created,
              role: created?.role ?? role.id,
              policy: created?.policy ?? policy.id,
            };
            const accessKey = access.id ?? `${role.id}:${policy.id}`;
            state.access.set(String(accessKey), access);
            state.appliedActions.push(action);
          }
        }
      }

      for (const definition of policyDefinition.permissions) {
        const desired = buildPermissionPayload(policy.id, definition);
        const key = permissionKey(
          policy.id,
          definition.collection,
          definition.action,
        );
        desiredPermissionKeys.add(key);
        const existing = permissions.find(
          (item) =>
            item.policy === policy.id &&
            item.collection === definition.collection &&
            item.action === definition.action,
        );

        if (!existing) {
          const action =
            `create ${desiredPolicyName} permission ${definition.collection}:${definition.action}`;
          actions.push(action);
          failedAction = action;
          if (!dryRun) {
            const created = await client.request("/permissions", {
              method: "POST",
              body: JSON.stringify(desired),
            });
            remember(state.permissions, { ...desired, ...created });
            state.appliedActions.push(action);
          }
        } else if (!permissionMatches(existing, desired)) {
          const action =
            `update ${desiredPolicyName} permission ${definition.collection}:${definition.action}`;
          actions.push(action);
          failedAction = action;
          if (!dryRun) {
            const updated = await client.request(`/permissions/${existing.id}`, {
              method: "PATCH",
              body: JSON.stringify(desired),
            });
            remember(state.permissions, { ...existing, ...desired, ...updated });
            state.appliedActions.push(action);
          }
        }
      }
    }

    for (const permission of permissions) {
      if (!managedPolicyIds.has(permission.policy)) continue;
      const key = permissionKey(
        permission.policy,
        permission.collection,
        permission.action,
      );
      if (desiredPermissionKeys.has(key)) continue;

      const action =
        `remove stale permission ${permission.collection}:${permission.action}`;
      actions.push(action);
      failedAction = action;
      if (!dryRun) {
        await client.request(`/permissions/${permission.id}`, {
          method: "DELETE",
        });
        state.permissions.delete(String(permission.id));
        state.appliedActions.push(action);
      }
    }

    return actions;
  } catch (error) {
    failedAction = error.failedAction ?? failedAction;
    if (!dryRun && isResourceRestricted(error)) {
      error.partialState = buildPartialStateReport({ failedAction, state });
    }
    throw error;
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const client = await DirectusAdminClient.connectFromEnvironment();
  if (process.argv.includes("--folders-only")) {
    const result = await applyAssetFolders(client, accessBlueprint, { dryRun });
    if (result.actions.length === 0) {
      console.log("Asset folders are already up to date.");
      return;
    }
    console.log(`${dryRun ? "Planned" : "Applied"} ${result.actions.length} actions:`);
    for (const action of result.actions) console.log(`- ${action}`);
    return;
  }
  const actions = await applyAccessBlueprint(client, accessBlueprint, {
    dryRun,
  });

  if (actions.length === 0) {
    console.log("Access configuration is already up to date.");
    return;
  }

  console.log(`${dryRun ? "Planned" : "Applied"} ${actions.length} actions:`);
  for (const action of actions) console.log(`- ${action}`);
}

if (isMainModule(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    if (error.failedAction && !error.partialState) {
      console.error(`Failed action: ${error.failedAction}`);
    }
    if (error.partialState) {
      console.error(JSON.stringify(error.partialState, null, 2));
    }
    console.error(error.message);
    process.exitCode = 1;
  });
}
