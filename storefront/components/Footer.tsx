import Link from "next/link";
import type { NavigationItem, SiteSettings } from "@/lib/types";

function FooterLink({ item }: { item: NavigationItem }) {
  const label = item.url === "/request" ? "Корзина" : item.label;
  const external = !item.url.startsWith("/");
  if (external) {
    return <a href={item.url} target={item.open_in_new_tab ? "_blank" : undefined} rel={item.open_in_new_tab ? "noreferrer" : undefined}>{label}</a>;
  }
  return <Link href={item.url}>{label}</Link>;
}

export function Footer({
  settings,
  navigation,
  legal,
}: {
  settings: SiteSettings;
  navigation: NavigationItem[];
  legal: NavigationItem[];
}) {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <div className="brand footer-brand">
            <img className="brand-logo" src="/images/sm-techno-logo-transparent.webp" alt={settings.company_name} width="240" height="93" />
          </div>
          <p>{settings.footer_text || "B2B-каталог и поставка запчастей для спецтехники."}</p>
        </div>

        <div>
          <strong>Разделы</strong>
          {navigation.map((item) => <FooterLink item={item} key={item.id} />)}
        </div>

        <div>
          <strong>Контакты</strong>
          <a href={`mailto:${settings.email}`}>{settings.email}</a>
          <a href={`tel:${settings.phone.replace(/[^+\d]/g, "")}`}>{settings.phone}</a>
          {settings.address && <span>{[settings.city, settings.address].filter(Boolean).join(", ")}</span>}
          {settings.working_hours && <span>{settings.working_hours}</span>}
        </div>

        <div className="footer-note">
          <span>B2B</span>
          <p>{settings.footer_disclaimer || "Условия поставки, оплаты и документы подтверждаются менеджером при оформлении заявки."}</p>
        </div>
      </div>

      <div className="shell footer-bottom">
        <span>© {new Date().getFullYear()} {settings.company_name}</span>
        <div className="footer-legal">
          {legal.length
            ? legal.map((item) => <FooterLink item={item} key={item.id} />)
            : <Link href="/contacts">Контакты и реквизиты</Link>}
        </div>
      </div>
    </footer>
  );
}
