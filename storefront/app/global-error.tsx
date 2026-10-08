"use client";

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
          <section style={{ borderRadius: 0, maxWidth: 720, margin: "0 auto", padding: 28, border: "1px solid #333" }}>
            <p style={{ opacity: .7 }}>Ошибка загрузки</p>
            <h1>Сайт временно недоступен</h1>
            <p>Не удалось получить обязательные данные магазина. Вымышленный каталог не подставляется вместо реальных данных.</p>
            <button type="button" onClick={reset} style={{ borderRadius: 0, minHeight: 44, padding: "0 18px", cursor: "pointer" }}>
              Повторить
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
