"use client";

import { useCallback, useRef, useState } from "react";
import { ensureIdempotencyKey, type IdempotencyState } from "@/lib/idempotency";

type LeadPayload = {
  name: string;
  phone: string;
  email: string;
  company: string;
  message: string;
  request_items: Array<{ article: string; quantity: number }>;
  page_url: string;
};

export function useLeadSubmission(successMessage: (id: string) => string) {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const idempotency = useRef<IdempotencyState | null>(null);

  const submitLead = useCallback(async (buildPayload: () => LeadPayload, onSuccess: () => void) => {
    setStatus("sending");
    setMessage("");
    const payloadBody = buildPayload();
    const fingerprint = JSON.stringify(payloadBody);
    idempotency.current = ensureIdempotencyKey(
      idempotency.current,
      fingerprint,
      () => crypto.randomUUID(),
    );

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_key: idempotency.current.key,
          ...payloadBody,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Не удалось отправить заявку");
      setStatus("success");
      setMessage(successMessage(payload.id));
      idempotency.current = null;
      onSuccess();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Ошибка отправки");
    }
  }, [successMessage]);

  return { status, message, submitLead };
}
