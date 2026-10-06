import type { Metadata } from "next";
import Link from "next/link";
import { QuickLeadForm } from "@/components/QuickLeadForm";
import { getSiteSettings } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Контакты",
  description: "Контакты СМ ТЕХНО для заявок и подбора запчастей для спецтехники.",
  alternates: { canonical: "/contacts" },
};

export default async function ContactsPage() {
  const settings = await getSiteSettings();
  return (
    <div className="shell page-shell">
      <div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>Контакты</span></div>
      <div className="page-title">
        <span className="eyebrow">Всегда на связи</span>
        <h1>Контакты</h1>
        <p>Контактные данные уже читаются из site_settings при подключённом Directus.</p>
      </div>
      <div className="contact-grid">
        <section className="panel contact-card">
          <div><small>Телефон</small><a href={`tel:${settings.phone.replace(/[^+\d]/g, "")}`}>{settings.phone}</a></div>
          <div><small>Email</small><a href={`mailto:${settings.email}`}>{settings.email}</a></div>
          <div><small>Режим работы</small><strong>Пн–Пт · 9:00–18:00</strong></div>
          <div><small>Офис</small><strong>Санкт-Петербург · демонстрационный адрес</strong></div>
          <div className="contact-map"><span>59.93° N</span><strong>САНКТ-ПЕТЕРБУРГ</strong><small>Карта подключается отдельной интеграцией</small></div>
        </section>
        <QuickLeadForm title="Написать нам" />
      </div>
    </div>
  );
}
