"use client";

import { useId } from "react";
import { useRequestForm } from "@/hooks/useRequestForm";

export function QuickLeadForm({ title = "Связаться с менеджером" }: { title?: string }) {
  const { status: state, message, submit, formRef, change, invalid, fieldErrors } = useRequestForm();
  const id = useId();

  return (
    <form className="lead-form panel" ref={formRef} onSubmit={submit} onChange={change} onInvalid={invalid} aria-busy={state === "sending"}>
      <h2>{title}</h2>
      <p className="form-hint">* Обязательные поля</p>
      <label>Компания<input name="company" autoComplete="organization" disabled={state === "sending"} placeholder="ООО «Пример»" /></label>
      <label>Контактное лицо *<input name="name" autoComplete="name" required minLength={2} disabled={state === "sending"} placeholder="Имя" aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? `${id}-name-error` : undefined} />
        {fieldErrors.name && <span id={`${id}-name-error`} className="field-error">{fieldErrors.name}</span>}
      </label>
      <div className="form-row">
        <label>Телефон *<input name="phone" autoComplete="tel" required type="tel" disabled={state === "sending"} placeholder="+7 …" aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? `${id}-phone-error` : undefined} />
          {fieldErrors.phone && <span id={`${id}-phone-error`} className="field-error">{fieldErrors.phone}</span>}
        </label>
        <label>Email<input name="email" autoComplete="email" type="email" disabled={state === "sending"} placeholder="mail@company.ru" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? `${id}-email-error` : undefined} />
          {fieldErrors.email && <span id={`${id}-email-error`} className="field-error">{fieldErrors.email}</span>}
        </label>
      </div>
      <label>Сообщение<textarea name="message" rows={4} disabled={state === "sending"} placeholder="Чем можем помочь?" /></label>
      <button className="button primary wide" type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Отправляем…" : "Отправить заявку"}
      </button>
      {state === "sending" && <p className="form-hint" role="status">Отправляем заявку…</p>}
      {message && <p role={state === "error" ? "alert" : "status"} className={state === "error" ? "form-message error" : "form-message"}>{message}</p>}
    </form>
  );
}
