import type { Product, ProductRelation } from "@/lib/types";

function normalizedIdentity(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9А-ЯЁ]+/g, "");
}

function titleContainsIdentity(title: string, identity: string) {
  const expected = normalizedIdentity(identity);
  const tokens = title.toUpperCase().match(/[A-Z0-9А-ЯЁ]+(?:[-./][A-Z0-9А-ЯЁ]+)*/g) ?? [];
  for (let start = 0; start < tokens.length; start++) {
    let candidate = "";
    for (let end = start; end < tokens.length && candidate.length < expected.length; end++) {
      candidate += normalizedIdentity(tokens[end]);
      if (candidate === expected) return true;
    }
  }
  return false;
}

export function productHeading(product: Product) {
  return [product.title, ...[product.brand, product.sku].filter((identity) => identity && !titleContainsIdentity(product.title, identity))].join(" ");
}

export type ProductRelationGroup = {
  product: Product;
  relationTypes: ProductRelation["relation_type"][];
};

export function groupProductRelations(currentId: string, relations: ProductRelation[]) {
  const groups = new Map<string, ProductRelationGroup>();
  for (const relation of relations) {
    if (relation.product.id === currentId) continue;
    const group = groups.get(relation.product.id);
    if (group) {
      if (!group.relationTypes.includes(relation.relation_type)) group.relationTypes.push(relation.relation_type);
    } else {
      groups.set(relation.product.id, { product: relation.product, relationTypes: [relation.relation_type] });
    }
  }
  return [...groups.values()];
}
