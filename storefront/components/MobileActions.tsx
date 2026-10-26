"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRequestCount } from "@/hooks/useRequestItems";

const fieldSelector = 'input:not([type="hidden"]), select, textarea, [contenteditable="true"]';

export function MobileActions() {
  const requestCount = useRequestCount();
  const [fieldFocused, setFieldFocused] = useState(false);

  useEffect(() => {
    const updateFocus = () => setFieldFocused(Boolean(document.activeElement?.matches(fieldSelector)));
    const onFocusIn = (event: FocusEvent) => {
      if ((event.target as HTMLElement | null)?.matches(fieldSelector)) setFieldFocused(true);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", updateFocus);
    updateFocus();
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", updateFocus);
    };
  }, []);

  const focusSearch = () => {
    const input = document.getElementById("header-article-search");
    if (!(input instanceof HTMLInputElement)) return;
    input.focus({ preventScroll: true });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("article-search")?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <nav className={`mobile-actions${fieldFocused ? " is-field-focused" : ""}`} aria-label="Быстрая навигация">
      <button type="button" className="mobile-action" onClick={focusSearch} aria-label="Перейти к поиску">
        <span className="mobile-action-icon" aria-hidden="true">⌕</span><span>Поиск</span>
      </button>
      <Link className="mobile-action" href="/catalog">
        <span className="mobile-action-icon" aria-hidden="true">▦</span><span>Каталог</span>
      </Link>
      <Link className="mobile-action mobile-action-cart" href="/request" aria-label={`Открыть корзину${requestCount ? `, позиций: ${requestCount}` : ""}`}>
        <span className="mobile-action-icon mobile-cart-icon" aria-hidden="true"><img src="/images/cart-icon-black.webp" alt="" width="20" height="20" />{requestCount > 0 && <b>{requestCount}</b>}</span><span>Корзина</span>
      </Link>
    </nav>
  );
}
