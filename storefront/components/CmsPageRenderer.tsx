import Link from "next/link";
import { safeContentHref } from "@/lib/content";
import type { CmsPage, CmsPageSection } from "@/lib/types";

type ItemView = {
  title: string;
  text?: string;
  label?: string;
  value?: string;
  url?: string;
};

function normalizeItems(value: unknown): ItemView[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return [{ title: item }];
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const title = String(row.title ?? row.name ?? row.label ?? row.question ?? "").trim();
    const text = String(row.text ?? row.description ?? row.answer ?? row.value ?? "").trim();
    const label = String(row.label ?? "").trim();
    const val = String(row.value ?? "").trim();
    const rawUrl = String(row.url ?? row.href ?? row.link ?? "").trim();
    if (!title && !text && !label && !val) return [];
    return [{
      title: title || label || val,
      text: text || undefined,
      label: label || undefined,
      value: val || undefined,
      url: safeContentHref(rawUrl) || undefined,
    }];
  });
}

function SmartLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  if (href.startsWith("/")) return <Link className={className} href={href}>{children}</Link>;
  return <a className={className} href={href} target="_blank" rel="noreferrer">{children}</a>;
}

function SectionButton({ section }: { section: CmsPageSection }) {
  const href = safeContentHref(section.button_url);
  if (!href || !section.button_text) return null;
  return <SmartLink className="button primary" href={href}>{section.button_text}</SmartLink>;
}

function SectionItems({ section }: { section: CmsPageSection }) {
  const items = normalizeItems(section.items);
  if (!items.length) return null;

  if (section.section_type === "faq") {
    return (
      <div className="cms-faq">
        {items.map((item, index) => (
          <details key={`${item.title}-${index}`}>
            <summary>{item.title}</summary>
            {item.text && <p>{item.text}</p>}
          </details>
        ))}
      </div>
    );
  }

  return (
    <div className="cms-item-grid">
      {items.map((item, index) => {
        const body = (
          <>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{item.title}</strong>
            {item.text && <p>{item.text}</p>}
            {item.label && item.value && <small>{item.label}: {item.value}</small>}
          </>
        );
        return item.url
          ? <SmartLink className="cms-item" href={item.url} key={`${item.title}-${index}`}>{body}</SmartLink>
          : <div className="cms-item" key={`${item.title}-${index}`}>{body}</div>;
      })}
    </div>
  );
}

function CmsSection({ section }: { section: CmsPageSection }) {
  if (section.section_type === "cta" || section.section_type === "parts_request" || section.section_type === "lead_form") {
    return (
      <section className="panel callout cms-section cms-cta">
        <div>
          {section.subtitle && <span className="eyebrow">{section.subtitle}</span>}
          {section.title && <h2>{section.title}</h2>}
          {section.text && <p>{section.text}</p>}
        </div>
        <SectionButton section={section} />
      </section>
    );
  }

  return (
    <section className={`panel cms-section cms-section-${section.section_type}`}>
      <div className="cms-section-copy">
        {section.subtitle && <span className="eyebrow">{section.subtitle}</span>}
        {section.title && <h2>{section.title}</h2>}
        {section.text && <p>{section.text}</p>}
        <SectionButton section={section} />
      </div>
      {section.image && (
        <div className="cms-section-media">
          <img src={`/api/assets/${section.image}`} alt={section.image_alt || section.title || ""} loading="lazy" />
        </div>
      )}
      <SectionItems section={section} />
    </section>
  );
}

export function CmsSections({ sections, className = "" }: { sections: CmsPageSection[]; className?: string }) {
  if (!sections.length) return null;
  return (
    <div className={`cms-sections ${className}`.trim()}>
      {sections.map((section) => <CmsSection section={section} key={section.id} />)}
    </div>
  );
}

export function CmsPageRenderer({ page }: { page: CmsPage }) {
  return (
    <div className="shell page-shell">
      <div className="breadcrumbs">
        <Link href="/">Главная</Link><span>/</span><span>{page.title}</span>
      </div>

      <div className="page-title">
        {page.eyebrow && <span className="eyebrow">{page.eyebrow}</span>}
        <h1>{page.h1 || page.title}</h1>
        {page.intro && <p>{page.intro}</p>}
      </div>

      <CmsSections sections={page.sections} />

      {page.seo_text && (
        <section className="panel prose cms-seo-text">
          <p>{page.seo_text}</p>
        </section>
      )}
    </div>
  );
}
