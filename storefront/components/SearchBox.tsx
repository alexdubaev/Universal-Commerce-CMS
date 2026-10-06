"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";

const HISTORY_KEY = "smtechno-search-history";

function readHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

function saveHistory(query: string) {
  const clean = query.trim();
  if (!clean) return;
  const next = [clean, ...readHistory().filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

export function SearchBox({
  compact = false,
  initial = "",
  placeholder = "Введите артикул или OEM-номер",
  buttonLabel = "Найти",
}: {
  compact?: boolean;
  initial?: string;
  placeholder?: string;
  buttonLabel?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initial);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      controller.current?.abort();
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      controller.current?.abort();
      const nextController = new AbortController();
      controller.current = nextController;
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(value)}`, { signal: nextController.signal });
        if (!response.ok) return;
        const payload = await response.json() as { data?: Product[] };
        setSuggestions((payload.data ?? []).slice(0, 6));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setSuggestions([]);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [query]);

  function go(value: string) {
    const clean = value.trim();
    if (!clean) {
      router.push("/catalog");
      return;
    }
    saveHistory(clean);
    setHistory(readHistory());
    setOpen(false);
    router.push(`/catalog?q=${encodeURIComponent(clean)}`);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    go(query);
  }

  const showHistory = open && !query.trim() && history.length > 0;
  const showSuggestions = open && query.trim().length >= 2 && suggestions.length > 0;

  return (
    <div className={compact ? "search-wrap compact" : "search-wrap"}>
      <form className={compact ? "search-box compact" : "search-box"} onSubmit={submit} role="search">
        <span className="search-icon" aria-hidden="true">⌕</span>
        <input
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); setHistory(readHistory()); }}
          onBlur={() => window.setTimeout(() => setOpen(false), 160)}
          placeholder={placeholder}
          aria-label="Поиск запчастей"
          aria-expanded={showHistory || showSuggestions}
          autoComplete="off"
        />
        <button type="submit">{buttonLabel}</button>
      </form>

      {(showHistory || showSuggestions) && (
        <div className="search-popover">
          {showHistory && (
            <>
              <div className="search-popover-title">Недавние запросы</div>
              {history.map((item) => (
                <button type="button" className="history-item" key={item} onMouseDown={(event) => event.preventDefault()} onClick={() => { setQuery(item); go(item); }}>
                  <span>↺</span><strong>{item}</strong>
                </button>
              ))}
            </>
          )}

          {showSuggestions && (
            <>
              <div className="search-popover-title">Подсказки</div>
              {suggestions.map((product) => (
                <Link className="suggestion-item" href={`/product/${product.slug}`} key={product.id} onMouseDown={(event) => event.preventDefault()}>
                  <span className="suggestion-code">{product.sku}</span>
                  <span><strong>{product.title}</strong><small>{product.brand}</small></span>
                </Link>
              ))}
              <button className="search-all" type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => go(query)}>
                Показать все результаты →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
