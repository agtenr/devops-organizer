import { useCallback, useState } from 'react';
import type { CategorizedEmail } from '../../models/categorization';

/**
 * `EmailList` view logic (see `.claude/rules/frontend-architecture.md` — logic lives in a colocated
 * hook, not JSX). Owns the **view-only** body-panel selection; the pure display formatters the
 * rows/panel consume live alongside in `emailFormatters.ts`. It never re-derives categorization
 * tags — the engine's `(customer, project, type)` triple is consumed verbatim
 * (`.claude/rules/categorization-domain.md`).
 */

/** The GUID + organization of the row whose "Resolve project GUID" dialog is open. */
export interface ResolveTarget {
  guid: string;
  customer: string;
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
  /** The row targeted by the Resolve Project GUID dialog, or `null` when it is closed. */
  resolveTarget: ResolveTarget | null;
  /** Open the resolve dialog for an unresolved-GUID row. */
  openResolve: (guid: string, customer: string) => void;
  /** Close the resolve dialog. */
  closeResolve: () => void;
}

/**
 * Owns which e-mail's body is shown and whether the panel is open. The selected e-mail is captured by
 * value on open, so the panel keeps showing it even if a later filter change removes that row from
 * `emails` (the ratified "keep showing until closed" behavior — see `plans/40/plan.md`).
 */
export function useEmailList(emails: CategorizedEmail[]): UseEmailListResult {
  const [selectedEmail, setSelectedEmail] = useState<CategorizedEmail | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<ResolveTarget | null>(null);

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

  const openResolve = useCallback((guid: string, customer: string) => {
    setResolveTarget({ guid, customer });
  }, []);

  const closeResolve = useCallback(() => {
    setResolveTarget(null);
  }, []);

  return {
    selectedEmail,
    isPanelOpen,
    openEmail,
    closePanel,
    resolveTarget,
    openResolve,
    closeResolve,
  };
}
