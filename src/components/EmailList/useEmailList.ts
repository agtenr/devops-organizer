import { useCallback, useMemo, useState } from 'react';
import type { CategorizedEmail } from '../../models/categorization';

/**
 * `EmailList` view logic (see `.claude/rules/frontend-architecture.md` — logic lives in a colocated
 * hook, not JSX). Owns the **view-only** body-panel selection, the multi-select set for bulk delete,
 * and which delete-confirm dialog is open; the pure display formatters the rows/panel consume live
 * alongside in `emailFormatters.ts`. It never re-derives categorization tags — the engine's
 * `(customer, project, type)` triple is consumed verbatim (`.claude/rules/categorization-domain.md`).
 */

/** The GUID + organization of the row whose "Resolve project GUID" dialog is open. */
export interface ResolveTarget {
  guid: string;
  customer: string;
}

/** The messages a confirm-delete dialog is about to delete (bulk = many ids; row = one, with subject). */
export interface DeleteTarget {
  /** The message ids to delete. */
  ids: string[];
  /** The single e-mail's subject, for the row-delete confirm text (absent for bulk). */
  subject?: string;
}

/** The selection / panel / dialog state exposed to `EmailList`. */
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
  /** The message ids currently checked for bulk delete (always a subset of the visible rows). */
  selectedIds: ReadonlySet<string>;
  /** How many rows are checked (drives the bulk Delete button's enablement). */
  selectedCount: number;
  /** Toggle a single row's checkbox. */
  toggleSelected: (id: string) => void;
  /** Toggle select-all over the given visible ids: select them all, or clear if all are already on. */
  toggleSelectAll: (ids: string[]) => void;
  /** Clear the whole selection. */
  clearSelection: () => void;
  /** The messages a confirm-delete dialog is open for, or `null` when none is open. */
  deleteTarget: DeleteTarget | null;
  /** Open the confirm dialog to delete a single row. */
  openDeleteRow: (email: CategorizedEmail) => void;
  /** Open the confirm dialog to delete the current selection. */
  openDeleteBulk: () => void;
  /** Close the confirm dialog. */
  closeDelete: () => void;
}

/**
 * Owns which e-mail's body is shown and whether the panel is open. The selected e-mail is captured by
 * value on open, so the panel keeps showing it even if a later filter change removes that row from
 * `emails` (the ratified "keep showing until closed" behavior — see `plans/40/plan.md`). The panel's
 * effective open state is derived against the **full corpus** `allEmails`, not the filtered `emails`:
 * a mere filter change leaves the e-mail in the corpus so the panel persists (story 40), but **deleting**
 * the previewed e-mail removes it from the corpus, so the panel closes (`plans/55/plan.md`). Bulk
 * selection is pruned to the currently-visible rows, so a filter change can never leave a hidden row
 * selected for deletion (`plans/43/plan.md`).
 */
export function useEmailList(
  emails: CategorizedEmail[],
  allEmails: CategorizedEmail[],
): UseEmailListResult {
  const [selectedEmail, setSelectedEmail] = useState<CategorizedEmail | null>(null);
  const [rawIsPanelOpen, setRawIsPanelOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<ResolveTarget | null>(null);
  const [rawSelectedIds, setRawSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const openEmail = useCallback(
    (id: string) => {
      const found = emails.find((email) => email.message.id === id);
      if (!found) {
        return;
      }
      setSelectedEmail(found);
      setRawIsPanelOpen(true);
    },
    [emails],
  );

  const closePanel = useCallback(() => {
    setRawIsPanelOpen(false);
  }, []);

  const openResolve = useCallback((guid: string, customer: string) => {
    setResolveTarget({ guid, customer });
  }, []);

  const closeResolve = useCallback(() => {
    setResolveTarget(null);
  }, []);

  // Ids present in the full categorized corpus (not the filtered set). The previewed e-mail persists
  // across filter changes (story 40) but must vanish once it leaves the corpus, i.e. is deleted.
  const allIds = useMemo(
    () =>
      new Set(allEmails.map((email) => email.message.id).filter((id): id is string => Boolean(id))),
    [allEmails],
  );

  // Derive the effective open state during render (no setState-in-effect): open only while the raw
  // flag is set AND the captured e-mail still exists in the corpus. Deleting it drops it from `allIds`,
  // so the panel closes on its own; a filter change leaves it in the corpus, so the panel stays open.
  const selectedId = selectedEmail?.message.id;
  const isPanelOpen = rawIsPanelOpen && selectedId != null && allIds.has(selectedId);

  // The ids currently visible in the (filtered) list — the ceiling for selection and select-all.
  const visibleIds = useMemo(
    () =>
      new Set(emails.map((email) => email.message.id).filter((id): id is string => Boolean(id))),
    [emails],
  );

  // Derive the effective selection as the raw picks intersected with the currently-visible rows, so a
  // filter change can never leave a hidden row selected for deletion. Deriving during render (rather
  // than syncing raw state in an effect) keeps the invariant without a setState-in-effect.
  const selectedIds = useMemo<ReadonlySet<string>>(() => {
    const next = new Set<string>();
    for (const id of rawSelectedIds) {
      if (visibleIds.has(id)) {
        next.add(id);
      }
    }
    return next;
  }, [rawSelectedIds, visibleIds]);

  const toggleSelected = useCallback((id: string) => {
    setRawSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((ids: string[]) => {
    setRawSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(ids);
    });
  }, []);

  const clearSelection = useCallback(() => {
    setRawSelectedIds(new Set());
  }, []);

  const openDeleteRow = useCallback((email: CategorizedEmail) => {
    const id = email.message.id;
    if (!id) {
      return;
    }
    setDeleteTarget({ ids: [id], subject: email.message.subject ?? undefined });
  }, []);

  const openDeleteBulk = useCallback(() => {
    setDeleteTarget({ ids: [...selectedIds] });
  }, [selectedIds]);

  const closeDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  return {
    selectedEmail,
    isPanelOpen,
    openEmail,
    closePanel,
    resolveTarget,
    openResolve,
    closeResolve,
    selectedIds,
    selectedCount: selectedIds.size,
    toggleSelected,
    toggleSelectAll,
    clearSelection,
    deleteTarget,
    openDeleteRow,
    openDeleteBulk,
    closeDelete,
  };
}
