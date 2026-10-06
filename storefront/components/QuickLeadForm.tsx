"use client";

import { FormEvent, useRef, useState } from "react";

export function QuickLeadForm({ title = "Связаться с менеджером" }: { title?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const requestKey = useRef<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setState("sending");
    setMessage("");
    requestKey.current ??= crypto.randomUUID();

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_key: requestKey.current,
          company: String(form.get("company") ?? ""),
          name: String(form.get("name") ?? ""),
          phone: String(form.get("phone") ?? ""),
          email: String(form.get("email") ?? ""),
          message: String(form.get("message") ?? ""),
          request_items: [],
          page_url: window.location.href,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Не удалось отправить заявку");
      setState("success");
      setMessage(`Заявка принята: ${payload.id}`);
      requestKey.current = null;
      formElement.reset();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Ошибка отправки");
    }
  }

  return (
    <form className="lead-form panel" onSubmit={submit}>
      <span className="eyebrow">Обратная связь</span>
      <h2>{title}</h2>
      <label>Компания<input name="company" placeholder="ООО «Пример»" /></label>
      <label>Контактное лицо<input name="name" required minLength={2} placeholder="Имя" /></label>
      <div className="form-row">
        <label>Телефон<input name="phone" required type="tel" placeholder="+7 ..." /></label>
        <label>Email<input name="email" type="email" placeholder="mail@company.ru" /></label>
      </div>
      <label>Сообщение<textarea name="message" rows={5} placeholder="Чем можем помочь?" /></label>
      <button className="button primary wide" type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Отправляем..." : "Отправить"}
      </button>
      {message && <p role={state === "error" ? "alert" : "status"} className={state === "error" ? "form-message error" : "form-message"}>{message}</p>}
    </form>
  );
}
