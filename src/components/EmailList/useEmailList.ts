import { useCallback, useState } from 'react';
import type { Message } from '@microsoft/microsoft-graph-types';
import type { CategorizedEmail } from '../../models/categorization';

/**
 * `EmailList` view logic (see `.claude/rules/frontend-architecture.md` — logic lives in a colocated
 * hook, not JSX). Owns the **view-only** body-panel selection and the pure, unit-testable formatters
 * the rows/panel consume. It never re-derives categorization tags — the engine's
 * `(customer, project, type)` triple is consumed verbatim (`.claude/rules/categorization-domain.md`).
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

/** The body-panel selection state exposed to `EmailList`. */
export interface UseEmailListResult {
  /** The e-mail whose body the panel shows, or `null` when nothing has been opened yet. */
  selectedEmail: CategorizedEmail | null;
  /** Whether the body panel is open. */
  isPanelOpen: boolean;
  /** Open the panel on the e-mail with this `message.id`. */
  openEmail: (id: string) => void;
  /** Close the panel (keeps the last selection so its content persists during the close). */
  closePanel: () => void;
}

/**
 * Owns which e-mail's body is shown and whether the panel is open. The selected e-mail is captured by
 * value on open, so the panel keeps showing it even if a later filter change removes that row from
 * `emails` (the ratified "keep showing until closed" behavior — see `plans/40/plan.md`).
 */
export function useEmailList(emails: CategorizedEmail[]): UseEmailListResult {
  const [selectedEmail, setSelectedEmail] = useState<CategorizedEmail | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const openEmail = useCallback(
    (id: string) => {
      const found = emails.find((email) => email.message.id === id);
      if (!found) {
        return;
      }
      setSelectedEmail(found);
      setIsPanelOpen(true);
    },
    [emails],
  );

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  return { selectedEmail, isPanelOpen, openEmail, closePanel };
}
