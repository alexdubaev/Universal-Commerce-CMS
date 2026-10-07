import { allowMockFallback, directusFetch, isMockMode } from "./directus";
import type { CmsHome, CmsPage, CmsPageSection, NavigationItem, SiteSettings } from "./types";
import { defaultSettings } from "./mock";

const fallbackHeader: NavigationItem[] = [
  { id: "catalog", label: "Каталог", url: "/catalog", location: "header" },
  { id: "brands", label: "Бренды", url: "/brands", location: "header" },
  { id: "delivery", label: "Доставка", url: "/delivery", location: "header" },
  { id: "payment", label: "Оплата", url: "/payment", location: "header" },
  { id: "about", label: "О компании", url: "/about", location: "header" },
  { id: "contacts", label: "Контакты", url: "/contacts", location: "header" },
];

const fallbackFooter: NavigationItem[] = [
  { id: "catalog", label: "Каталог", url: "/catalog", location: "footer" },
  { id: "delivery", label: "Доставка", url: "/delivery", location: "footer" },
  { id: "payment", label: "Оплата", url: "/payment", location: "footer" },
  { id: "request", label: "Заявка по списку", url: "/request", location: "footer" },
  { id: "about", label: "О компании", url: "/about", location: "footer" },
  { id: "contacts", label: "Контакты", url: "/contacts", location: "footer" },
];

function objectRow(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    const first = data[0];
    return first && typeof first === "object" ? first as Record<string, unknown> : null;
  }
  return data && typeof data === "object" ? data as Record<string, unknown> : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function mapSection(row: Record<string, unknown>): CmsPageSection {
  return {
    id: String(row.id ?? ""),
    section_type: String(row.section_type ?? "custom"),
    title: stringOrNull(row.title),
    subtitle: stringOrNull(row.subtitle),
    text: stringOrNull(row.text),
    image: stringOrNull(row.image),
    image_alt: stringOrNull(row.image_alt),
    button_text: stringOrNull(row.button_text),
    button_url: stringOrNull(row.button_url),
    items: row.items ?? null,
    settings: row.settings ?? null,
  };
}

async function getSections(filter: Record<string, unknown>): Promise<CmsPageSection[]> {
  const params = new URLSearchParams({
    fields: "id,section_type,title,subtitle,text,image,image_alt,button_text,button_url,items,settings",
    limit: "100",
    sort: "sort_order",
    filter: JSON.stringify({
      _and: [
        { status: { _eq: "published" } },
        { is_visible: { _eq: true } },
        filter,
      ],
    }),
  });
  const result = await directusFetch<{ data: Record<string, unknown>[] }>(
    `/items/page_sections?${params.toString()}`,
    { revalidate: 120 },
  );
  return (result.data ?? []).map(mapSection);
}

export async function getCmsSiteSettings(): Promise<SiteSettings> {
  if (isMockMode()) return defaultSettings;

  try {
    const result = await directusFetch<{ data: unknown }>(
      "/items/site_settings?fields=company_name,phone,email,primary_cta_text,primary_cta_url,address,city,working_hours,delivery_region,legal_name,inn,kpp,ogrn,legal_address,vat_info,footer_text,footer_disclaimer",
      { revalidate: 120 },
    );
    const row = objectRow(result.data);
    if (!row) {
      if (allowMockFallback()) return defaultSettings;
      throw new Error("site_settings is empty");
    }

    return {
      company_name: String(row.company_name ?? defaultSettings.company_name),
      phone: String(row.phone ?? defaultSettings.phone),
      email: String(row.email ?? defaultSettings.email),
      primary_cta_text: String(row.primary_cta_text ?? defaultSettings.primary_cta_text),
      primary_cta_url: String(row.primary_cta_url ?? defaultSettings.primary_cta_url),
      address: stringOrNull(row.address),
      city: stringOrNull(row.city),
      working_hours: stringOrNull(row.working_hours),
      delivery_region: stringOrNull(row.delivery_region),
      legal_name: stringOrNull(row.legal_name),
      inn: stringOrNull(row.inn),
      kpp: stringOrNull(row.kpp),
      ogrn: stringOrNull(row.ogrn),
      legal_address: stringOrNull(row.legal_address),
      vat_info: stringOrNull(row.vat_info),
      footer_text: stringOrNull(row.footer_text),
      footer_disclaimer: stringOrNull(row.footer_disclaimer),
    };
  } catch (error) {
    if (allowMockFallback()) return defaultSettings;
    throw error;
  }
}

export async function getNavigation(location: "header" | "footer" | "legal"): Promise<NavigationItem[]> {
  const fallback = location === "header" ? fallbackHeader : location === "footer" ? fallbackFooter : [];
  if (isMockMode()) return fallback;

  try {
    const params = new URLSearchParams({
      fields: "id,label,url,location,open_in_new_tab",
      limit: "100",
      sort: "sort_order",
      filter: JSON.stringify({
        _and: [
          { status: { _eq: "published" } },
          { is_visible: { _eq: true } },
          { location: { _eq: location } },
          { parent: { _null: true } },
        ],
      }),
    });
    const result = await directusFetch<{ data: Record<string, unknown>[] }>(
      `/items/navigation_items?${params.toString()}`,
      { revalidate: 120 },
    );

    const items = (result.data ?? []).flatMap((row): NavigationItem[] => {
      const label = String(row.label ?? "").trim();
      const url = safeContentHref(String(row.url ?? ""));
      if (!label || !url) return [];
      return [{
        id: String(row.id ?? row.url ?? row.label ?? ""),
        label,
        url,
        location,
        open_in_new_tab: row.open_in_new_tab === true,
      }];
    });

    return items.length ? items : fallback;
  } catch {
    return fallback;
  }
}

export async function getCmsPage(slug: string): Promise<CmsPage | null> {
  if (isMockMode()) return null;

  const params = new URLSearchParams({
    fields: "id,title,slug,page_type,h1,eyebrow,intro,seo_title,seo_description,seo_text,og_image,canonical_url,is_indexable",
    limit: "1",
    filter: JSON.stringify({
      _and: [
        { status: { _eq: "published" } },
        { slug: { _eq: slug } },
      ],
    }),
  });

  try {
    const result = await directusFetch<{ data: Record<string, unknown>[] }>(
      `/items/pages?${params.toString()}`,
      { revalidate: 120 },
    );
    const row = result.data?.[0];
    if (!row) return null;
    const id = String(row.id ?? "");
    const sections = id ? await getSections({ page: { _eq: id } }) : [];

    return {
      id,
      title: String(row.title ?? ""),
      slug: String(row.slug ?? slug),
      page_type: String(row.page_type ?? "standard"),
      h1: String(row.h1 ?? row.title ?? ""),
      eyebrow: stringOrNull(row.eyebrow),
      intro: stringOrNull(row.intro),
      seo_title: stringOrNull(row.seo_title),
      seo_description: stringOrNull(row.seo_description),
      seo_text: stringOrNull(row.seo_text),
      og_image: stringOrNull(row.og_image),
      canonical_url: stringOrNull(row.canonical_url),
      is_indexable: row.is_indexable !== false,
      sections,
    };
  } catch (error) {
    if (allowMockFallback()) return null;
    throw error;
  }
}

export async function getCmsHome(): Promise<CmsHome | null> {
  if (isMockMode()) return null;

  try {
    const result = await directusFetch<{ data: unknown }>(
      "/items/home_page?fields=id,status,h1,hero_title,hero_text,hero_image,hero_image_alt,hero_primary_button_text,hero_primary_button_url,hero_secondary_button_text,hero_secondary_button_url,hero_search_label,hero_search_placeholder,hero_search_button_text,seo_title,seo_description,canonical_url,is_indexable",
      { revalidate: 120 },
    );
    const row = objectRow(result.data);
    if (!row || row.status !== "published") return null;
    const id = String(row.id ?? "");
    const sections = id ? await getSections({ home_page: { _eq: id } }) : [];

    return {
      h1: String(row.h1 ?? row.hero_title ?? ""),
      hero_title: String(row.hero_title ?? row.h1 ?? ""),
      hero_text: String(row.hero_text ?? ""),
      hero_image: stringOrNull(row.hero_image),
      hero_image_alt: stringOrNull(row.hero_image_alt),
      hero_primary_button_text: stringOrNull(row.hero_primary_button_text),
      hero_primary_button_url: stringOrNull(row.hero_primary_button_url),
      hero_secondary_button_text: stringOrNull(row.hero_secondary_button_text),
      hero_secondary_button_url: stringOrNull(row.hero_secondary_button_url),
      hero_search_label: stringOrNull(row.hero_search_label),
      hero_search_placeholder: stringOrNull(row.hero_search_placeholder),
      hero_search_button_text: stringOrNull(row.hero_search_button_text),
      seo_title: stringOrNull(row.seo_title),
      seo_description: stringOrNull(row.seo_description),
      canonical_url: stringOrNull(row.canonical_url),
      is_indexable: row.is_indexable !== false,
      sections,
    };
  } catch (error) {
    if (allowMockFallback()) return null;
    throw error;
  }
}

export async function getIndexableCmsPages(): Promise<Array<{ slug: string; updated_at?: string | null }>> {
  if (isMockMode()) return [];

  try {
    const params = new URLSearchParams({
      fields: "slug,updated_at",
      limit: "500",
      sort: "slug",
      filter: JSON.stringify({
        _and: [
          { status: { _eq: "published" } },
          { is_indexable: { _eq: true } },
        ],
      }),
    });
    const result = await directusFetch<{ data: Array<{ slug?: unknown; updated_at?: unknown }> }>(
      `/items/pages?${params.toString()}`,
      { revalidate: 300 },
    );
    return (result.data ?? [])
      .map((row) => ({
        slug: String(row.slug ?? "").trim(),
        updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
      }))
      .filter((row) => row.slug);
  } catch (error) {
    if (allowMockFallback()) return [];
    throw error;
  }
}

export function safeContentHref(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(mailto|tel):/i.test(trimmed)) return trimmed;
  return null;
}
