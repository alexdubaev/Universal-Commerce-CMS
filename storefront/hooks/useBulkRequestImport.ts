"use client";

import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { inspectDelimitedText, inspectImportRows } from "@/lib/request-import";
import { mergeRequestItems, readRequestItems, writeRequestItems } from "@/lib/request-store";
import type { ImportProblem, ImportResult, ImportRow } from "@/lib/request-import";

export function useBulkRequestImport() {
  const [manual, setManual] = useState("");
  const [message, setMessage] = useState("");
  const [problems, setProblems] = useState<ImportProblem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  const append = useCallback(({ items, problems: nextProblems }: ImportResult, source: string) => {
    setProblems(nextProblems);
    const current = readRequestItems();
    let truncated = false;
    const merged = mergeRequestItems(current, items, () => { truncated = true; });
    writeRequestItems(merged);
    const added = Math.max(0, merged.length - current.length);
    const updated = current.filter((item, index) => merged[index]?.quantity !== item.quantity).length;
    setMessage(`${source}: позиций в списке ${items.length}, добавлено ${added}, обновлено ${updated}, всего ${merged.length}.${truncated ? " Достигнут лимит 100 позиций." : ""}${nextProblems.length ? ` Проверьте строки: ${nextProblems.length}.` : ""}`);
  }, []);

  const addManual = useCallback(() => {
    if (!hydrated) return;
    const parsed = inspectDelimitedText(manual);
    setProblems(parsed.problems);
    if (!parsed.items.length) {
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
    setProblems([]);
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Файл слишком большой. Для интерфейсной загрузки используйте файл до 5 МБ.");
      return;
    }

    try {
      if (file.name.toLowerCase().endsWith(".xlsx")) {
        const { readSheet } = await import("read-excel-file/browser");
        const rows = await readSheet(file) as ImportRow[];
        append(inspectImportRows(rows), "XLSX");
      } else {
        append(inspectDelimitedText(await file.text()), "CSV/TXT");
      }
    } catch {
      setMessage("Не удалось прочитать файл. Поддерживаются XLSX, CSV и TXT.");
    }
  }, [append, hydrated]);

  return { manual, setManual, message, problems, hydrated, addManual, upload };
}
