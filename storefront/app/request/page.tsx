import type { Metadata } from "next";
import Link from "next/link";
import { BulkRequestImport } from "@/components/BulkRequestImport";
import { RequestClient } from "@/components/RequestClient";

export const metadata: Metadata = {
  title: "Ваша заявка",
  description: "Проверьте список товаров и отправьте заявку на расчёт.",
  alternates: { canonical: "/request" },
  robots: { index: false, follow: false },
};

export default async function RequestPage({ searchParams }: {
  searchParams: Promise<{ import?: string | string[]; article?: string | string[] }>;
}) {
  const query = await searchParams;
  const article = typeof query.article === "string" ? query.article : "";
  return (
    <div className="shell page-shell request-page">
      <div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>Ваша заявка</span></div>
      <div className="page-title request-title">
        <h1>Ваша заявка</h1>
        <p>Проверьте артикулы и количество. Отправьте список для уточнения наличия и стоимости.</p>
      </div>
      <details className="bulk-request-details" id="request-import" open={query.import === "1"}>
        <summary>Добавить позиции списком или из файла</summary>
        <BulkRequestImport initialArticle={article} />
      </details>
      <RequestClient />
    </div>
  );
}
