const permission = (collection, action, options = {}) => ({
  collection,
  action,
  permissions: options.permissions ?? null,
  validation: options.validation ?? null,
  presets: options.presets ?? null,
  fields: options.fields ?? ["*"],
});

const read = (collection, options) => permission(collection, "read", options);
const create = (collection, options) => permission(collection, "create", options);
const update = (collection, options) => permission(collection, "update", options);
const remove = (collection, options) => permission(collection, "delete", options);

const websiteCollections = [
  "site_settings",
  "home_page",
  "pages",
  "page_sections",
  "navigation_items",
  "categories",
  "articles",
  // Junction of the article flexible editor: the frontend resolves relation
  // nodes (products/categories) through it when rendering content_blocks.
  "articles_editor_nodes",
  "products",
  "faq_items",
  "lead_forms",
  "contact_channels",
  "recent_supplies",
  "product_images",
  "product_specifications",
  "product_documents",
  "seo_redirects",
];

const contentCollections = websiteCollections.filter(
  (collection) => !["site_settings", "home_page"].includes(collection),
);

import { randomUUID } from "node:crypto";

const instanceId = (name) => {
  const value = process.env[name] ?? randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) {
    throw new Error(`${name} must be an instance-local UUID`);
  }
  return value;
};

const publicAssetFolderId = instanceId("DIRECTUS_PUBLIC_ASSETS_FOLDER_ID");
const leadAttachmentFolderId = instanceId("DIRECTUS_PRIVATE_UPLOADS_FOLDER_ID");
const folderFilter = (folderId) => ({ folder: { _eq: folderId } });
const ownPrivateFileFilter = (folderId) => ({
  _and: [folderFilter(folderId), { uploaded_by: { _eq: "$CURRENT_USER" } }],
});
const frontendFileReadFilter = {
  _or: [
    folderFilter(publicAssetFolderId),
    ownPrivateFileFilter(leadAttachmentFolderId),
  ],
};
const frontendOrderReadFilter = {
  user_created: { _eq: "$CURRENT_USER" },
};

const frontendPermissions = [
  ...websiteCollections.map(read),
  read("directus_files", { permissions: frontendFileReadFilter }),
  read("directus_folders"),
  create("directus_files", {
    validation: folderFilter(leadAttachmentFolderId),
    presets: { folder: leadAttachmentFolderId },
  }),
  // Uploads are read back by the Files API response handler and folder moves
  // are scoped to the uploader's own private files.
  update("directus_files", {
    permissions: ownPrivateFileFilter(leadAttachmentFolderId),
    validation: folderFilter(leadAttachmentFolderId),
    fields: ["folder"],
  }),
  remove("directus_files", {
    permissions: ownPrivateFileFilter(leadAttachmentFolderId),
  }),
  read("orders", {
    permissions: frontendOrderReadFilter,
    fields: ["id", "request_key", "request_fingerprint"],
  }),
  create("leads"),
  create("orders"),
  create("order_items"),
];

const contentPermissions = [
  read("site_settings"),
  update("site_settings"),
  read("home_page"),
  update("home_page"),
  ...contentCollections.flatMap((collection) => [
    read(collection),
    create(collection),
    update(collection),
  ]),
  read("directus_files", { permissions: folderFilter(publicAssetFolderId) }),
  // Hero and editorial images uploaded from Directus Data Studio must be
  // publicly readable by the server-side media route. Directus applies this
  // preset during multipart uploads, so authors do not have to select a
  // storage folder manually.
  create("directus_files", {
    presets: { folder: publicAssetFolderId },
  }),
  update("directus_files", {
    permissions: folderFilter(publicAssetFolderId),
    validation: folderFilter(publicAssetFolderId),
    fields: ["title", "description", "tags", "metadata"],
  }),
  read("directus_folders"),
  create("directus_folders"),
];

const seoCollections = [
  "home_page",
  "pages",
  "page_sections",
  "categories",
  "articles",
  "products",
  "faq_items",
  "product_images",
  "seo_redirects",
];

const seoPermissions = [
  ...websiteCollections.map(read),
  read("directus_files", { permissions: folderFilter(publicAssetFolderId) }),
  ...seoCollections.flatMap((collection) => [
    create(collection),
    update(collection),
  ]),
];

export const accessBlueprint = {
  publicAssetFolder: {
    id: publicAssetFolderId,
    name: "Public",
  },
  leadAttachmentFolder: {
    id: leadAttachmentFolderId,
    name: "Lead attachments",
  },
  policies: [
    {
      key: "public",
      existingPolicyName: "$t:public_label",
      appAccess: false,
      adminAccess: false,
      permissions: [],
    },
    {
      key: "frontend_api",
      role: {
        name: "API фронтенда",
        existingNames: ["Frontend API"],
        icon: "dns",
        description:
          "Серверный доступ Next.js. Не используется в браузере.",
      },
      policyName: "API фронтенда",
      existingPolicyNames: ["Frontend API"],
      appAccess: false,
      adminAccess: false,
      permissions: frontendPermissions,
    },
    {
      key: "content_manager",
      role: {
        name: "Контент-менеджер",
        existingNames: ["Content Manager"],
        icon: "edit_note",
        description:
          "Управляет сайтом, каталогом и контентом без права удаления защищённых данных.",
      },
      policyName: "Контент-менеджер",
      existingPolicyNames: ["Content Manager"],
      appAccess: true,
      adminAccess: false,
      permissions: contentPermissions,
    },
    {
      key: "sales_manager",
      role: {
        name: "Менеджер продаж",
        existingNames: ["Sales Manager"],
        icon: "support_agent",
        description:
          "Работает с заявками и заказами без права удаления.",
      },
      policyName: "Менеджер продаж",
      existingPolicyNames: ["Sales Manager"],
      appAccess: true,
      adminAccess: false,
      permissions: [
        read("leads"),
        update("leads"),
        read("orders"),
        update("orders"),
        read("order_items"),
        read("directus_files", {
          permissions: folderFilter(leadAttachmentFolderId),
        }),
      ],
    },
    {
      key: "seo_manager",
      role: {
        name: "SEO-менеджер",
        existingNames: ["SEO Manager"],
        icon: "manage_search",
        description:
          "Управляет SEO-полями страниц, категорий, товаров и статей.",
      },
      policyName: "SEO-менеджер",
      existingPolicyNames: ["SEO Manager"],
      appAccess: true,
      adminAccess: false,
      permissions: seoPermissions,
    },
    {
      key: "seo_worker",
      role: {
        name: "SEO Worker",
        existingNames: ["SEO Worker"],
        icon: "smart_toy",
        description:
          "Shadow-only service account: reads published SEO inputs, queues recommendations, and creates draft articles after manual approval.",
      },
      policyName: "SEO Worker",
      existingPolicyNames: ["SEO Worker"],
      appAccess: false,
      adminAccess: false,
      permissions: [],
    },
  ],
};
