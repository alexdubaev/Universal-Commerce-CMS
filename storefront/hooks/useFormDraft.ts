"use client";

import { type FormEvent, useCallback, useEffect, useRef } from "react";

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const draftFields = ["company", "name", "phone", "email", "message"] as const;
type FormDraft = Partial<Record<typeof draftFields[number], string>>;
type SubmittedDraft = { key: string; serialized: string | null };

export function readFormDraft(storage: DraftStorage, key: string): FormDraft {
  try {
    const saved: unknown = JSON.parse(storage.getItem(key) ?? "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    const draft: FormDraft = {};
    for (const field of draftFields) {
      const value = (saved as Record<string, unknown>)[field];
      if (typeof value === "string") draft[field] = value;
    }
    return draft;
  } catch { return {}; }
}

export function writeFormDraft(storage: DraftStorage, key: string, draft: FormDraft): void {
  try { storage.setItem(key, JSON.stringify({ ...draft, revision: crypto.randomUUID() })); } catch { /* Forms work without browser storage. */ }
}

export function clearFormDraft(storage: DraftStorage, key: string, submittedVersion: string | null): void {
  try {
    if (storage.getItem(key) === submittedVersion) storage.removeItem(key);
  } catch { /* Storage may be unavailable in this browser. */ }
}

export function useFormDraft(kind: "request" | "contact") {
  const formRef = useRef<HTMLFormElement>(null);
  const storageKey = useRef<string | null>(null);

  useEffect(() => {
    const key = kind === "request" ? "smtechno-form-draft:request" : `smtechno-form-draft:contact:${window.location.pathname}`;
    storageKey.current = key;
    const form = formRef.current;
    if (!form) return;
    try {
      const draft = readFormDraft(window.sessionStorage, key);
      for (const field of draftFields) {
        const input = form.elements.namedItem(field);
        if ((input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) && !input.value) {
          input.value = draft[field] ?? "";
        }
      }
    } catch { /* Accessing sessionStorage itself can be denied. */ }
  }, [kind]);

  const saveDraft = useCallback((event: FormEvent<HTMLFormElement>) => {
    const key = storageKey.current;
    if (!key) return;
    const values = new FormData(event.currentTarget);
    const draft: FormDraft = {};
    for (const field of draftFields) draft[field] = String(values.get(field) ?? "");
    try { writeFormDraft(window.sessionStorage, key, draft); } catch { /* Keep entered values in the form. */ }
  }, []);

  const captureDraft = useCallback((): SubmittedDraft | null => {
    const key = storageKey.current;
    if (!key) return null;
    try { return { key, serialized: window.sessionStorage.getItem(key) }; }
    catch { return null; }
  }, []);

  const clearDraft = useCallback((submitted: SubmittedDraft | null) => {
    if (!submitted) return;
    try { clearFormDraft(window.sessionStorage, submitted.key, submitted.serialized); }
    catch { /* Success does not depend on browser storage. */ }
  }, []);

  return { formRef, saveDraft, captureDraft, clearDraft };
}
