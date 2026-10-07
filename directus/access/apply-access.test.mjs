import test from "node:test";
import assert from "node:assert/strict";

import {
  applyAssetFolders,
  applyAccessBlueprint,
  permissionMatches,
} from "./apply-access.mjs";

test("folders-only setup is idempotent and never writes roles, policies, access, or permissions", async () => {
  const folders = new Map();
  const requests = [];
  const client = {
    async request(path, options = {}) {
      const method = options.method ?? "GET";
      requests.push({ path, method });
      if (path.startsWith("/folders?")) {
        const id = new URLSearchParams(path.slice(path.indexOf("?") + 1))
          .get("filter[id][_eq]");
        return folders.has(id) ? [{ id }] : [];
      }
      if (path === "/folders" && method === "POST") {
        const folder = JSON.parse(options.body);
        folders.set(folder.id, folder);
        return folder;
      }
      throw new Error(`Unexpected request ${method} ${path}`);
    },
  };
  const blueprint = {
    publicAssetFolder: { id: "public-folder", name: "Public" },
    leadAttachmentFolder: { id: "lead-folder", name: "Lead attachments" },
    policies: [{
      key: "frontend_api",
      policyName: "API",
      permissions: [{ collection: "directus_files", action: "create", presets: { folder: "lead-folder" } }],
    }],
  };

  const first = await applyAssetFolders(client, blueprint);
  const second = await applyAssetFolders(client, blueprint);

  assert.deepEqual(first.actions, ["create folder Public", "create folder Lead attachments"]);
  assert.deepEqual(first.appliedActions, first.actions);
  assert.deepEqual(second, { actions: [], appliedActions: [] });
  assert.equal(folders.size, 2);
  assert.ok(requests.every(({ path }) => path.startsWith("/folders")));
  assert.equal(requests.filter(({ path, method }) => path === "/folders" && method === "POST").length, 2);
});

test("permission matcher never mistakes a broader file rule for an exact match", () => {
  const desired = {
    policy: "policy-id",
    collection: "directus_files",
    action: "read",
    fields: ["*"],
    permissions: { folder: { _eq: "public-folder" } },
  };
  const existing = {
    id: 1,
    policy: "policy-id",
    collection: "directus_files",
    action: "read",
    fields: ["*"],
    permissions: {},
  };

  assert.equal(permissionMatches(existing, desired), false);
});

test("reports the actual partial state when Directus rejects custom permission rules", async () => {
  const requests = [];
  const client = {
    async request(path, options = {}) {
      requests.push({ path, method: options.method ?? "GET", body: options.body });
      if (path.startsWith("/folders?")) return [{ id: "folder" }];
      if (path === "/roles?limit=-1") return [];
      if (path === "/policies?limit=-1") return [];
      if (path === "/access?limit=-1") return [];
      if (path.startsWith("/permissions?")) return [];
      if (path === "/policies") return { id: "policy-1", name: "API фронтенда" };
      if (path === "/roles") return { id: "role-1", name: "API фронтенда" };
      if (path === "/access") return { id: "access-1" };
      if (path === "/permissions") {
        const body = JSON.parse(options.body);
        if (body.permissions) {
          throw new Error(
            'POST /permissions failed: HTTP 403 {"errors":[{"extensions":{"code":"RESOURCE_RESTRICTED"}}]}',
          );
        }
        return { id: "permission-1", ...body };
      }
      throw new Error(`unexpected request ${path}`);
    },
  };
  const blueprint = {
    publicAssetFolder: { id: "public-folder", name: "Public" },
    leadAttachmentFolder: { id: "lead-folder", name: "Leads" },
    policies: [{
      key: "frontend_api",
      policyName: "API фронтенда",
      appAccess: false,
      adminAccess: false,
      permissions: [{
        collection: "directus_files",
        action: "read",
        permissions: { folder: { _eq: "public-folder" } },
      }],
      role: {
        name: "API фронтенда",
        icon: "dns",
        description: "test",
      },
    }],
  };

  let failure;
  await assert.rejects(
    applyAccessBlueprint(client, blueprint),
    (error) => {
      failure = error;
      return /RESOURCE_RESTRICTED/.test(error.message);
    },
  );
  assert.ok(requests.some(({ path, method }) => path === "/permissions" && method === "POST"));
  assert.deepEqual(failure.partialState.error, {
    code: "RESOURCE_RESTRICTED",
    httpStatus: 403,
  });
  assert.deepEqual(failure.partialState.appliedActions, [
    "create policy API фронтенда",
    "create role API фронтенда",
    "attach API фронтенда policy to API фронтенда",
  ]);
  assert.deepEqual(failure.partialState.actual.policies, [
    { id: "policy-1", name: "API фронтенда" },
  ]);
  assert.deepEqual(failure.partialState.actual.roles, [
    { id: "role-1", name: "API фронтенда" },
  ]);
  assert.deepEqual(failure.partialState.actual.rolePolicyAccess, [
    { id: "access-1", role: "role-1", policy: "policy-1" },
  ]);
  assert.equal(failure.partialState.actual.permissions.length, 0);
  assert.equal(JSON.stringify(failure.partialState).includes("password"), false);
});

test("renames managed legacy roles and policies without creating duplicates", async () => {
  const requests = [];
  const client = {
    async request(path, options = {}) {
      requests.push({ path, method: options.method ?? "GET", body: options.body });
      if (path.startsWith("/folders?")) return [{ id: "folder" }];
      if (path === "/roles?limit=-1") return [{ id: "role-1", name: "Content Manager" }];
      if (path === "/policies?limit=-1") return [{ id: "policy-1", name: "Content Manager" }];
      if (path === "/access?limit=-1") return [{ role: "role-1", policy: "policy-1" }];
      if (path.startsWith("/permissions?")) return [];
      return {};
    },
  };
  const blueprint = {
    publicAssetFolder: { id: "public-folder", name: "Public" },
    leadAttachmentFolder: { id: "lead-folder", name: "Leads" },
    policies: [{
      key: "content_manager",
      policyName: "Контент-менеджер",
      existingPolicyNames: ["Content Manager"],
      appAccess: true,
      adminAccess: false,
      permissions: [],
      role: {
        name: "Контент-менеджер",
        existingNames: ["Content Manager"],
        icon: "edit_note",
        description: "Управляет контентом сайта.",
      },
    }],
  };

  await applyAccessBlueprint(client, blueprint);

  assert.ok(requests.some(({ path, method }) => path === "/roles/role-1" && method === "PATCH"));
  assert.ok(requests.some(({ path, method }) => path === "/policies/policy-1" && method === "PATCH"));
  assert.ok(!requests.some(({ path, method }) => path === "/roles" && method === "POST"));
  assert.ok(!requests.some(({ path, method }) => path === "/policies" && method === "POST"));
});
