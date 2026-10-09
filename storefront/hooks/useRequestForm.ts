"use client";

import { type FormEvent, type SyntheticEvent, useCallback, useState } from "react";
import type { RequestItem } from "@/lib/types";
import { readRequestItems } from "@/lib/request-store";
import { subtractAcknowledgedItems } from "@/lib/request-acknowledgement";
import { useLeadSubmission } from "./useLeadSubmission";
import { useFormDraft } from "./useFormDraft";

const requestSuccessMessage = (id: string) => `Заявка принята. Номер: ${id}`;
const quickSuccessMessage = (id: string) => `Заявка принята: ${id}`;

// Omitting items selects the quick contact form. Supplying items selects the RFQ
// form, whose payload property order and success cleanup remain independent.
export function useRequestForm(items?: RequestItem[], persist?: (next: RequestItem[]) => void) {
  const { formRef, saveDraft, captureDraft, clearDraft } = useFormDraft(items ? "request" : "contact");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const invalid = useCallback((event: SyntheticEvent<HTMLFormElement>) => {
    const field = event.target;
    if (!(field instanceof HTMLInputElement)) return;
    const error = field.validity.valueMissing
      ? "Заполните это поле."
      : field.validity.typeMismatch
        ? "Укажите корректный email."
        : field.validity.tooShort
          ? "Введите не менее двух символов."
          : field.validationMessage;
    setFieldErrors((current) => ({ ...current, [field.name]: error }));
  }, []);
  const change = useCallback((event: FormEvent<HTMLFormElement>) => {
    saveDraft(event);
    const field = event.target;
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      setFieldErrors((current) => {
        if (!current[field.name]) return current;
        const next = { ...current };
        delete next[field.name];
        return next;
      });
    }
  }, [saveDraft]);
  const { status, message, submitLead } = useLeadSubmission(items ? requestSuccessMessage : quickSuccessMessage);

  const submit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const submittedDraft = captureDraft();
    const submittedItems = items?.map((item) => ({ ...item }));

    await submitLead(() => submittedItems ? {
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      company: String(form.get("company") ?? ""),
      message: String(form.get("message") ?? ""),
      request_items: submittedItems.map(({ article, quantity }) => ({ article, quantity })),
      page_url: window.location.href,
    } : {
      company: String(form.get("company") ?? ""),
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      message: String(form.get("message") ?? ""),
      request_items: [],
      page_url: window.location.href,
    }, () => {
      if (submittedItems) persist?.(subtractAcknowledgedItems(readRequestItems(), submittedItems));
      formElement.reset();
      clearDraft(submittedDraft);
      setFieldErrors({});
    });
  }, [items, persist, submitLead, captureDraft, clearDraft]);

  return { status, message, submit, formRef, change, invalid, fieldErrors };
}
