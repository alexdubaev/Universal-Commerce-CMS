"use client";

import { useEffect, useRef } from "react";

export function ResponsiveFilters({ children }: { children: React.ReactNode }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 820px)");
    const sync = () => {
      if (detailsRef.current) detailsRef.current.open = !query.matches;
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return <details ref={detailsRef} className="filter-disclosure" open>{children}</details>;
}
