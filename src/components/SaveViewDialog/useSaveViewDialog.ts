import { useCallback, useState } from 'react';

/**
 * Logic for `SaveViewDialog` (see `.claude/rules/frontend-architecture.md` — logic lives in a
 * colocated hook, not JSX). Owns the name field, the in-flight `saving` flag, and any save error.
 * `save` awaits the injected persistence action; on success the dialog closes (via `onCancel`), on
 * failure it stays open showing the error — mirrors `useResolveProjectDialog` (story 42). Reused for
 * both **create** (`initialName: ''`) and **rename** (`initialName` prefilled) by `SavedViews`
 * (story 126).
 */

export interface UseSaveViewDialogArgs {
  /** The name field's starting value ('' for a new view, the current name for a rename). */
  initialName: string;
  /** Persists the name (create or rename, chosen by the caller); rejects on failure. */
  onSave: (name: string) => Promise<void>;
  /** Closes/dismisses the dialog. */
  onCancel: () => void;
}

export interface UseSaveViewDialogResult {
  /** The current name field value. */
  value: string;
  /** Update the name field value. */
  setValue: (value: string) => void;
  /** True while the save is in flight (drives the spinner). */
  saving: boolean;
  /** A save-failure message, or '' when there is none. */
  error: string;
  /** Whether Save is allowed (non-empty value and not already saving). */
  canSave: boolean;
  /** Persist the trimmed name; no-op when `canSave` is false. */
  save: () => Promise<void>;
}

export function useSaveViewDialog({
  initialName,
  onSave,
  onCancel,
}: UseSaveViewDialogArgs): UseSaveViewDialogResult {
  const [value, setValue] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSave = value.trim() !== '' && !saving;

  const save = useCallback(async () => {
    const name = value.trim();
    if (name === '' || saving) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(name);
      // Success: the parent unmounts the dialog via onCancel, so no need to reset `saving`.
      onCancel();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }, [value, saving, onSave, onCancel]);

  return { value, setValue, saving, error, canSave, save };
}
