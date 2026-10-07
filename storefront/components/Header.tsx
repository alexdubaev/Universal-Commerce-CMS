"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRequestCount } from "@/hooks/useRequestItems";
import type { NavigationItem, SiteSettings } from "@/lib/types";

function NavEntry({ item, onClick }: { item: NavigationItem; onClick: () => void }) {
  const external = !item.url.startsWith("/");
  if (external) {
    return <a href={item.url} target={item.open_in_new_tab ? "_blank" : undefined} rel={item.open_in_new_tab ? "noreferrer" : undefined} onClick={onClick}>{item.label}</a>;
  }
  return <Link href={item.url} onClick={onClick}>{item.label}</Link>;
}

export function Header({ settings, navigation }: { settings: SiteSettings; navigation: NavigationItem[] }) {
  const [open, setOpen] = useState(false);
  const requestCount = useRequestCount();
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      window.requestAnimationFrame(() => menuButtonRef.current?.focus());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" onClick={close} aria-label={`${settings.company_name} — главная`}>
          <span className="brand-mark" aria-hidden="true">◆</span>
          <span>
            <strong>{settings.company_name}</strong>
            <small>запчасти для спецтехники</small>
          </span>
        </Link>

        <button
          ref={menuButtonRef}
          className="menu-toggle"
          type="button"
          aria-expanded={open}
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={open ? "main-nav is-open" : "main-nav"} aria-label="Основная навигация">
          {navigation.map((item) => <NavEntry item={item} onClick={close} key={item.id} />)}
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
