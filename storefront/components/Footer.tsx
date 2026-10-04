import Link from "next/link";
import type { SiteSettings } from "@/lib/types";

export function Footer({ settings }: { settings: SiteSettings }) {
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
          <p>Демонстрационная витрина Universal Commerce CMS. Товары и цены в mock-режиме являются вымышленными.</p>
        </div>
        <div>
          <strong>Покупателям</strong>
          <Link href="/catalog">Каталог</Link>
          <Link href="/delivery">Доставка</Link>
          <Link href="/payment">Оплата</Link>
          <Link href="/request">Заявка по списку</Link>
        </div>
        <div>
          <strong>Компания</strong>
          <Link href="/about">О компании</Link>
          <Link href="/contacts">Контакты</Link>
          <a href={`mailto:${settings.email}`}>{settings.email}</a>
          <a href={`tel:${settings.phone.replace(/[^+\d]/g, "")}`}>{settings.phone}</a>
        </div>
        <div className="footer-note">
          <span>Только B2B</span>
          <p>Счёт, НДС, закрывающие документы. Условия являются демонстрационными до подключения профиля магазина.</p>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© {new Date().getFullYear()} {settings.company_name}</span>
        <span>Universal Commerce Storefront</span>
      </div>
    </footer>
  );
}
