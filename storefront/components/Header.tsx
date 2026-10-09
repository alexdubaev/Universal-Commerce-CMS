"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useEffect, useRef, useState } from "react";
import { useRequestCount } from "@/hooks/useRequestItems";
import type { Brand, Category, NavigationItem, SiteSettings } from "@/lib/types";
import { SearchBox } from "./SearchBox";

function NavEntry({ item, onClick }: { item: NavigationItem; onClick: () => void }) {
  const label = item.url === "/request" ? "Ваша заявка" : item.label;
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
  const requestCount = useRequestCount();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const catalogRef = useRef<HTMLDetailsElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const articleNavigation = navigation.filter((item) => item.url.split(/[?#]/)[0].replace(/\/+$/, "") === "/articles");
  const mainNavigation = navigation.filter((item) => !articleNavigation.includes(item));

  useEffect(() => {
    if (!open) return;
    if (catalogRef.current) catalogRef.current.open = false;
    const frame = window.requestAnimationFrame(() => navRef.current?.querySelector<HTMLAnchorElement>("a")?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

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
        <Suspense fallback={<SearchBox compact inputId="header-article-search" placeholder={searchPlaceholder} buttonLabel={searchButtonLabel} />}>
          <HeaderSearch placeholder={searchPlaceholder} buttonLabel={searchButtonLabel} />
        </Suspense>
      </div>
      <div className="header-actions">
        <div className="header-contacts">
          <a className="header-phone" href={`tel:${settings.phone.replace(/[^+\d]/g, "")}`}><strong>{settings.phone}</strong></a>
          <a className="header-email" href={`mailto:${settings.email}`}>{settings.email}</a>
        </div>
        <Link className="request-link" href="/request" aria-label={`Ваша заявка${requestCount ? `, позиций: ${requestCount}` : ""}`}>
          <img className="request-icon" src="/images/cart-icon-black.webp" alt="" width="20" height="20" aria-hidden="true" /><span className="request-label">Заявка</span>{requestCount > 0 && <b>{requestCount}</b>}
        </Link>
      </div>
      <button ref={menuButtonRef} className="menu-toggle" type="button" aria-expanded={open} aria-controls="main-navigation" aria-label={open ? "Закрыть меню" : "Открыть меню"} onClick={() => setOpen((value) => !value)}>
        <span /><span /><span />
      </button>
    </div>
    <nav ref={navRef} id="main-navigation" className={open ? "main-nav is-open" : "main-nav"} aria-label="Основная навигация">
      <div className="shell main-nav-inner">
        {mainNavigation.map((item) => <NavEntry item={item} onClick={close} key={item.id} />)}
        {articleNavigation.length ? <NavEntry item={{ ...articleNavigation[0], label: "Статьи" }} onClick={close} /> : <Link href="/articles" onClick={close}>Статьи</Link>}
      </div>
    </nav>
  </header>);
}

function HeaderSearch({ placeholder, buttonLabel }: { placeholder?: string; buttonLabel?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = pathname === "/catalog" ? searchParams.get("q") ?? "" : "";
  return <SearchBox key={initial} compact inputId="header-article-search" initial={initial} placeholder={placeholder} buttonLabel={buttonLabel} />;
}
