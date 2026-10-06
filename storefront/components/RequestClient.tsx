"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { readRequestItems, writeRequestItems } from "@/lib/request-store";
import type { RequestItem } from "@/lib/types";

export function RequestClient() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const requestKey = useRef<string | null>(null);

  useEffect(() => {
    const sync = () => setItems(readRequestItems());
    sync();
    window.addEventListener("request-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("request-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function persist(next: RequestItem[]) {
    setItems(next);
    writeRequestItems(next);
  }

  function changeQuantity(index: number, delta: number) {
    const next = items.map((item, itemIndex) => itemIndex === index
      ? { ...item, quantity: Math.max(1, item.quantity + delta) }
      : item);
    persist(next);
  }

  function remove(index: number) {
    persist(items.filter((_, itemIndex) => itemIndex !== index));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setStatus("sending");
    setMessage("");
    requestKey.current ??= crypto.randomUUID();

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_key: requestKey.current,
          name: String(form.get("name") ?? ""),
          phone: String(form.get("phone") ?? ""),
          email: String(form.get("email") ?? ""),
          company: String(form.get("company") ?? ""),
          message: String(form.get("message") ?? ""),
          request_items: items.map(({ article, quantity }) => ({ article, quantity })),
          page_url: window.location.href,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Не удалось отправить заявку");
      setStatus("success");
      setMessage(`Заявка принята. Номер: ${payload.id}`);
      requestKey.current = null;
      persist([]);
      formElement.reset();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Ошибка отправки");
    }
  }

  return (
    <div className="request-layout">
      <section className="request-items panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Список позиций</span>
            <h2>{items.length ? `${items.length} позиций` : "Список пока пуст"}</h2>
          </div>
        </div>
        {items.length === 0 ? (
          <div className="empty-state">
            <p>Добавьте товары из каталога, вставьте список выше или загрузите XLSX/CSV.</p>
            <a className="button secondary" href="/catalog">Перейти в каталог</a>
          </div>
        ) : (
          <div className="request-lines">
            {items.map((item, index) => (
              <div className="request-line" key={`${item.brand}-${item.article}`}>
                <div>
                  <small>{item.brand}</small>
                  <strong>{item.article}</strong>
                  <span>{item.title}</span>
                </div>
                <div className="qty">
                  <button type="button" onClick={() => changeQuantity(index, -1)} aria-label={`Уменьшить количество ${item.article}`}>−</button>
                  <b>{item.quantity}</b>
                  <button type="button" onClick={() => changeQuantity(index, 1)} aria-label={`Увеличить количество ${item.article}`}>+</button>
                </div>
                <button className="remove" type="button" onClick={() => remove(index)} aria-label={`Удалить ${item.article}`}>×</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <form className="lead-form panel" onSubmit={submit}>
        <span className="eyebrow">B2B заявка</span>
        <h2>Получить предложение</h2>
        <label>Компания<input name="company" placeholder="ООО «Пример»" /></label>
        <label>Контактное лицо<input name="name" required minLength={2} placeholder="Имя" /></label>
        <div className="form-row">
          <label>Телефон<input name="phone" required type="tel" placeholder="+7 ..." /></label>
          <label>Email<input name="email" type="email" placeholder="mail@company.ru" /></label>
        </div>
        <label>Комментарий<textarea name="message" rows={5} placeholder="Сроки, доставка, аналоги, реквизиты..." /></label>
        <button className="button primary wide" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Отправляем..." : "Отправить менеджеру"}
        </button>
        {message && <p className={status === "error" ? "form-message error" : "form-message"}>{message}</p>}
        <small className="form-hint">Повторная отправка сохраняет тот же request_key до подтверждённого успеха.</small>
      </form>
    </div>
  );
}
