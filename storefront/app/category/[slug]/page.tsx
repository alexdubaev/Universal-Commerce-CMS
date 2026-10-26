import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { getCategory, getProducts } from "@/lib/catalog";
import { absoluteUrl, safeJsonLd } from "@/lib/seo";

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
  const categoryUrl = absoluteUrl(`/category/${category.slug}`);
  const collectionSchema = {
    "@context": "https://schema.org", "@type": "CollectionPage", "@id": `${categoryUrl}#collection`, url: categoryUrl,
    name: category.h1 || category.title, description: category.intro || category.description || undefined,
    mainEntity: { "@type": "ItemList", itemListElement: products.items.map((product, index) => ({ "@type": "ListItem", position: index + 1, item: { "@id": `${absoluteUrl(`/product/${product.slug}`)}#product`, name: product.title, url: absoluteUrl(`/product/${product.slug}`) } })) },
  };
  const breadcrumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Главная", item: absoluteUrl("/") },
    { "@type": "ListItem", position: 2, name: "Каталог", item: absoluteUrl("/catalog") },
    { "@type": "ListItem", position: 3, name: category.title, item: categoryUrl },
  ] };

  return (
    <div className="shell page-shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(collectionSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbs) }} />
      <div className="breadcrumbs">
        <Link href="/">Главная</Link><span>/</span>
        <Link href="/catalog">Каталог</Link><span>/</span>
        <span>{category.title}</span>
      </div>
      <div className="page-title category-title">

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
