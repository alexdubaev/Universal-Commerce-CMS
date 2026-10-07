import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GlobalError from "../app/global-error";

const storefront = fileURLToPath(new URL("..", import.meta.url));
const themePath = join(storefront, "app/theme.css");
const theme = readFileSync(themePath, "utf8");

function presentationFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? presentationFiles(path) : /\.(css|tsx)$/.test(path) ? [path] : [];
  });
}

const files = ["app", "components"].flatMap((directory) => presentationFiles(join(storefront, directory)));

describe("storefront theme boundary", () => {
  it("keeps concrete presentation colors in the canonical theme", () => {
    const scatteredColors = files.filter((path) => path !== themePath).flatMap((path) => {
      const source = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      // Transparent stops and black mask coverage are structural, not theme colors.
      const colors = source.match(/#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(\s*(?!var\()[\d.]/gi) ?? [];
      return colors.map((color) => `${relative(storefront, path)}: ${color}`);
    });
    expect(scatteredColors).toEqual([]);
  });

  it("defines every presentation custom property in the theme", () => {
    const declared = new Set(Array.from(theme.matchAll(/(--[\w-]+)\s*:/g), (match) => match[1]));
    const missing = files.flatMap((path) => Array.from(readFileSync(path, "utf8").matchAll(/var\((--[\w-]+)/g), (match) => match[1]))
      .filter((token) => !declared.has(token));
    expect([...new Set(missing)]).toEqual([]);
  });

  it("loads tokens for the standalone error without styling its default canvas", () => {
    const source = readFileSync(join(storefront, "app/global-error.tsx"), "utf8");
    expect(source).toMatch(/import\s+["']\.\/theme\.css["']/);
    expect(source).not.toMatch(/import\s+["']\.\/globals\.css["']/);
    const html = renderToStaticMarkup(React.createElement(GlobalError, { error: new Error("Unavailable"), reset: () => {} }));
    expect(html).toContain("<body>");
    expect(html).toContain("border:1px solid var(--global-error-border)");
    // The standalone import must only declare variables; browser canvas/text defaults remain intact.
    expect(theme.replace(/\/\*[\s\S]*?\*\//g, "").trim()).toMatch(/^:root\s*\{[^{}]*\}$/);
  });
});
