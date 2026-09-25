import { useCallback, useState } from 'react';

/**
 * UI-only logic for `SavedViews` (story 126): which name dialog is open (create vs. rename) and, for
 * a rename, which view it targets. Named `useSavedViewsPanel` — not `useSavedViews` — so it does not
 * collide with the shared data hook `src/hooks/useSavedViews.ts` on a case-insensitive filesystem
 * (`.claude/rules/frontend-architecture.md` — a colocated helper/hook name must differ from a sibling
 * by more than case). All persistence lives in that data hook; this only tracks dialog visibility.
 */

export type SaveViewDialogTarget =
  { kind: 'create' } | { kind: 'rename'; id: string; initialName: string };

export interface UseSavedViewsPanelResult {
  /** The open dialog's target, or `null` when no dialog is open. */
  dialogTarget: SaveViewDialogTarget | null;
  /** Opens the "Save current view" (create) dialog. */
  openCreateDialog: () => void;
  /** Opens the rename dialog for the given view, prefilled with its current name. */
  openRenameDialog: (id: string, currentName: string) => void;
  /** Closes whichever dialog is open. */
  closeDialog: () => void;
}

export function useSavedViewsPanel(): UseSavedViewsPanelResult {
  const [dialogTarget, setDialogTarget] = useState<SaveViewDialogTarget | null>(null);

  const openCreateDialog = useCallback(() => setDialogTarget({ kind: 'create' }), []);
  const openRenameDialog = useCallback(
    (id: string, currentName: string) =>
      setDialogTarget({ kind: 'rename', id, initialName: currentName }),
    [],
  );
  const closeDialog = useCallback(() => setDialogTarget(null), []);

  return { dialogTarget, openCreateDialog, openRenameDialog, closeDialog };
}
