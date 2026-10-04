import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getSiteSettings } from "@/lib/catalog";

export const metadata: Metadata = {
  title: {
    default: "СМ ТЕХНО — запчасти для спецтехники",
    template: "%s | СМ ТЕХНО",
  },
  description: "B2B-каталог запчастей для спецтехники: поиск по артикулу, оригиналы и аналоги, заявки по списку.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSiteSettings();
  return (
    <html lang="ru">
      <body>
        <Header settings={settings} />
        <main>{children}</main>
        <Footer settings={settings} />
      </body>
    </html>
  );
}
