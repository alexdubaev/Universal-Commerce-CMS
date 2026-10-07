import type { Metadata } from "next";
import Link from "next/link";
import { getBrands } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Бренды запчастей",
  description: "Каталог брендов запчастей для спецтехники: Caterpillar, Komatsu, JCB, John Deere и другие.",
  alternates: { canonical: "/brands" },
};

export default async function BrandsPage() {
  const brands = await getBrands();
  return (
    <div className="shell page-shell">
      <div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><span>Бренды</span></div>
      <div className="page-title">
        <span className="eyebrow">Производители</span>
        <h1>Бренды техники</h1>
        <p>Каждый бренд ведёт в собственную выборку каталога, но использует одну модель товаров Universal Commerce CMS.</p>
      </div>
      <div className="brand-cards">
        {brands.map((brand) => (
          <Link className="brand-card panel" href={`/brand/${brand.slug}`} key={brand.slug}>
            <span className="brand-card-code">{brand.name.slice(0, 3).toUpperCase()}</span>
            <h2>{brand.name}</h2>
            <p>{brand.description}</p>
            <strong>Открыть каталог →</strong>
          </Link>
        ))}
      </div>
    </div>
  );
}
