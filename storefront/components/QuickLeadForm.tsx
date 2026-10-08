"use client";

import { useRequestForm } from "@/hooks/useRequestForm";

export function QuickLeadForm({ title = "Связаться с менеджером" }: { title?: string }) {
  const { status: state, message, submit } = useRequestForm();

  return (
    <form className="lead-form panel" onSubmit={submit}>
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
