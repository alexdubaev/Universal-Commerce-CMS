"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Storefront render error:", error);
  }, [error]);

  return (
    <div className="shell page-shell">
      <div className="panel empty-state not-found">

        <h1>Не удалось загрузить страницу</h1>
        <p>Данные не были подменены вымышленным каталогом. Попробуйте повторить запрос.</p>
        <button className="button primary" type="button" onClick={reset}>Повторить</button>
      </div>
    </div>
  );
}
