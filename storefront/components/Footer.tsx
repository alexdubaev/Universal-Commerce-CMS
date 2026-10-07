import Link from "next/link";
import type { NavigationItem, SiteSettings } from "@/lib/types";

function FooterLink({ item }: { item: NavigationItem }) {
  const external = !item.url.startsWith("/");
  if (external) {
    return <a href={item.url} target={item.open_in_new_tab ? "_blank" : undefined} rel={item.open_in_new_tab ? "noreferrer" : undefined}>{item.label}</a>;
  }
  return <Link href={item.url}>{item.label}</Link>;
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
  const midpoint = Math.ceil(navigation.length / 2);
  const first = navigation.slice(0, midpoint);
  const second = navigation.slice(midpoint);

  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <div className="brand footer-brand">
            <span className="brand-mark" aria-hidden="true">◆</span>
            <span>
              <strong>{settings.company_name}</strong>
              <small>запчасти для спецтехники</small>
            </span>
          </div>
          <p>{settings.footer_text || "B2B-каталог и поставка запчастей для спецтехники."}</p>
        </div>

        <div>
          <strong>Навигация</strong>
          {first.map((item) => <FooterLink item={item} key={item.id} />)}
        </div>

        <div>
          <strong>Компания</strong>
          {second.map((item) => <FooterLink item={item} key={item.id} />)}
          <a href={`mailto:${settings.email}`}>{settings.email}</a>
          <a href={`tel:${settings.phone.replace(/[^+\d]/g, "")}`}>{settings.phone}</a>
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
