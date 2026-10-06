import type { Metadata } from "next";
import "./theme.css";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getSiteSettings } from "@/lib/catalog";
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
  const settings = await getSiteSettings();
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.company_name,
    email: settings.email,
    telephone: settings.phone,
    url: getSiteUrl().toString(),
  };

  return (
    <html lang="ru">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(organization) }} />
        <Header settings={settings} />
        <main>{children}</main>
        <Footer settings={settings} />
      </body>
    </html>
  );
}
