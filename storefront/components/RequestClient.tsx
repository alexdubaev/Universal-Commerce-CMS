"use client";

import { useRequestItems } from "@/hooks/useRequestItems";
import { useRequestForm } from "@/hooks/useRequestForm";

export function RequestClient() {
  const { items, persist, changeQuantity, remove } = useRequestItems();
  const { status, message, submit } = useRequestForm(items, persist);

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
        {message && <p role={status === "error" ? "alert" : "status"} className={status === "error" ? "form-message error" : "form-message"}>{message}</p>}
        <small className="form-hint">Повторная отправка не должна создавать дублирующую заявку.</small>
      </form>
    </div>
  );
}
