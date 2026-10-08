import type { Metadata } from "next";
import Link from "next/link";
import { BulkRequestImport } from "@/components/BulkRequestImport";
import { RequestClient } from "@/components/RequestClient";

export const metadata: Metadata = {
  title: "Корзина",
  description: "Проверьте список товаров и отправьте заявку на расчёт.",
  alternates: { canonical: "/request" },
  robots: { index: false, follow: false },
};

export default function RequestPage() {
  return (
    <div className="shell page-shell">
      <div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>Корзина</span></div>
      <div className="page-title request-title">
        <h1>Корзина</h1>
        <p>Проверьте товары и количество. Мы уточним наличие и стоимость и ответим по вашей заявке.</p>
      </div>
      <details className="bulk-request-details">
        <summary>Добавить позиции списком или из файла</summary>
        <BulkRequestImport />
      </details>
      <div className="request-spacer" />
      <RequestClient />
    </div>
  );
}
