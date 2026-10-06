"use client";

import { ChangeEvent, useState } from "react";
import { parseDelimitedText, rowsToRequestItems } from "@/lib/request-import";
import { MAX_REQUEST_ITEMS, mergeRequestItems, readRequestItems, writeRequestItems } from "@/lib/request-store";
import type { ImportRow } from "@/lib/request-import";


export function BulkRequestImport() {
  const [manual, setManual] = useState("");
  const [message, setMessage] = useState("");

  function append(items: ReturnType<typeof parseDelimitedText>, source: string) {
    const current = readRequestItems();
    const merged = mergeRequestItems(current, items);
    const limited = merged.slice(0, MAX_REQUEST_ITEMS);
    writeRequestItems(limited);
    const added = Math.max(0, limited.length - current.length);
    const truncated = merged.length > MAX_REQUEST_ITEMS;
    setMessage(`${source}: добавлено ${added}, всего ${limited.length}.${truncated ? " Лимит текущего API — 100 позиций." : ""}`);
  }

  function addManual() {
    const parsed = parseDelimitedText(manual);
    if (!parsed.length) {
      setMessage("Не удалось найти артикулы. Используйте: артикул + количество, по одной позиции в строке.");
      return;
    }
    append(parsed, "Список");
    setManual("");
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
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
  }

  return (
    <section className="bulk-import panel">
      <div>
        <span className="eyebrow">Быстрый запрос</span>
        <h2>Загрузить список артикулов</h2>
        <p>Первая колонка — артикул, вторая — количество. Можно вставить список вручную или выбрать XLSX/CSV/TXT.</p>
      </div>
      <div className="bulk-grid">
        <div className="bulk-paste">
          <label htmlFor="bulk-parts">Артикулы</label>
          <textarea
            id="bulk-parts"
            rows={7}
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder={"RE568158 2\n1R-1808 4\n320/04542 1"}
          />
          <button className="button secondary" type="button" onClick={addManual}>Добавить список</button>
        </div>
        <div className="bulk-file">
          <strong>XLSX / CSV / TXT</strong>
          <p>До 5 МБ. В текущую заявку можно передать до 100 позиций — это ограничение существующего commerce API.</p>
          <label className="button primary file-button">
            Выбрать файл
            <input type="file" accept=".xlsx,.csv,.txt,text/csv,text/plain" onChange={upload} />
          </label>
          <a
            className="template-link"
            href={"data:text/csv;charset=utf-8,%D0%90%D1%80%D1%82%D0%B8%D0%BA%D1%83%D0%BB%3B%D0%9A%D0%BE%D0%BB%D0%B8%D1%87%D0%B5%D1%81%D1%82%D0%B2%D0%BE%0ARE568158%3B2%0A1R-1808%3B4"}
            download="parts-request-template.csv"
          >
            Скачать CSV-шаблон
          </a>
        </div>
      </div>
      {message && <p className="import-message" role="status">{message}</p>}
    </section>
  );
}
