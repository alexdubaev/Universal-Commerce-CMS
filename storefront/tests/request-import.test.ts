import { describe, expect, it } from "vitest";
import { parseDelimitedText, rowsToRequestItems } from "../lib/request-import";
import { mergeRequestItems, normalizeRequestArticle } from "../lib/request-store";

describe("RFQ list import", () => {
  it("parses semicolon CSV with a header and quantity", () => {
    const items = parseDelimitedText("Артикул;Количество\nRE568158;2\n1R-1808;4");
    expect(items).toEqual([
      { article: "RE568158", quantity: 2, title: "Позиция из списка", brand: "Не указан" },
      { article: "1R-1808", quantity: 4, title: "Позиция из списка", brand: "Не указан" },
    ]);
  });

  it("parses whitespace text and defaults invalid quantity to one", () => {
    const items = parseDelimitedText("320/04542 3\nDZ121294");
    expect(items[0]).toMatchObject({ article: "320/04542", quantity: 3 });
    expect(items[1]).toMatchObject({ article: "DZ121294", quantity: 1 });
  });

  it("maps spreadsheet rows and skips common article headers", () => {
    const items = rowsToRequestItems([
      ["SKU", "qty"],
      ["VOE14550092", 5],
      ["4633600", 2],
    ]);
    expect(items.map(({ article, quantity }) => ({ article, quantity }))).toEqual([
      { article: "VOE14550092", quantity: 5 },
      { article: "4633600", quantity: 2 },
    ]);
  });

  it("merges one unambiguous imported article despite punctuation and preserves quantities", () => {
    const merged = mergeRequestItems(
      [{ article: "RE568158", title: "Existing", brand: "John Deere", quantity: 2 }],
      [{ article: "RE-568158", title: "Imported", brand: "Не указан", quantity: 3 }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(5);
    expect(normalizeRequestArticle(merged[0].article)).toBe("RE568158");
  });

  it("does not merge the same article across two explicit brands", () => {
    const merged = mergeRequestItems(
      [{ article: "12345", title: "A", brand: "Caterpillar", quantity: 1 }],
      [{ article: "12-345", title: "B", brand: "Komatsu", quantity: 1 }],
    );
    expect(merged).toHaveLength(2);
  });
});
