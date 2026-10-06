export type Availability = "in_stock" | "on_request" | "out_of_stock";
export type PriceStatus = "fixed" | "on_request" | "hidden";
export type PartType = "original" | "oem" | "analog";
export type SortOption = "popular" | "price_asc" | "price_desc" | "title";

export type Category = {
  id?: string;
  slug: string;
  title: string;
  description?: string | null;
  h1?: string | null;
  intro?: string | null;
  image?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  is_indexable?: boolean;
};

export type ProductCode = {
  code: string;
  code_type: "oem" | "mpn" | "supplier" | "previous" | "superseded" | "external" | "barcode";
  source_name?: string | null;
};

export type ProductImage = {
  image: string;
  alt_text?: string | null;
};

export type ProductDocument = {
  file: string;
  title?: string | null;
};

export type ProductSpecification = {
  group_name?: string | null;
  name: string;
  value: string;
  unit?: string | null;
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
  seo_title?: string | null;
  seo_description?: string | null;
  date_updated?: string | null;
};

export type ProductRelation = {
  relation_type: "analog" | "oem_cross" | "compatible" | "superseded_by";
  product: Product;
};

export type ProductDetail = Product & {
  codes: ProductCode[];
  images: ProductImage[];
  documents: ProductDocument[];
  specification_items: ProductSpecification[];
  relations: ProductRelation[];
};

export type ProductList = {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  source: "directus" | "mock";
};

export type CatalogQuery = {
  brand?: string;
  category?: string;
  q?: string;
  availability?: Availability;
  partType?: PartType;
  sort?: SortOption;
  page?: number;
  limit?: number;
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
