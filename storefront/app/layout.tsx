import type { Metadata } from "next";
import "./theme.css";
import "./globals.css";
import "@/styles/home-ux.css";
import "@/styles/catalog-ux.css";
import "@/styles/request-ux.css";
import "@/components/articles/articles.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MotionEnhancements } from "@/components/MotionEnhancements";
import { getCmsHome, getCmsSiteSettings, getNavigation } from "@/lib/content";
import { getBrands, getCategories } from "@/lib/catalog";
import { getSiteUrl, safeJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "СМ ТЕХНО — запчасти для спецтехники",
    template: "%s | СМ ТЕХНО",
  },
  description: "B2B-каталог запчастей для спецтехники: поиск по артикулу, оригиналы и аналоги, заявки по списку.",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "СМ ТЕХНО",
  },
  twitter: { card: "summary_large_image" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [settings, headerNav, footerNav, legalNav, categories, brands, cmsHome] = await Promise.all([
    getCmsSiteSettings(),
    getNavigation("header"),
    getNavigation("footer"),
    getNavigation("legal"),
    getCategories().catch(() => []),
    getBrands().catch(() => []),
    getCmsHome().catch(() => null),
  ]);

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.legal_name || settings.company_name,
    email: settings.email,
    telephone: settings.phone,
    address: settings.legal_address || settings.address || undefined,
    taxID: settings.inn || undefined,
    url: getSiteUrl().toString(),
  };

  return (
    <html lang="ru">
      <body>
        <MotionEnhancements />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(organization) }} />
        <a className="skip-link" href="#main-content" tabIndex={0}>К основному содержимому</a>
        <Header
          settings={settings}
          navigation={headerNav}
          categories={categories}
          brands={brands}
          searchPlaceholder={cmsHome?.hero_search_placeholder || undefined}
          searchButtonLabel={cmsHome?.hero_search_button_text || undefined}
        />
        <main id="main-content" tabIndex={-1}>{children}</main>
        <Footer settings={settings} navigation={footerNav} legal={legalNav} />
      </body>
    </html>
  );
}
