import Link from "next/link";
import { RequestClient } from "@/components/RequestClient";

export default function RequestPage() {
  return (
    <div className="shell page-shell">
      <div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>Заявка</span></div>
      <div className="page-title">
        <span className="eyebrow">RFQ / заявка по списку</span>
        <h1>Запросить предложение</h1>
        <p>Добавьте товары из каталога или передайте список артикулов менеджеру. Заявка отправляется через существующий /commerce/leads.</p>
      </div>
      <RequestClient />
    </div>
  );
}
