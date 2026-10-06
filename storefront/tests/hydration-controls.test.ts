import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { SearchBox } from "../components/SearchBox";
import { BulkRequestImport } from "../components/BulkRequestImport";

describe("interactive controls before hydration", () => {
  it("renders search input and submit disabled in its stable initial state", () => {
    const html = renderToStaticMarkup(React.createElement(SearchBox));
    expect(html).toMatch(/<input[^>]*disabled=""/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  });

  it("renders manual and file import controls disabled in its stable initial state", () => {
    const html = renderToStaticMarkup(React.createElement(BulkRequestImport));
    expect(html).toMatch(/<textarea[^>]*disabled=""/);
    expect(html).toMatch(/Добавить список<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Добавить список/);
    expect(html).toMatch(/<input[^>]*type="file"[^>]*disabled=""/);
  });
});
