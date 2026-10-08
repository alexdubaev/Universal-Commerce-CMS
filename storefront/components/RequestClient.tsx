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
  const { status, message, submit } = useRequestForm(items, persist);
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
          <strong>{unpricedItemCount ? "Итого по товарам с ценой" : "Итого"}</strong>
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

      <form className="lead-form panel" onSubmit={submit}>
        <h2>Данные для ответа</h2>
        <label>Компания<input name="company" placeholder="ООО «Пример»" /></label>
        <label>Контактное лицо<input name="name" required minLength={2} placeholder="Имя" /></label>
        <div className="form-row">
          <label>Телефон<input name="phone" required type="tel" placeholder="+7 ..." /></label>
          <label>Email<input name="email" type="email" placeholder="mail@company.ru" /></label>
        </div>
        <label>Комментарий<textarea name="message" rows={5} placeholder="Сроки, доставка, аналоги, реквизиты..." /></label>
        <button className="button primary wide" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Отправляем..." : "Отправить заявку"}
        </button>
        {message && <p role={status === "error" ? "alert" : "status"} className={status === "error" ? "form-message error" : "form-message"}>{message}</p>}
      </form>
    </div>
  );
}
