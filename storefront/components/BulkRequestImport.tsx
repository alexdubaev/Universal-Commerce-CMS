"use client";

import { useEffect, useRef } from "react";
import type { ImportProblemReason } from "@/lib/request-import";
import { useBulkRequestImport } from "@/hooks/useBulkRequestImport";

const problemLabels: Record<ImportProblemReason, string> = {
  quantity_defaulted: "Некорректное количество: использовано 1 шт.",
  quantity_clamped: "Количество ограничено до 100 000 шт.",
  extra_columns: "Колонки после количества не использованы.",
  missing_article: "Артикул отсутствует: строка не добавлена.",
};

export function BulkRequestImport({ initialArticle = "" }: { initialArticle?: string }) {
  const { manual, setManual, message, problems, hydrated, addManual, upload } = useBulkRequestImport();

  const importFailed = message.startsWith("Не удалось") || message.startsWith("Файл слишком");
  const prefilled = useRef(false);
  useEffect(() => {
    if (!initialArticle || prefilled.current) return;
    prefilled.current = true;
    setManual((current) => current || initialArticle);
  }, [initialArticle, setManual]);

  return (
    <section className="bulk-import panel">
      <div>
        <h2>Загрузить список артикулов</h2>
        <p>Первая колонка — артикул, вторая — количество. Можно вставить список вручную или выбрать XLSX/CSV/TXT.</p>
      </div>
      <div className="bulk-grid">
        <div className="bulk-paste">
          <label htmlFor="bulk-parts">Артикул и количество, по одной позиции в строке</label>
          <textarea
            disabled={!hydrated}
            id="bulk-parts"
            aria-describedby="bulk-example"
            rows={7}
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder={"RE568158 2\n1R-1808 4\n320/04542 1"}
          />
          <p className="bulk-example" id="bulk-example">Например: <code>RE568158 2</code> — артикул и 2 шт.</p>
          <button className="button secondary" type="button" onClick={addManual} disabled={!hydrated}>Добавить список</button>
        </div>
        <div className="bulk-file">
          <strong>XLSX / CSV / TXT</strong>
          <p>До 5 МБ. В одну заявку можно добавить до 100 позиций.</p>
          <label className="button primary file-button">
            Выбрать файл
            <input type="file" accept=".xlsx,.csv,.txt,text/csv,text/plain" onChange={upload} disabled={!hydrated} />
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
      {message && <p className={importFailed ? "import-message error" : "import-message"} role={importFailed ? "alert" : "status"}>{message}</p>}
      {problems.length > 0 && <div className="import-problems" aria-labelledby="import-problems-title">
        <h3 id="import-problems-title">Проверьте строки: {problems.length}</h3>
        <p>Количество можно изменить в заявке. Пропущенные позиции исправьте в исходном списке и добавьте повторно.</p>
        <ul>
          {problems.slice(0, 20).map((problem) => <li key={problem.row}>
            <strong>Строка {problem.row}{problem.article ? ` · ${problem.article}` : ""}</strong>
            <span>{problem.reasons.map((reason) => problemLabels[reason]).join(" ")}</span>
          </li>)}
        </ul>
        {problems.length > 20 && <p>Показаны первые 20 строк из {problems.length}. Проверьте остальные строки в исходном файле.</p>}
      </div>}
    </section>
  );
}
