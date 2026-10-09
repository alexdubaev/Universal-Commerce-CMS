"use client";

import Link from "next/link";
import { useCatalogSearch } from "@/hooks/useCatalogSearch";

export function SearchBox({
  compact = false,
  initial = "",
  placeholder = "Введите артикул или OEM-номер",
  buttonLabel = "Найти",
  inputId,
}: {
  compact?: boolean;
  initial?: string;
  placeholder?: string;
  buttonLabel?: string;
  inputId?: string;
}) {
  const {
    query, suggestions, history, hydrated, showHistory, showSuggestions,
    changeQuery, focus, blur, chooseHistory, go, submit,
  } = useCatalogSearch(initial);

  return (
    <div className={compact ? "search-wrap compact" : "search-wrap"}>
      <form className={compact ? "search-box compact" : "search-box"} onSubmit={submit} role="search">
        <span className="search-icon" aria-hidden="true">⌕</span>
        <input
          id={inputId}
          disabled={!hydrated}
          value={query}
          onChange={(event) => changeQuery(event.target.value)}
          onFocus={focus}
          onBlur={blur}
          placeholder={placeholder}
          aria-label="Поиск запчастей"
          aria-expanded={showHistory || showSuggestions}
          autoComplete="off"
        />
        <button type="submit" disabled={!hydrated}>{buttonLabel}</button>
      </form>

      {(showHistory || showSuggestions) && (
        <div className="search-popover">
          {showHistory && (
            <>
              <div className="search-popover-title">Недавние запросы</div>
              {history.map((item) => (
                <button type="button" className="history-item" key={item} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseHistory(item)}>
                  <span>↺</span><strong>{item}</strong>
                </button>
              ))}
            </>
          )}

          {showSuggestions && (
            <>
              <div className="search-popover-title">Подсказки</div>
              {suggestions.map((product) => (
                <Link className="suggestion-item" href={`/product/${product.slug}`} key={product.id} onMouseDown={(event) => event.preventDefault()}>
                  <span className="suggestion-code">{product.sku}</span>
                  <span><strong>{product.title}</strong><small>{product.brand}</small></span>
                </Link>
              ))}
              <button className="search-all" type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => go(query)}>
                Показать все результаты →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
