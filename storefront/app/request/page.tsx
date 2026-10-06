import type { Metadata } from "next";
import Link from "next/link";
import { BulkRequestImport } from "@/components/BulkRequestImport";
import { RequestClient } from "@/components/RequestClient";

export const metadata: Metadata = {
  title: "Заявка по списку",
  description: "Отправьте список артикулов запчастей: вручную, CSV или XLSX.",
  alternates: { canonical: "/request" },
};

export default function RequestPage() {
  return (
    <div className="shell page-shell">
      <div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>Заявка</span></div>
      <div className="page-title">
        <span className="eyebrow">RFQ / заявка по списку</span>
        <h1>Запросить предложение</h1>
        <p>Добавьте товары из каталога, вставьте артикулы вручную или загрузите XLSX/CSV. Всё собирается в одну B2B-заявку.</p>
      </div>
      <BulkRequestImport />
      <div className="request-spacer" />
      <RequestClient />
    </div>
  );
}
