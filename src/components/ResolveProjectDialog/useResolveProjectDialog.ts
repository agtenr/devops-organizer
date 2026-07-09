import { useCallback, useState } from 'react';

/**
 * Logic for `ResolveProjectDialog` (see `.claude/rules/frontend-architecture.md` — logic lives in a
 * colocated hook, not JSX). Owns the picker value, the saving flag, and any save error. `save` awaits
 * the injected persistence action; on success the dialog closes (via `onCancel`), on failure it stays
 * open showing the error (the ratified failure behavior — `plans/42/plan.md`).
 */

export interface UseResolveProjectDialogArgs {
  /** The GUID being resolved (the row's project). */
  guid: string;
  /** Persists the mapping; rejects on failure. */
  onResolve: (guid: string, name: string) => Promise<void>;
  /** Closes/dismisses the dialog. */
  onCancel: () => void;
}

export interface UseResolveProjectDialogResult {
  /** The current picker value (a selected known name or free text). */
  value: string;
  /** Update the picker value. */
  setValue: (value: string) => void;
  /** True while the save is in flight (drives the spinner). */
  saving: boolean;
  /** A save-failure message, or '' when there is none. */
  error: string;
  /** Whether Save is allowed (non-empty value and not already saving). */
  canSave: boolean;
  /** Persist the mapping for the trimmed value; no-op when `canSave` is false. */
  save: () => Promise<void>;
}

export function useResolveProjectDialog({
  guid,
  onResolve,
  onCancel,
}: UseResolveProjectDialogArgs): UseResolveProjectDialogResult {
  const [value, setValue] = useState('');
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
      await onResolve(guid, name);
      // Success: the parent unmounts the dialog via onCancel, so no need to reset `saving`.
      onCancel();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }, [value, saving, onResolve, guid, onCancel]);

  return { value, setValue, saving, error, canSave, save };
}
