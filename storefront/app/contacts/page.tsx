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
  const location = [settings.city, settings.address].filter(Boolean).join(", ");

  return (
    <div className="shell page-shell">
      <div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>Контакты</span></div>
      <div className="page-title">
        <span className="eyebrow">Связаться с нами</span>
        <h1>Контакты</h1>
        <p>Позвоните, напишите или отправьте заявку через сайт — контактные данные берутся из настроек магазина.</p>
      </div>
      <div className="contact-grid">
        <section className="panel contact-card">
          <div><small>Телефон</small><a href={`tel:${settings.phone.replace(/[^+\d]/g, "")}`}>{settings.phone}</a></div>
          <div><small>Email</small><a href={`mailto:${settings.email}`}>{settings.email}</a></div>
          <div><small>Режим работы</small><strong>{settings.working_hours || "Уточните у менеджера"}</strong></div>
          <div><small>Адрес</small><strong>{location || "Уточните у менеджера"}</strong></div>
          <div className="contact-map">
            <span>КОНТАКТЫ</span>
            <strong>{settings.city || settings.company_name}</strong>
            <small>{settings.address || "Адрес и схема проезда указываются в настройках магазина"}</small>
          </div>
        </section>
        <QuickLeadForm title="Написать нам" />
      </div>
    </div>
  );
}
