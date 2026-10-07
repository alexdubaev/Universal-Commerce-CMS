import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { getCategory, getProducts } from "@/lib/catalog";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return {};
  return {
    title: category.seo_title || category.h1 || category.title,
    description: category.seo_description || category.description || undefined,
    alternates: { canonical: `/category/${category.slug}` },
    robots: category.is_indexable === false ? { index: false, follow: true } : undefined,
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();

  const products = await getProducts({ category: slug, limit: 24 });

  return (
    <div className="shell page-shell">
      <div className="breadcrumbs">
        <Link href="/">Главная</Link><span>/</span>
        <Link href="/catalog">Каталог</Link><span>/</span>
        <span>{category.title}</span>
      </div>
      <div className="page-title category-title">
        <span className="eyebrow">Категория</span>
        <h1>{category.h1 || category.title}</h1>
        <p>{category.intro || category.description || "Товары выбранной категории."}</p>
        <Link className="button secondary" href={`/catalog?category=${category.slug}`}>Открыть с фильтрами</Link>
      </div>
      {products.items.length ? (
        <div className="product-grid">
          {products.items.map((product) => <ProductCard product={product} key={product.id} />)}
        </div>
      ) : (
        <div className="panel empty-state">
          <h2>Пока нет опубликованных товаров</h2>
          <Link className="button primary" href="/request">Отправить запрос</Link>
        </div>
      )}
    </div>
  );
}
