import type { CategorizedEmail } from '../../models/categorization';

/**
 * Pure, React-free subject search for the e-mail list (mirrors the `emailFormatters.ts` /
 * `facetFilters.ts` split — logic that is trivially unit-testable without mounting a component).
 * Filters the already-tagged in-memory set by a free-text subject query; the categorization tags are
 * consumed verbatim and never re-derived (`.claude/rules/categorization-domain.md`).
 */

/**
 * Returns the e-mails whose subject **contains** `query`, matched case-insensitively. A blank query
 * (empty or whitespace-only) means "no filter" and returns the input array **unchanged** (same
 * reference), so callers can rely on referential stability when nothing is being searched. A missing
 * subject is treated as `''`, so it matches only the blank-query (return-all) case and is otherwise
 * excluded — never throwing.
 */
export function filterBySubject(emails: CategorizedEmail[], query: string): CategorizedEmail[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return emails;
  }
  const needle = trimmed.toLowerCase();
  return emails.filter((email) => (email.message.subject ?? '').toLowerCase().includes(needle));
}
