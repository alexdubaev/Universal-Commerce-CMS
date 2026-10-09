import type { Metadata } from "next";
import Link from "next/link";
import { ArticleCard } from "@/components/articles/ArticleCard";
import { ARTICLE_LIST_LIMIT, getPublishedArticles, normalizeArticlePagination } from "@/lib/articles";
import { absoluteUrl } from "@/lib/seo";

type Props = { searchParams: Promise<{ page?: string | string[] }> };
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const page = pageNumber((await searchParams).page);
  const title = page > 1 ? `Статьи и рекомендации — страница ${page}` : "Статьи и рекомендации";
  const description = "Материалы о поиске запчастей и подготовке заявки.";
  const url = absoluteUrl(page > 1 ? `/articles?page=${page}` : "/articles");
  return { title, description, alternates: { canonical: url }, openGraph: { type: "website", title, description, url } };
}
function pageNumber(value: string | string[] | undefined): number {
  const number = typeof value === "string" && /^\d{1,16}$/.test(value) ? Number(value) : 1;
  return normalizeArticlePagination({ page: number, limit: ARTICLE_LIST_LIMIT }).page;
}

export default async function ArticlesPage({ searchParams }: Props) {
  const page = pageNumber((await searchParams).page);
  const { items, total, limit } = await getPublishedArticles({ page, limit: ARTICLE_LIST_LIMIT });
  const pages = Math.min(Math.ceil(total / limit), normalizeArticlePagination({ limit }).maxPage);
  return <div className="shell page-shell articles-list-page">
    <nav className="breadcrumbs" aria-label="Хлебные крошки"><Link href="/">Главная</Link><span aria-hidden="true">/</span><span aria-current="page">Статьи</span></nav>
    <header className="articles-list-header"><h1>Статьи и рекомендации</h1><p>Материалы о поиске запчастей и подготовке заявки.</p></header>
    {items.length ? <div className="articles-grid">{items.map(article => <ArticleCard key={article.id} article={article} headingLevel={2} />)}</div> : <div className="articles-empty"><h2>{page > 1 ? "На этой странице нет материалов" : "Опубликованных материалов пока нет"}</h2><p>Вы можете перейти в каталог или вернуться к списку статей позже.</p><Link href={page > 1 ? "/articles" : "/catalog"} className="button button-secondary">{page > 1 ? "К первой странице" : "В каталог"}</Link></div>}
    {(page > 1 || pages > page) && <nav className="articles-pagination" aria-label="Страницы статей">{page > 1 && <Link href={page === 2 ? "/articles" : `/articles?page=${page - 1}`} rel="prev">← Предыдущая</Link>}<span>Страница {page}{pages >= page ? ` из ${pages}` : ""}</span>{pages > page && <Link href={`/articles?page=${page + 1}`} rel="next">Следующая →</Link>}</nav>}
  </div>;
}
