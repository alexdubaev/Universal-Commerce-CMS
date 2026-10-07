import React, { type FormEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RequestItem } from "../lib/types";
import { readRequestItems, REQUEST_STORAGE_KEY, writeRequestItems } from "../lib/request-store";
import { subtractAcknowledgedItems } from "../lib/request-acknowledgement";

const pending = vi.hoisted(() => ({ acknowledge: () => {}, payload: {} as Record<string, unknown> }));
vi.mock("../hooks/useLeadSubmission", () => ({
  useLeadSubmission: () => ({
    status: "idle", message: "",
    submitLead: async (build: () => Record<string, unknown>, acknowledge: () => void) => {
      pending.payload = build();
      pending.acknowledge = acknowledge;
    },
  }),
}));
import { useRequestForm } from "../hooks/useRequestForm";

function item(article: string, quantity = 1, brand = "Brand"): RequestItem {
  return { article, quantity, brand, title: article };
}

function startSubmission(submitted: RequestItem[] | undefined, stored = submitted ?? []) {
  const storage = new Map([[REQUEST_STORAGE_KEY, JSON.stringify(stored)]]);
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) });
  vi.stubGlobal("window", { location: { href: "https://test.example/request" }, dispatchEvent: vi.fn() });
  vi.stubGlobal("FormData", class { get(key: string) { return ({ name: "Test", phone: "+79999999999" } as Record<string, string>)[key] ?? ""; } });
  let form: ReturnType<typeof useRequestForm>;
  function Probe() {
    form = useRequestForm(submitted, writeRequestItems);
    return null;
  }
  renderToStaticMarkup(React.createElement(Probe));
  const reset = vi.fn();
  void form!.submit({ preventDefault() {}, currentTarget: { reset } } as unknown as FormEvent<HTMLFormElement>);
  return { reset };
}

afterEach(() => vi.unstubAllGlobals());

describe("RFQ success acknowledges only submitted quantities", () => {
  it("retains a row added from another tab while submission is pending", () => {
    const { reset } = startSubmission([item("A")]);
    writeRequestItems([item("A"), item("B")]);
    pending.acknowledge();
    expect(readRequestItems()).toEqual([item("B")]);
    expect(pending.payload.request_items).toEqual([{ article: "A", quantity: 1 }]);
    expect(reset).toHaveBeenCalledOnce();
  });

  it("retains quantity increments and matches normalized article and brand", () => {
    startSubmission([item("SKU-1", 2, " BRAND ")]);
    writeRequestItems([item("sku1", 5, "brand"), item("SKU1", 4, "Other")]);
    pending.acknowledge();
    expect(readRequestItems()).toEqual([item("sku1", 3, "brand"), item("SKU1", 4, "Other")]);
  });

  it("respects removals and quantity reductions made while pending", () => {
    startSubmission([item("A", 5), item("B", 2)]);
    writeRequestItems([item("A", 3), item("C", 2)]);
    pending.acknowledge();
    expect(readRequestItems()).toEqual([item("C", 2)]);
  });

  it("clears an unchanged acknowledged request", () => {
    startSubmission([item("A", 2), item("B")]);
    pending.acknowledge();
    expect(readRequestItems()).toEqual([]);
  });

  it("leaves RFQ storage untouched after a quick contact acknowledgement", () => {
    startSubmission(undefined, [item("A", 2)]);
    pending.acknowledge();
    expect(readRequestItems()).toEqual([item("A", 2)]);
    expect(pending.payload.request_items).toEqual([]);
  });

  it("subtracts the submitted total only once across duplicate stored identities", () => {
    const submitted = [item("A", 2), item("A", 1)];
    const current = [item("A", 2), item("a", 3), item("B")];
    expect(subtractAcknowledgedItems(current, submitted)).toEqual([item("a", 2), item("B")]);
    expect(current.map(({ quantity }) => quantity)).toEqual([2, 3, 1]);
    expect(submitted.map(({ quantity }) => quantity)).toEqual([2, 1]);
  });
});
