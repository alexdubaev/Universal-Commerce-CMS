// Synthetic records only. All records stay drafts; no real brand, contact or price data.
export const demoContent = Object.freeze({
  site_settings: [
    {
      company_name: "Demo Commerce",
      phone: "+7 000 000-00-00",
      email: "demo@example.test",
      primary_color: "#2563eb",
      accent_color: "#f59e0b",
      commerce_profile: {
        site_id: "synthetic-demo",
        currency: "RUB",
        features: { cart: false, parts_request: false },
      },
      primary_cta_text: "Request information",
      primary_cta_url: "/contacts",
      footer_text: "Synthetic draft content for local CMS evaluation.",
    },
  ],
  pages: [
    {
      status: "draft",
      title: "Demonstration page",
      slug: "demo-page",
      page_type: "standard",
      h1: "A synthetic commerce page",
      intro: "Replace this draft with content configured for your website.",
      is_indexable: false,
    },
  ],
  products: [
    {
      status: "draft",
      title: "Demonstration product",
      slug: "demo-product",
      sku: "SAMPLE-001",
      brand: "Example Manufacturer",
      short_description: "Synthetic item for checking product editing and saving.",
      full_description: "This draft contains no real product, price, availability, or specification claims.",
      currency: "RUB",
      price_status: "on_request",
      availability_status: "on_request",
      part_type: "original",
      is_featured: false,
      show_on_homepage: false,
    },
  ],
});
