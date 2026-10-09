import { createElement, type ReactNode } from "react";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { isValidAssetId } from "@/lib/assets";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];
type Heading = { id: string; title: string; level: number };
export type PreparedArticleContent = { nodes: ReactNode[]; headings: Heading[]; truncated: boolean };
const MAX_LENGTH = 250_000;
const MAX_NODES = 5_000;
const MAX_DEPTH = 32;
const allowed = new Set(["p", "h2", "h3", "h4", "ul", "ol", "li", "strong", "b", "em", "i", "br", "hr", "blockquote", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "figure", "figcaption", "a", "img", "code", "pre", "sub", "sup", "s", "u"]);
const discarded = new Set(["script", "style", "iframe", "object", "embed", "svg", "math", "template", "form", "input", "button", "textarea", "select", "option", "link", "meta", "base", "noscript"]);
const attributes = (element: Element) => Object.fromEntries(element.attrs.filter(attr => !attr.namespace).map(attr => [attr.name, attr.value]));

function href(value: string | undefined): string | null {
  if (!value || value.length > 2000 || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
  if (/^#section-\d+$/.test(value)) return value;
  if (/^\/(?:$|catalog(?:\?[^#]*)?$|brands$|request(?:\?[^#]*)?$|delivery$|payment$|about$|contacts$|(?:articles|category|product)\/[\p{L}\p{N}_%-]+$|articles$)/u.test(value)) return value;
  try {
    const url = new URL(value);
    if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) return url.toString();
  } catch { /* Invalid, relative and protocol-relative links become plain text. */ }
  return null;
}
function image(value: string | undefined, permitted: Set<string>): string | null {
  if (!value) return null;
  const id = /^(?:\/(?:api\/)?assets\/)?([0-9a-f-]+)$/i.exec(value)?.[1]?.toLowerCase();
  return id && isValidAssetId(id) && permitted.has(id) ? `/api/assets/${id}` : null;
}
function headingText(node: Node, depth = 0): string {
  if (depth > MAX_DEPTH) return "";
  if (node.nodeName === "#text") return (node as DefaultTreeAdapterMap["textNode"]).value;
  if ("tagName" in node && discarded.has(node.tagName)) return "";
  return "childNodes" in node ? node.childNodes.map(child => headingText(child, depth + 1)).join("") : "";
}

export function prepareArticleContent(content: string, allowedAssetIds: string[] = []): PreparedArticleContent {
  const fragment = parseFragment(content.slice(0, MAX_LENGTH));
  const permitted = new Set(allowedAssetIds.filter(isValidAssetId).map(id => id.toLowerCase()));
  const headings: Heading[] = [];
  let visited = 0;
  let truncated = content.length > MAX_LENGTH;
  function render(node: Node, depth: number, key: string): ReactNode {
    if (++visited > MAX_NODES || depth > MAX_DEPTH) { truncated = true; return null; }
    if (node.nodeName === "#text") return (node as DefaultTreeAdapterMap["textNode"]).value;
    if (!("tagName" in node) || node.namespaceURI !== "http://www.w3.org/1999/xhtml" || discarded.has(node.tagName)) return null;
    const tag = node.tagName === "h1" ? "h2" : node.tagName;
    const attrs = attributes(node);
    const props: Record<string, unknown> = { key };
    if (/^h[234]$/.test(tag)) {
      const title = headingText(node).replace(/\s+/g, " ").trim().slice(0, 500);
      if (title) {
        const id = `section-${headings.length + 1}`;
        props.id = id;
        headings.push({ id, title, level: Number(tag.slice(1)) });
      }
    }
    const children: ReactNode[] = [];
    for (let i = 0; i < node.childNodes.length && visited <= MAX_NODES; i++) children.push(render(node.childNodes[i], depth + 1, `${key}-${i}`));
    if (!allowed.has(tag)) return createElement("span", props, children);
    if (tag === "a") {
      const target = href(attrs.href);
      if (!target) return createElement("span", { key }, children);
      props.href = target;
      if (/^https?:/.test(target)) props.rel = "noopener noreferrer";
    }
    if (tag === "img") {
      const src = image(attrs.src, permitted);
      if (!src) return null;
      return createElement("img", { key, src, alt: (attrs.alt ?? "").slice(0, 500), loading: "lazy", decoding: "async" });
    }
    if (tag === "th" && ["col", "row"].includes(attrs.scope)) props.scope = attrs.scope;
    if ((tag === "td" || tag === "th") && /^[1-9]\d?$/.test(attrs.colspan ?? "")) props.colSpan = Number(attrs.colspan);
    if ((tag === "td" || tag === "th") && /^[1-9]\d?$/.test(attrs.rowspan ?? "")) props.rowSpan = Number(attrs.rowspan);
    if (tag === "ol" && /^\d{1,4}$/.test(attrs.start ?? "")) props.start = Number(attrs.start);
    if (tag === "br" || tag === "hr") return createElement(tag, props);
    const element = createElement(tag, props, children);
    return tag === "table" ? createElement("div", { key, className: "article-table-scroll", tabIndex: 0, role: "region", "aria-label": "Таблица в статье" }, element) : element;
  }
  const nodes: ReactNode[] = [];
  for (let i = 0; i < fragment.childNodes.length && visited <= MAX_NODES; i++) nodes.push(render(fragment.childNodes[i], 0, String(i)));
  return { nodes, headings, truncated };
}

export function ArticleContent({ prepared }: { prepared: PreparedArticleContent }) {
  return <div className="article-prose">{prepared.nodes}{prepared.truncated && <p className="article-content-note">Материал слишком длинный. Показана доступная часть текста.</p>}</div>;
}
