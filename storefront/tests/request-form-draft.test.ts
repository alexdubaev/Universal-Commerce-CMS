import { describe, expect, it } from "vitest";
import { clearFormDraft, readFormDraft, writeFormDraft } from "../hooks/useFormDraft";

function tabStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe("contact form draft persistence", () => {
  it("restores contact fields independently for tabs and forms, clearing only the submitted form", () => {
    const firstTab = tabStorage();
    const secondTab = tabStorage();
    const draft = { name: "Анна", phone: "+7 900 1234567", email: "a@example.com", company: "Компания", message: "Нужен аналог" };
    writeFormDraft(firstTab, "request", draft);
    writeFormDraft(firstTab, "contact", { name: "Другой контакт" });
    writeFormDraft(secondTab, "request", { name: "Вторая вкладка" });
    expect(readFormDraft(firstTab, "request")).toEqual(draft);
    clearFormDraft(firstTab, "request", firstTab.getItem("request"));
    expect(readFormDraft(firstTab, "request")).toEqual({});
    expect(readFormDraft(firstTab, "contact")).toEqual({ name: "Другой контакт" });
    expect(readFormDraft(secondTab, "request")).toEqual({ name: "Вторая вкладка" });
  });

  it("preserves a newer edit after a late acknowledgement even when its values match the submitted draft", () => {
    const storage = tabStorage();
    const submitted = { name: "Анна", message: "Отправленный комментарий" };
    writeFormDraft(storage, "request", submitted);
    const submittedVersion = storage.getItem("request");
    writeFormDraft(storage, "request", { name: "Анна", message: "Новый комментарий" });
    writeFormDraft(storage, "request", submitted);
    clearFormDraft(storage, "request", submittedVersion);
    expect(readFormDraft(storage, "request")).toEqual(submitted);
    clearFormDraft(storage, "request", storage.getItem("request"));
    expect(readFormDraft(storage, "request")).toEqual({});
  });

  it("ignores malformed storage and unsupported fields", () => {
    const storage = tabStorage();
    storage.setItem("broken", "{no json");
    storage.setItem("unexpected", JSON.stringify({ name: "Имя", phone: 123, request_items: [{ article: "SKU" }] }));
    expect(readFormDraft(storage, "broken")).toEqual({});
    expect(readFormDraft(storage, "unexpected")).toEqual({ name: "Имя" });
  });

  it("allows the form to work when browser storage is denied", () => {
    const denied = () => { throw new Error("Access denied"); };
    const storage = { getItem: denied, setItem: denied, removeItem: denied };
    expect(readFormDraft(storage, "request")).toEqual({});
    expect(() => writeFormDraft(storage, "request", { name: "Имя" })).not.toThrow();
    expect(() => clearFormDraft(storage, "request", null)).not.toThrow();
  });
});
