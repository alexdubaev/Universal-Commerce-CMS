"use client";

import Link from "next/link";
import { useId, useState, type KeyboardEvent } from "react";
import { useCatalogSearch } from "@/hooks/useCatalogSearch";
import { SEARCH_QUERY_MAX_LENGTH, SEARCH_QUERY_MIN_LENGTH } from "@/lib/search-query";

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
    changeQuery, focus, blur, close, chooseHistory, go, submit,
  } = useCatalogSearch(initial);
  const id = useId();
  const listboxId = `${id}-listbox`;
  const [active, setActive] = useState(-1);
  const optionCount = (showHistory ? history.length : 0) + (showSuggestions ? suggestions.length : 0);
  const move = (direction: number) => setActive(current => optionCount
    ? current < 0 ? (direction > 0 ? 0 : optionCount - 1) : (current + direction + optionCount) % optionCount
    : -1);
  const activeOption = (showHistory || showSuggestions) && active >= 0 && active < optionCount;
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); move(1); }
    if (event.key === "ArrowUp") { event.preventDefault(); move(-1); }
    if (event.key === "Escape") { setActive(-1); close(); }
    if (event.key === "Enter" && activeOption) {
      event.preventDefault();
      if (showHistory && active < history.length) chooseHistory(history[active]);
      else if (showSuggestions) document.getElementById(`${id}-option-${active}`)?.click();
    }
  };

  return (
    <div className={compact ? "search-wrap compact" : "search-wrap"}>
      <form className={compact ? "search-box compact" : "search-box"} onSubmit={submit} role="search">
        <span className="search-icon" aria-hidden="true">⌕</span>
        <input
          id={inputId}
          disabled={!hydrated}
          value={query}
          onChange={(event) => { setActive(-1); changeQuery(event.target.value); }}
          onFocus={focus}
          onBlur={() => { setActive(-1); blur(); }}
          placeholder={placeholder}
          aria-label="Поиск запчастей"
          minLength={SEARCH_QUERY_MIN_LENGTH}
          maxLength={SEARCH_QUERY_MAX_LENGTH}
          aria-expanded={showHistory || showSuggestions}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeOption ? `${id}-option-${active}` : undefined}
          role="combobox"
          onKeyDown={keyDown}
          autoComplete="off"
        />
        <button type="submit" disabled={!hydrated}>{buttonLabel}</button>
      </form>

      {(showHistory || showSuggestions) && (
        <div className="search-popover">
          {showHistory && (
            <>
              <div className="search-popover-title">Недавние запросы</div>
              <div id={listboxId} role="listbox" aria-label="Недавние запросы">
                {history.map((item, index) => (
                  <button type="button" role="option" aria-selected={active === index} id={`${id}-option-${index}`} className="history-item" key={item} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseHistory(item)}>
                    <span>↺</span><strong>{item}</strong>
                  </button>
                ))}
              </div>
            </>
          )}

          {showSuggestions && (
            <>
              <div className="search-popover-title">Подсказки</div>
              <div id={listboxId} role="listbox" aria-label="Поисковые подсказки">
                {suggestions.map((product, index) => (
                  <Link role="option" aria-selected={active === (showHistory ? history.length : 0) + index} id={`${id}-option-${(showHistory ? history.length : 0) + index}`} className="suggestion-item" href={`/product/${product.slug}`} key={product.id} onMouseDown={(event) => event.preventDefault()}>
                    <span className="suggestion-code">{product.sku}</span>
                    <span><strong>{product.title}</strong><small>{product.brand}</small></span>
                  </Link>
                ))}
              </div>
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
