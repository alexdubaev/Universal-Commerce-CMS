"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SiteSettings } from "@/lib/types";

export function Header({ settings }: { settings: SiteSettings }) {
  const [open, setOpen] = useState(false);
  const [requestCount, setRequestCount] = useState(0);

  useEffect(() => {
    const read = () => {
      try {
        const items = JSON.parse(localStorage.getItem("smtechno-request") ?? "[]") as Array<{ quantity?: number }>;
        setRequestCount(items.reduce((sum, item) => sum + Number(item.quantity ?? 1), 0));
      } catch {
        setRequestCount(0);
      }
    };
    read();
    window.addEventListener("request-updated", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("request-updated", read);
      window.removeEventListener("storage", read);
    };
  }, []);

  const close = () => setOpen(false);

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" onClick={close} aria-label="СМ ТЕХНО — главная">
          <span className="brand-mark" aria-hidden="true">◆</span>
          <span>
            <strong>{settings.company_name}</strong>
            <small>запчасти для спецтехники</small>
          </span>
        </Link>

        <button
          className="menu-toggle"
          type="button"
          aria-expanded={open}
          aria-label="Открыть меню"
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={open ? "main-nav is-open" : "main-nav"} aria-label="Основная навигация">
          <Link href="/catalog" onClick={close}>Каталог</Link>
          <Link href="/#brands" onClick={close}>Бренды</Link>
          <Link href="/delivery" onClick={close}>Доставка</Link>
          <Link href="/payment" onClick={close}>Оплата</Link>
          <Link href="/about" onClick={close}>О компании</Link>
          <Link href="/contacts" onClick={close}>Контакты</Link>
        </nav>

        <div className="header-actions">
          <a className="header-phone" href={`tel:${settings.phone.replace(/[^+\d]/g, "")}`}>
            <strong>{settings.phone}</strong>
            <small>Заказать звонок</small>
          </a>
          <Link className="request-link" href="/request" aria-label="Открыть заявку">
            <span aria-hidden="true">▣</span>
            <span className="request-label">Заявка</span>
            {requestCount > 0 && <b>{requestCount}</b>}
          </Link>
        </div>
      </div>
    </header>
  );
}
