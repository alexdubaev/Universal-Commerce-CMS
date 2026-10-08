"use client";

import { useBulkRequestImport } from "@/hooks/useBulkRequestImport";

export function BulkRequestImport() {
  const { manual, setManual, message, hydrated, addManual, upload } = useBulkRequestImport();

  return (
    <section className="bulk-import panel">
      <div>
        <h2>Загрузить список артикулов</h2>
        <p>Первая колонка — артикул, вторая — количество. Можно вставить список вручную или выбрать XLSX/CSV/TXT.</p>
      </div>
      <div className="bulk-grid">
        <div className="bulk-paste">
          <label htmlFor="bulk-parts">Артикулы</label>
          <textarea
            disabled={!hydrated}
            id="bulk-parts"
            rows={7}
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder={"RE568158 2\n1R-1808 4\n320/04542 1"}
          />
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
      {message && <p className="import-message" role="status">{message}</p>}
    </section>
  );
}
