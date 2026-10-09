"use client";

import type { ReactNode } from "react";

export function SearchFocusLink({ children }: { children: ReactNode }) {
  return (
    <a href="#header-article-search" onClick={(event) => {
      const input = document.getElementById("header-article-search");
      if (!(input instanceof HTMLInputElement) || input.disabled) return;
      event.preventDefault();
      input.scrollIntoView({ block: "center", behavior: "instant" });
      input.focus({ preventScroll: true });
    }}>
      {children}
    </a>
  );
}
