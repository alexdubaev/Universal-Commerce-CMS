import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleCard, articleDate } from "@/components/articles/ArticleCard";
import { ArticleContent, prepareArticleContent } from "@/components/articles/ArticleContent";
import { getArticleRelatedLinks, getPublishedArticle, getPublishedArticles } from "@/lib/articles";
import { absoluteUrl, safeJsonLd } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getPublishedArticle((await params).slug);
  if (!article) return { title: "Статья не найдена", robots: { index: false, follow: true } };
  const title = article.seo_title || article.title;
  const description = article.seo_description || article.excerpt || article.title;
  const url = absoluteUrl(`/articles/${encodeURIComponent(article.slug)}`);
  const image = article.og_image || article.cover_image;
  return { title, description, alternates: { canonical: url }, authors: article.author ? [{ name: article.author }] : undefined, openGraph: { type: "article", title, description, url, publishedTime: article.published_at, authors: article.author ? [article.author] : undefined, images: image ? [{ url: absoluteUrl(`/api/assets/${image}`), ...(article.image_alt ? { alt: article.image_alt } : {}) }] : [] }, twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [absoluteUrl(`/api/assets/${image}`)] : [] } };
}

export default async function ArticlePage({ params }: Props) {
  const article = await getPublishedArticle((await params).slug);
  if (!article) notFound();
  const [{ items }, relatedLinks] = await Promise.all([getPublishedArticles({ limit: 3 }), getArticleRelatedLinks(article)]);
  const related = items.find(item => item.id !== article.id);
  const prepared = prepareArticleContent(article.content, [article.cover_image, article.og_image].filter((id): id is string => id !== null));
  const showContents = prepared.headings.length >= 4 || (prepared.headings.length >= 2 && article.content.length >= 6_000);
  const url = absoluteUrl(`/articles/${encodeURIComponent(article.slug)}`);
  const articleSchema = { "@context": "https://schema.org", "@type": "Article", headline: article.title, description: article.excerpt || undefined, datePublished: article.published_at, mainEntityOfPage: url, url, author: article.author ? { "@type": "Person", name: article.author } : undefined, image: article.cover_image ? absoluteUrl(`/api/assets/${article.cover_image}`) : undefined };
  const breadcrumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [ { "@type": "ListItem", position: 1, name: "Главная", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: "Статьи", item: absoluteUrl("/articles") }, { "@type": "ListItem", position: 3, name: article.title, item: url } ] };
  return <div className="shell page-shell article-detail-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(articleSchema) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbs) }} />
    <nav className="breadcrumbs" aria-label="Хлебные крошки"><Link href="/">Главная</Link><span aria-hidden="true">/</span><Link href="/articles">Статьи</Link><span aria-hidden="true">/</span><span aria-current="page">{article.title}</span></nav>
    <article className="article-reading-column">
      <header className="article-header"><div className="article-meta"><time dateTime={article.published_at}>{articleDate(article.published_at)}</time>{article.author && <span>Автор: {article.author}</span>}</div><h1>{article.title}</h1>{article.excerpt && <p className="article-intro">{article.excerpt}</p>}</header>
      {article.cover_image && <figure className="article-cover"><img src={`/api/assets/${article.cover_image}`} alt={article.image_alt || ""} /></figure>}
      {showContents && <nav className="article-toc" aria-label="Оглавление статьи"><h2>В этой статье</h2><ol>{prepared.headings.map(heading => <li key={heading.id} className={heading.level > 2 ? "article-toc-subheading" : undefined}><a href={`#${heading.id}`}>{heading.title}</a></li>)}</ol></nav>}
      <ArticleContent prepared={prepared} />
      {relatedLinks.length > 0 && <section className="article-related-links" aria-labelledby="article-catalog-links"><h2 id="article-catalog-links">В каталоге</h2><ul>{relatedLinks.map(link => <li key={link.href}><Link href={link.href}>{link.title}</Link></li>)}</ul></section>}
      <aside className="article-next-step"><p>Готовы передать артикулы для расчёта?</p><Link href="/request?import=1">Добавить список в заявку <span aria-hidden="true">→</span></Link></aside>
    </article>
    {related && <section className="article-related-section" aria-labelledby="related-article-heading"><h2 id="related-article-heading">Читайте также</h2><div className="articles-grid"><ArticleCard article={related} /></div></section>}
  </div>;
}
