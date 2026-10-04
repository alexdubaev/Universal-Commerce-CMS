"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function SearchBox({ compact = false, initial = "" }: { compact?: boolean; initial?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initial);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `/catalog?q=${encodeURIComponent(value)}` : "/catalog");
  }

  return (
    <form className={compact ? "search-box compact" : "search-box"} onSubmit={submit} role="search">
      <span className="search-icon" aria-hidden="true">⌕</span>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Введите артикул, OEM, название или бренд"
        aria-label="Поиск запчастей"
      />
      <button type="submit">Найти</button>
    </form>
  );
}
