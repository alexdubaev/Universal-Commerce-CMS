"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useEffect, useRef, useState } from "react";
import type { Brand, Category, NavigationItem, SiteSettings } from "@/lib/types";
import { SearchBox } from "./SearchBox";

function NavEntry({ item, onClick }: { item: NavigationItem; onClick: () => void }) {
  const label = item.url === "/request" ? "Корзина" : item.label;
  const external = !item.url.startsWith("/");
  if (external) return <a href={item.url} target={item.open_in_new_tab ? "_blank" : undefined} rel={item.open_in_new_tab ? "noreferrer" : undefined} onClick={onClick}>{label}</a>;
  return <Link href={item.url} onClick={onClick}>{label}</Link>;
}

export function Header({ settings, navigation, categories, brands, searchPlaceholder, searchButtonLabel }: {
  settings: SiteSettings;
  navigation: NavigationItem[];
  categories: Category[];
  brands: Brand[];
  searchPlaceholder?: string;
  searchButtonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const catalogRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const read = () => {
      try {
        const items = JSON.parse(localStorage.getItem("smtechno-request") ?? "[]") as Array<{ quantity?: number }>;
        setRequestCount(items.reduce((sum, item) => sum + Number(item.quantity ?? 1), 0));
      } catch { setRequestCount(0); }
    };
    read();
    window.addEventListener("request-updated", read);
    window.addEventListener("storage", read);
    return () => { window.removeEventListener("request-updated", read); window.removeEventListener("storage", read); };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!open && !catalogRef.current?.open) return;
      const menuWasOpen = open;
      if (menuWasOpen) setOpen(false);
      if (catalogRef.current) catalogRef.current.open = false;
      window.requestAnimationFrame(() => {
        if (menuWasOpen) menuButtonRef.current?.focus();
        else catalogRef.current?.querySelector("summary")?.focus();
      });
    };
    const onPointerDown = (event: PointerEvent) => {
      if (catalogRef.current && !catalogRef.current.contains(event.target as Node)) catalogRef.current.open = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("pointerdown", onPointerDown); };
  }, [open]);

  const close = () => {
    setOpen(false);
    if (catalogRef.current) catalogRef.current.open = false;
  };
  return (<header className="site-header">
    <div className="shell header-inner">
      <Link className="brand" href="/" onClick={close} aria-label={`${settings.company_name} — главная`}>
        <img className="brand-logo" src="/images/sm-techno-logo-transparent.webp" alt="" width="220" height="86" />
      </Link>
      <details className="catalog-menu" ref={catalogRef}>
        <summary>Каталог <span aria-hidden="true">⌄</span></summary>
        <div className="catalog-menu-panel">
          <section><strong>Категории</strong><Link href="/catalog" onClick={close}>Все товары</Link>
            {categories.map((category) => <Link href={`/category/${category.slug}`} key={category.slug} onClick={close}>{category.title}</Link>)}
          </section>
          <section><strong>Бренды</strong><Link href="/brands" onClick={close}>Все бренды</Link>
            {brands.map((brand) => <Link href={`/brand/${brand.slug}`} key={brand.slug} onClick={close}>{brand.name}</Link>)}
          </section>
        </div>
      </details>
      <div id="article-search" className="header-search">
        <Suspense fallback={<SearchBox compact placeholder={searchPlaceholder} buttonLabel={searchButtonLabel} />}>
          <HeaderSearch placeholder={searchPlaceholder} buttonLabel={searchButtonLabel} />
        </Suspense>
      </div>
      <div className="header-actions">
        <a className="header-phone" href={`tel:${settings.phone.replace(/[^+\d]/g, "")}`}><strong>{settings.phone}</strong><small>{settings.email}</small></a>
        <Link className="request-link" href="/request" aria-label={`Корзина${requestCount ? `, позиций: ${requestCount}` : ""}`}>
          <img className="request-icon" src="/images/cart-icon-black.webp" alt="" width="20" height="20" aria-hidden="true" /><span className="request-label">Корзина</span>{requestCount > 0 && <b>{requestCount}</b>}
        </Link>
      </div>
      <button ref={menuButtonRef} className="menu-toggle" type="button" aria-expanded={open} aria-label={open ? "Закрыть меню" : "Открыть меню"} onClick={() => setOpen((value) => !value)}>
        <span /><span /><span />
      </button>
    </div>
    <nav className={open ? "main-nav is-open" : "main-nav"} aria-label="Основная навигация">
      <div className="shell main-nav-inner">{navigation.map((item) => <NavEntry item={item} onClick={close} key={item.id} />)}</div>
    </nav>
  </header>);
}

function HeaderSearch({ placeholder, buttonLabel }: { placeholder?: string; buttonLabel?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = pathname === "/catalog" ? searchParams.get("q") ?? "" : "";
  return <SearchBox key={initial} compact initial={initial} placeholder={placeholder} buttonLabel={buttonLabel} />;
}
