import Link from "next/link";
import { getPublishedArticles } from "@/lib/articles";
import { ArticleCard } from "./ArticleCard";

export async function ArticlesSection() {
  const { items } = await getPublishedArticles({ limit: 3 });
  if (!items.length) return null;
  return <section className="section shell articles-home-section" aria-labelledby="home-articles-title"><div className="section-heading"><h2 id="home-articles-title">Статьи и рекомендации</h2><Link href="/articles" className="article-all-link">Все статьи <span aria-hidden="true">→</span></Link></div><div className="articles-grid">{items.map(article => <ArticleCard key={article.id} article={article} />)}</div></section>;
}
