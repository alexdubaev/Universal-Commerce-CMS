"use client";

import { useEffect, useState } from "react";
import { useRequestItems } from "@/hooks/useRequestItems";
import { useRequestForm } from "@/hooks/useRequestForm";
import type { RequestItem } from "@/lib/types";
import type { Product } from "@/lib/types";
import { cartLineTotal, cartUnitPrice, resolveCartProduct } from "./cart-pricing";

type PriceEntry = { product: Product | null; failed: boolean };
const priceKey = (item: RequestItem) => JSON.stringify([item.article, item.brand]);

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  }));
  return results;
}

function formatItemCount(count: number) {
  const lastTwo = count % 100;
  const lastDigit = count % 10;
  const noun = lastTwo >= 11 && lastTwo <= 14
    ? "позиций"
    : lastDigit === 1
      ? "позиция"
      : lastDigit >= 2 && lastDigit <= 4
        ? "позиции"
        : "позиций";
  return `${count} ${noun}`;
}

export function RequestClient() {
  const { items, persist, changeQuantity, remove } = useRequestItems();
  const { status, message, submit, formRef, change, invalid, fieldErrors } = useRequestForm(items, persist);
  const [prices, setPrices] = useState<Record<string, PriceEntry>>({});
  const [priceState, setPriceState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const identityKey = JSON.stringify(items.map(({ article, brand }) => [article, brand]));
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const identities = new Map<string, RequestItem>();
    for (const item of items) identities.set(priceKey(item), item);
    setPrices({});
    if (!identities.size) {
      setPriceState("ready");
      return () => { active = false; controller.abort(); };
    }
    setPriceState("loading");
    void mapWithConcurrency([...identities.entries()], 4, async ([key, item]) => {
      const query = item.article.trim();
      if (query.length < 2 || query.length > 64) return [key, { product: null, failed: false }] as const;
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Price lookup failed");
        const payload = await response.json() as { data?: Product[]; meta?: { total?: number } };
        if (!Array.isArray(payload.data)) throw new Error("Price lookup returned invalid data");
        const total = payload.meta?.total;
        if (!Number.isSafeInteger(total) || (total as number) < payload.data.length) throw new Error("Price lookup returned invalid result count");
        return [key, { product: resolveCartProduct(item, payload.data, total), failed: false }] as const;
      } catch {
        if (controller.signal.aborted) return [key, { product: null, failed: false }] as const;
        return [key, { product: null, failed: true }] as const;
      }
    }).then((entries) => {
      if (!active) return;
      setPrices(Object.fromEntries(entries));
      setPriceState(entries.some(([, entry]) => entry.failed) ? "error" : "ready");
    });
    return () => { active = false; controller.abort(); };
  }, [identityKey, retry]);

  const unpricedItemCount = items.filter((item) => !cartUnitPrice(prices[priceKey(item)]?.product ?? null)).length;

  return (
    <div className="request-layout">
      <section className="request-items panel">
        <div className="section-heading">
          <div>
            <h2>{items.length ? formatItemCount(items.length) : "Список пока пуст"}</h2>
          </div>
        </div>
        {items.length === 0 ? (
          <div className="empty-state">
            <p>Найдите деталь в каталоге или добавьте свои артикулы списком.</p>
            <div className="request-empty-actions">
              <a className="button primary" href="/catalog">Перейти в каталог</a>
              <a className="button secondary" href="/request?import=1#request-import">Добавить список</a>
            </div>
          </div>
        ) : (
          <div className="request-lines">
            {items.map((item, index) => (
              <div className="request-line" key={`${item.brand}-${item.article}`}>
                <div>
                  <small>{item.brand}</small>
                  <strong>{item.article}</strong>
                  <span>{prices[priceKey(item)]?.product?.title || item.title}</span>
                  {priceState === "loading" ? <small className="cart-price-label">Загружаем цену…</small> : null}
                  {priceState !== "loading" && (prices[priceKey(item)]?.failed
                    ? <small className="cart-price-label">Не удалось загрузить цену</small>
                    : (() => {
                      const unit = cartUnitPrice(prices[priceKey(item)]?.product ?? null);
                      return unit ? <small className="cart-price-label">{unit.formatter.format(unit.amount)} за шт. · {unit.formatter.format(cartLineTotal(unit, item.quantity))} за {item.quantity} шт.</small> : <small className="cart-price-label">Цена по запросу</small>;
                    })())}
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
        {items.length > 0 && priceState !== "loading" && <div className="cart-totals" aria-live="polite">
          <strong>{unpricedItemCount ? "Расчёт по позициям с ценой" : "Расчёт по ценам каталога"}</strong>
          {(() => {
            const totals = new Map<string, { amount: number; formatter: Intl.NumberFormat }>();
            for (const item of items) {
              const unit = cartUnitPrice(prices[priceKey(item)]?.product ?? null);
              if (!unit) continue;
              const current = totals.get(unit.currency) ?? { amount: 0, formatter: unit.formatter };
              current.amount += cartLineTotal(unit, item.quantity);
              totals.set(unit.currency, current);
            }
            return totals.size
              ? [...totals.values()].map((total, index) => <b key={index}>{total.formatter.format(total.amount)}</b>)
              : <span>Сумма будет рассчитана после уточнения цен</span>;
          })()}
          {unpricedItemCount > 0 && <span className="cart-total-note">Позиции без цены не включены — стоимость уточнит менеджер.</span>}
          {priceState === "error" && <button className="cart-retry" type="button" onClick={() => setRetry((value) => value + 1)}>Повторить загрузку цен</button>}
        </div>}
      </section>

      <form className="lead-form panel" ref={formRef} onSubmit={submit} onChange={change} onInvalid={invalid} aria-busy={status === "sending"}>
        <h2>Данные для ответа</h2>
        <p className="form-hint">* Обязательные поля. Уточним наличие и стоимость и свяжемся с вами.</p>
        <label>Компания<input name="company" autoComplete="organization" disabled={status === "sending"} placeholder="ООО «Пример»" /></label>
        <label>Контактное лицо *<input name="name" autoComplete="name" required minLength={2} disabled={status === "sending"} placeholder="Имя" aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "request-name-error" : undefined} />
          {fieldErrors.name && <span id="request-name-error" className="field-error">{fieldErrors.name}</span>}
        </label>
        <div className="form-row">
          <label>Телефон *<input name="phone" autoComplete="tel" required type="tel" disabled={status === "sending"} placeholder="+7 …" aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? "request-phone-error" : undefined} />
            {fieldErrors.phone && <span id="request-phone-error" className="field-error">{fieldErrors.phone}</span>}
          </label>
          <label>Email<input name="email" autoComplete="email" type="email" disabled={status === "sending"} placeholder="mail@company.ru" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "request-email-error" : undefined} />
            {fieldErrors.email && <span id="request-email-error" className="field-error">{fieldErrors.email}</span>}
          </label>
        </div>
        <label>Комментарий<textarea name="message" rows={4} disabled={status === "sending"} placeholder="Сроки, доставка, аналоги, реквизиты…" /></label>
        <button className="button primary wide" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Отправляем…" : "Отправить заявку"}
        </button>
        {status === "sending" && <p className="form-hint" role="status">Отправляем заявку…</p>}
        {message && <p role={status === "error" ? "alert" : "status"} className={status === "error" ? "form-message error" : "form-message"}>{message}</p>}
      </form>
    </div>
  );
}
