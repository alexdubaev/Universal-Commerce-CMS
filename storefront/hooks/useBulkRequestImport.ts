"use client";

import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { parseDelimitedText, rowsToRequestItems } from "@/lib/request-import";
import { mergeRequestItems, readRequestItems, writeRequestItems } from "@/lib/request-store";
import type { ImportRow } from "@/lib/request-import";

export function useBulkRequestImport() {
  const [manual, setManual] = useState("");
  const [message, setMessage] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  const append = useCallback((items: ReturnType<typeof parseDelimitedText>, source: string) => {
    const current = readRequestItems();
    let truncated = false;
    const merged = mergeRequestItems(current, items, () => { truncated = true; });
    writeRequestItems(merged);
    const added = Math.max(0, merged.length - current.length);
    setMessage(`${source}: добавлено ${added}, всего ${merged.length}.${truncated ? " Достигнут лимит 100 позиций." : ""}`);
  }, []);

  const addManual = useCallback(() => {
    if (!hydrated) return;
    const parsed = parseDelimitedText(manual);
    if (!parsed.length) {
      setMessage("Не удалось найти артикулы. Используйте: артикул + количество, по одной позиции в строке.");
      return;
    }
    append(parsed, "Список");
    setManual("");
  }, [append, hydrated, manual]);

  const upload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    if (!hydrated) return;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Файл слишком большой. Для интерфейсной загрузки используйте файл до 5 МБ.");
      return;
    }

    try {
      if (file.name.toLowerCase().endsWith(".xlsx")) {
        const { readSheet } = await import("read-excel-file/browser");
        const rows = await readSheet(file) as ImportRow[];
        append(rowsToRequestItems(rows), "XLSX");
      } else {
        append(parseDelimitedText(await file.text()), "CSV/TXT");
      }
    } catch {
      setMessage("Не удалось прочитать файл. Поддерживаются XLSX, CSV и TXT.");
    }
  }, [append, hydrated]);

  return { manual, setManual, message, hydrated, addManual, upload };
}
