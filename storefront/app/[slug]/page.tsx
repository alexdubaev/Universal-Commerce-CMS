import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CmsPageRenderer } from "@/components/CmsPageRenderer";
import { getCmsPage } from "@/lib/content";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getCmsPage(slug);
  if (!page) return {};
  return {
    title: page.seo_title || page.title,
    description: page.seo_description || page.intro || undefined,
    alternates: { canonical: page.canonical_url || `/${page.slug}` },
    robots: page.is_indexable === false ? { index: false, follow: true } : undefined,
    openGraph: {
      title: page.seo_title || page.title,
      description: page.seo_description || page.intro || undefined,
      images: page.og_image ? [{ url: `/api/assets/${page.og_image}` }] : undefined,
    },
  };
}

export default async function CmsStandardPage({ params }: Props) {
  const { slug } = await params;
  const page = await getCmsPage(slug);
  if (!page) notFound();
  return <CmsPageRenderer page={page} />;
}
