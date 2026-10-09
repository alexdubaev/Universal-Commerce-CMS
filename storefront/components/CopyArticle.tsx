"use client";

import { useState } from "react";

export function CopyArticle({ article }: { article: string }) {
  const [feedback, setFeedback] = useState<"idle" | "copying" | "copied" | "error">("idle");

  async function copy() {
    setFeedback("copying");
    try {
      await navigator.clipboard.writeText(article);
      setFeedback("copied");
    } catch {
      setFeedback("error");
    }
  }

  return (
    <span className="copy-article">
      <button className="copy-article-button" type="button" onClick={copy} disabled={feedback === "copying"} aria-label={`Скопировать артикул ${article}`} title="Скопировать артикул">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          {feedback === "copied" ? <path d="m5 12 4 4L19 6" /> : <><rect x="8" y="8" width="12" height="12" rx="1" /><path d="M16 8V4H4v12h4" /></>}
        </svg>
      </button>
      <span className={`copy-article-feedback${feedback === "error" ? " copy-article-error" : ""}`} role="status">
        {feedback === "copied" ? "Артикул скопирован" : feedback === "error" ? "Не удалось скопировать. Выделите артикул и скопируйте вручную." : ""}
      </span>
    </span>
  );
}
