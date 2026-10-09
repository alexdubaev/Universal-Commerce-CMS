import type { Metadata } from "next";
import Link from "next/link";
import { CmsPageRenderer } from "@/components/CmsPageRenderer";
import { QuickLeadForm } from "@/components/QuickLeadForm";
import { getSiteSettings } from "@/lib/catalog";
import { getCmsPage } from "@/lib/content";
import { absoluteUrl, safeCanonicalUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCmsPage("contacts");
  const title = page?.seo_title || page?.title || "Контакты";
  const description = page?.seo_description || page?.intro || "Контакты СМ ТЕХНО для заявок и подбора запчастей для спецтехники.";
  return {
    title,
    description,
    alternates: { canonical: safeCanonicalUrl(page?.canonical_url, "/contacts") },
    robots: page?.is_indexable === false ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website", title, description, url: absoluteUrl("/contacts"),
      images: [{ url: absoluteUrl(page?.og_image ? `/api/assets/${page.og_image}` : "/images/hero-industrial-v3.webp") }],
    },
  };
}

function ContactGrid({ settings }: { settings: Awaited<ReturnType<typeof getSiteSettings>> }) {
  const location = [settings.city, settings.address].filter(Boolean).join(", ");
  return (
    <div className="contact-grid">
      <section className="panel contact-card">
        <div><small>Телефон</small><a href={`tel:${settings.phone.replace(/[^+\d]/g, "")}`}>{settings.phone}</a></div>
        <div><small>Email</small><a href={`mailto:${settings.email}`}>{settings.email}</a></div>
        <div><small>Режим работы</small><strong>{settings.working_hours || "Уточните у менеджера"}</strong></div>
        <div><small>Адрес</small><strong>{location || "Уточните у менеджера"}</strong></div>
        {(settings.inn || settings.kpp || settings.ogrn) && (
          <div>
            <small>Реквизиты</small>
            <strong>{[settings.inn && `ИНН ${settings.inn}`, settings.kpp && `КПП ${settings.kpp}`, settings.ogrn && `ОГРН ${settings.ogrn}`].filter(Boolean).join(" · ")}</strong>
          </div>
        )}
        <div className="contact-map">
          <span>КОНТАКТЫ</span>
          <strong>{settings.city || settings.company_name}</strong>
          <small>{settings.address || "Перед посещением уточните адрес по телефону или email"}</small>
        </div>
      </section>
      <QuickLeadForm title="Написать нам" />
    </div>
  );
}

export default async function ContactsPage() {
  const [page, settings] = await Promise.all([getCmsPage("contacts"), getSiteSettings()]);

  if (page) {
    return (
      <>
        <CmsPageRenderer page={page} />
        <div className="shell contact-cms-tail">
          <ContactGrid settings={settings} />
        </div>
      </>
    );
  }

  return (
    <div className="shell page-shell">
      <div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>Контакты</span></div>
      <div className="page-title">

        <h1>Контакты</h1>
        <p>Свяжитесь с нами по телефону, email или через форму. Для расчёта укажите артикулы и количество; сведения о технике добавьте в комментарий.</p>
      </div>
      <ContactGrid settings={settings} />
    </div>
  );
}
