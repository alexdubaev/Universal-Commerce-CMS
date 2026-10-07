"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
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

export function useCatalogSearch(initial = "") {
  const router = useRouter();
  const [query, setQuery] = useState(initial);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    setHistory(readHistory());
    setHydrated(true);
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

  const go = useCallback((value: string) => {
    if (!hydrated) return;
    const clean = value.trim();
    if (!clean) {
      router.push("/catalog");
      return;
    }
    saveHistory(clean);
    setHistory(readHistory());
    setOpen(false);
    router.push(`/catalog?q=${encodeURIComponent(clean)}`);
  }, [hydrated, router]);

  const submit = useCallback((event: FormEvent) => {
    event.preventDefault();
    if (!hydrated) return;
    go(query);
  }, [go, hydrated, query]);

  const changeQuery = useCallback((value: string) => {
    setQuery(value);
    setOpen(true);
  }, []);

  const focus = useCallback(() => {
    setOpen(true);
    setHistory(readHistory());
  }, []);

  const blur = useCallback(() => {
    window.setTimeout(() => setOpen(false), 160);
  }, []);

  const chooseHistory = useCallback((value: string) => {
    setQuery(value);
    go(value);
  }, [go]);

  return {
    query, suggestions, history, hydrated,
    showHistory: open && !query.trim() && history.length > 0,
    showSuggestions: open && query.trim().length >= 2 && suggestions.length > 0,
    changeQuery, focus, blur, chooseHistory, go, submit,
  };
}
