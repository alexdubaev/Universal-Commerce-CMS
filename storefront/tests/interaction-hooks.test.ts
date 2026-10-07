import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readRequestCount, useRequestItems } from "../hooks/useRequestItems";
import { useCatalogSearch } from "../hooks/useCatalogSearch";
import { useBulkRequestImport } from "../hooks/useBulkRequestImport";
import { useRequestForm } from "../hooks/useRequestForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

describe("request badge storage compatibility", () => {
  function count(raw: string | null) {
    vi.stubGlobal("localStorage", { getItem: () => raw });
    return readRequestCount();
  }

  it("counts raw entries without requiring an article or normalizing quantities", () => {
    expect(count(JSON.stringify([{}, { quantity: 0 }, { quantity: -2 }, { quantity: "4" }]))).toBe(3);
  });

  it("preserves the quantity default and numeric coercion", () => {
    expect(count(JSON.stringify([{ quantity: null }, { quantity: 2.5 }]))).toBe(3.5);
    expect(count(JSON.stringify([{ quantity: "invalid" }]))).toBeNaN();
  });

  it("falls back to zero for malformed storage or unavailable storage", () => {
    expect(count("{")).toBe(0);
    expect(count("{}")).toBe(0);
    expect(count("[null]")).toBe(0);
    expect(count(null)).toBe(0);
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); } });
    expect(readRequestCount()).toBe(0);
  });
});

describe("interaction hooks before hydration", () => {
  it("preserves the initial search query and keeps browser-only actions gated", () => {
    function Probe() {
      const search = useCatalogSearch("RE-568158");
      search.go("unused before hydration");
      return React.createElement("output", null, JSON.stringify({
        query: search.query,
        hydrated: search.hydrated,
        suggestions: search.suggestions,
        history: search.history,
        showHistory: search.showHistory,
        showSuggestions: search.showSuggestions,
      }));
    }
    expect(renderToStaticMarkup(React.createElement(Probe))).toBe(
      '<output>{&quot;query&quot;:&quot;RE-568158&quot;,&quot;hydrated&quot;:false,&quot;suggestions&quot;:[],&quot;history&quot;:[],&quot;showHistory&quot;:false,&quot;showSuggestions&quot;:false}</output>',
    );
  });

  it("starts imports and the request form without browser storage access", () => {
    function Probe() {
      const request = useRequestItems();
      const form = useRequestForm(request.items, request.persist);
      const bulk = useBulkRequestImport();
      bulk.addManual();
      return React.createElement("output", null, JSON.stringify({
        items: request.items,
        status: form.status,
        message: form.message,
        manual: bulk.manual,
        hydrated: bulk.hydrated,
        importMessage: bulk.message,
      }));
    }
    expect(renderToStaticMarkup(React.createElement(Probe))).toBe(
      '<output>{&quot;items&quot;:[],&quot;status&quot;:&quot;idle&quot;,&quot;message&quot;:&quot;&quot;,&quot;manual&quot;:&quot;&quot;,&quot;hydrated&quot;:false,&quot;importMessage&quot;:&quot;&quot;}</output>',
    );
  });
});
