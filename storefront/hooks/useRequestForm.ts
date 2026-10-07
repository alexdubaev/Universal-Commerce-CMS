"use client";

import { type FormEvent, useCallback } from "react";
import type { RequestItem } from "@/lib/types";
import { readRequestItems } from "@/lib/request-store";
import { subtractAcknowledgedItems } from "@/lib/request-acknowledgement";
import { useLeadSubmission } from "./useLeadSubmission";

const requestSuccessMessage = (id: string) => `Заявка принята. Номер: ${id}`;
const quickSuccessMessage = (id: string) => `Заявка принята: ${id}`;

// Omitting items selects the quick contact form. Supplying items selects the RFQ
// form, whose payload property order and success cleanup remain independent.
export function useRequestForm(items?: RequestItem[], persist?: (next: RequestItem[]) => void) {
  const { status, message, submitLead } = useLeadSubmission(items ? requestSuccessMessage : quickSuccessMessage);

  const submit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
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
    });
  }, [items, persist, submitLead]);

  return { status, message, submit };
}
