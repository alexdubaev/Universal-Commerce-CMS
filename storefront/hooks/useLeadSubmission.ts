"use client";

import { useCallback, useRef, useState } from "react";
import { clearPendingSubmission, ensurePendingSubmission, requireLeadAcknowledgement, validateLeadSubmission } from "@/lib/idempotency";

type LeadPayload = {
  name: string;
  phone: string;
  email: string;
  company: string;
  message: string;
  request_items: Array<{ article: string; quantity: number }>;
  page_url: string;
};

export function useLeadSubmission(successMessage: (id: string) => string, scope: "request" | "contact") {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const sending = useRef(false);

  const submitLead = useCallback(async (buildPayload: () => LeadPayload, onSuccess: () => void) => {
    if (sending.current) return;
    sending.current = true;
    setStatus("sending");
    setMessage("");

    try {
      const payloadBody = buildPayload();
      const validationError = validateLeadSubmission(scope, payloadBody.request_items);
      if (validationError) throw new Error(validationError);
      let session: Storage | null = null;
      try { session = window.sessionStorage; } catch { /* The in-memory fallback still protects retries on this page. */ }
      const pending = await ensurePendingSubmission(session, scope, payloadBody, () => crypto.randomUUID());
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_key: pending.key,
          ...payloadBody,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const errorMessage = payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
          ? (payload as { error: string }).error
          : "Не удалось отправить заявку";
        throw new Error(errorMessage);
      }
      const id = requireLeadAcknowledgement(payload);
      setStatus("success");
      setMessage(`${successMessage(id)} Следующий шаг: менеджер уточнит наличие и стоимость.`);
      clearPendingSubmission(session, scope, pending.fingerprint);
      onSuccess();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Ошибка отправки");
    } finally {
      sending.current = false;
    }
  }, [scope, successMessage]);

  return { status, message, submitLead };
}
