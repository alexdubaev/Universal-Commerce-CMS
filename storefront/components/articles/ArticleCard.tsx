import Link from "next/link";
import type { ArticleSummary } from "@/lib/articles";

export function articleDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

export function ArticleCard({ article, headingLevel = 3 }: { article: ArticleSummary; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return <article className={`article-card${article.cover_image ? " article-card-with-image" : ""}`}>
    {article.cover_image && <Link href={`/articles/${encodeURIComponent(article.slug)}`} tabIndex={-1} aria-hidden="true" className="article-card-image"><img src={`/api/assets/${article.cover_image}`} alt="" loading="lazy" /></Link>}
    <div className="article-card-body">
      <time className="article-date" dateTime={article.published_at}>{articleDate(article.published_at)}</time>
      <Heading><Link href={`/articles/${encodeURIComponent(article.slug)}`}>{article.title}</Link></Heading>
      {article.excerpt && <p>{article.excerpt}</p>}
      <Link className="article-read-link" href={`/articles/${encodeURIComponent(article.slug)}`} aria-label={`Читать: ${article.title}`}>Читать статью <span aria-hidden="true">→</span></Link>
    </div>
  </article>;
}
