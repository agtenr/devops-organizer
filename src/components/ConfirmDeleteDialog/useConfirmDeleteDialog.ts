import { useCallback, useState } from 'react';

/**
 * Logic for `ConfirmDeleteDialog` (see `.claude/rules/frontend-architecture.md` — logic lives in a
 * colocated hook, not JSX). Owns the in-flight `deleting` flag and any delete error. `confirm` awaits
 * the injected delete action; on success the dialog closes (via `onCancel`), on failure it stays open
 * showing the error. Mirrors `useResolveProjectDialog` (story 42) — the ratified failure behavior.
 */

export interface UseConfirmDeleteDialogArgs {
  /** Performs the delete (and any caller cleanup); rejects on failure. */
  onConfirm: () => Promise<void>;
  /** Closes/dismisses the dialog. */
  onCancel: () => void;
}

export interface UseConfirmDeleteDialogResult {
  /** True while the delete is in flight (drives the spinner and disables the buttons). */
  deleting: boolean;
  /** A delete-failure message, or '' when there is none. */
  error: string;
  /** Run the delete; no-op while one is already in flight. */
  confirm: () => Promise<void>;
}

export function useConfirmDeleteDialog({
  onConfirm,
  onCancel,
}: UseConfirmDeleteDialogArgs): UseConfirmDeleteDialogResult {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const confirm = useCallback(async () => {
    if (deleting) {
      return;
    }
    setDeleting(true);
    setError('');
    try {
      await onConfirm();
      // Success: the parent unmounts the dialog via onCancel, so no need to reset `deleting`.
      onCancel();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  }, [deleting, onConfirm, onCancel]);

  return { deleting, error, confirm };
}
