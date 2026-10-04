import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { findBrand, getProducts } from "@/lib/catalog";

type Props = { params: Promise<{ brand: string }> };

export default async function BrandPage({ params }: Props) {
  const { brand: slug } = await params;
  const brand = findBrand(slug);
  if (!brand) notFound();

  const products = await getProducts({ brand: slug, limit: 12 });

  return (
    <>
      <section className="brand-hero">
        <div className="shell brand-hero-grid">
          <div>
            <div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><Link href="/catalog">Каталог</Link><span>/</span><span>{brand.name}</span></div>
            <span className="eyebrow">Каталог бренда</span>
            <h1>{brand.name}</h1>
            <p>{brand.description}</p>
            <Link className="button primary" href={`/catalog?brand=${brand.slug}`}>Все товары {brand.name}</Link>
          </div>
          <div className="brand-monogram" aria-hidden="true">{brand.name.slice(0, 3).toUpperCase()}</div>
        </div>
      </section>
      <section className="section shell">
        <div className="brand-stats">
          <div><strong>{products.total}+</strong><span>позиций в текущем источнике</span></div>
          <div><strong>OEM</strong><span>дополнительные номера</span></div>
          <div><strong>24/7</strong><span>онлайн-заявка</span></div>
          <div><strong>B2B</strong><span>работа с юрлицами</span></div>
        </div>
        <div className="section-heading">
          <div><span className="eyebrow">{brand.name}</span><h2>Товары</h2></div>
        </div>
        <div className="product-grid">
          {products.items.map((product) => <ProductCard product={product} key={product.id} />)}
        </div>
      </section>
    </>
  );
}
