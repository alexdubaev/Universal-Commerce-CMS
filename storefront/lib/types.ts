export type Availability = "in_stock" | "on_request" | "out_of_stock";
export type PriceStatus = "fixed" | "on_request" | "hidden";
export type PartType = "original" | "oem" | "analog";

export type Category = {
  id?: string;
  slug: string;
  title: string;
};

export type Product = {
  id: string;
  slug: string;
  title: string;
  sku: string;
  mpn?: string | null;
  brand: string;
  short_description?: string | null;
  full_description?: string | null;
  price?: number | null;
  currency?: string | null;
  price_status: PriceStatus;
  availability_status: Availability;
  part_type?: PartType | null;
  main_image?: string | null;
  category?: Category | null;
  specifications?: Record<string, string | number> | null;
  delivery_status?: string | null;
};

export type ProductList = {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  source: "directus" | "mock";
};

export type SiteSettings = {
  company_name: string;
  phone: string;
  email: string;
  primary_cta_text: string;
  primary_cta_url: string;
};

export type Brand = {
  slug: string;
  name: string;
  description: string;
  accent: string;
};

export type RequestItem = {
  article: string;
  title: string;
  brand: string;
  quantity: number;
};
