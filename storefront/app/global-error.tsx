"use client";

import "./theme.css";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body>
        <main className="shell page-shell" style={{ padding: "48px 20px", fontFamily: "system-ui, sans-serif" }}>
          <section style={{ maxWidth: 720, margin: "0 auto", padding: 28, border: "1px solid var(--global-error-border)", borderRadius: 16 }}>
            <p style={{ opacity: .7 }}>Ошибка загрузки</p>
            <h1>Сайт временно недоступен</h1>
            <p>Не удалось получить обязательные данные магазина. Вымышленный каталог не подставляется вместо реальных данных.</p>
            <button type="button" onClick={reset} style={{ minHeight: 44, padding: "0 18px", cursor: "pointer" }}>
              Повторить
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
