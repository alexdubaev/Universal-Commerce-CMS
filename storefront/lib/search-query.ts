export const SEARCH_QUERY_MIN_LENGTH = 2;
export const SEARCH_QUERY_MAX_LENGTH = 64;

export type SearchQueryError = "too_short" | "too_long";

export function getSearchQueryError(value: string | null | undefined): SearchQueryError | null {
  const query = value?.trim() ?? "";
  if (!query) return null;
  if (query.length < SEARCH_QUERY_MIN_LENGTH) return "too_short";
  if (query.length > SEARCH_QUERY_MAX_LENGTH) return "too_long";
  return null;
}
