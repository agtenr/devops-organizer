import type { Message } from '@microsoft/microsoft-graph-types';

/**
 * Pure, React-free display formatters for the e-mail list/panel (mirrors the
 * `SidebarFilters`/`facetFilters` split — logic that is trivially unit-testable without mounting a
 * component). They read raw Graph `Message` fields only; the categorization tags are consumed
 * verbatim elsewhere and never re-derived (`.claude/rules/categorization-domain.md`).
 */

/** Formats an ISO `receivedDateTime` for a list row. Returns `''` for missing/unparseable input. */
export function formatReceivedDate(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * The message body resolved into how it must be rendered: `html` bodies go into a sandboxed iframe,
 * everything else (plain text, or a missing/empty body) renders as escaped preformatted text.
 */
export type ResolvedBody = { kind: 'html'; content: string } | { kind: 'text'; content: string };

/** Discriminates a Graph message body by `contentType`; empty/missing body → `{ kind:'text', '' }`. */
export function resolveBody(message: Message): ResolvedBody {
  const content = message.body?.content ?? '';
  if (!content) {
    return { kind: 'text', content: '' };
  }
  return message.body?.contentType === 'html'
    ? { kind: 'html', content }
    : { kind: 'text', content };
}
