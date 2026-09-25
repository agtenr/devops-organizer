import { useCallback, useEffect, useRef, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { createGraphClient } from '../services/graph/graphClient';
import { fetchSavedViews, saveSavedViews } from '../services/savedViews/savedViewsService';
import type { SavedView } from '../models/savedViews';

/** A saved view's filter fields, without the identity/name/default fields `saveView` assigns. */
export type SavedViewFilters = Omit<SavedView, 'id' | 'name' | 'isDefault'>;

export interface UseSavedViewsResult {
  /** The signed-in user's saved views. */
  savedViews: SavedView[];
  /**
   * True once the initial load has settled (successfully or via the non-fatal empty fallback) —
   * distinguishes "loaded, none saved" (`[]` + `true`) from "not fetched yet" (`[]` + `false`), so a
   * one-time default-apply can wait for the real load instead of racing an empty initial array.
   */
  loaded: boolean;
  /** Saves the current filters as a new named view. Rejects on failure. */
  saveView: (name: string, filters: SavedViewFilters) => Promise<void>;
  /** Renames an existing view. Rejects on failure. */
  renameView: (id: string, name: string) => Promise<void>;
  /** Deletes a view. Rejects on failure. */
  deleteView: (id: string) => Promise<void>;
  /** Marks the given view as the (sole) default, clearing `isDefault` on every other. Rejects on failure. */
  setDefaultView: (id: string) => Promise<void>;
}

/**
 * Shared data hook for saved filter views (story 126). Mirrors the project-map load/save shape in
 * `useCategorizedMail.ts`: on mount it loads the persisted array from the user's OneDrive app folder
 * (`.claude/rules/frontend-architecture.md` — hoisted here since it is a reusable, non-colocated data
 * hook); a load failure is non-fatal and leaves `savedViews` empty. Every mutation writes the whole
 * array back (`saveSavedViews`) and updates state from the result — write-then-reflect, the same shape
 * as `resolveProjectGuid`.
 */
export function useSavedViews(): UseSavedViewsResult {
  const { accounts } = useMsal();
  const account = accounts[0];
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Latest views, read by the mutators so a write merges into current state (not a stale closure).
  const savedViewsRef = useRef<SavedView[]>(savedViews);
  useEffect(() => {
    savedViewsRef.current = savedViews;
  }, [savedViews]);

  useEffect(() => {
    if (!account) {
      return;
    }
    let cancelled = false;

    const client = createGraphClient(account);
    fetchSavedViews(client)
      .catch(() => [] as SavedView[])
      .then((views) => {
        if (cancelled) {
          return;
        }
        setSavedViews(views);
        setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [account]);

  const persist = useCallback(
    async (next: SavedView[]) => {
      if (!account) {
        return;
      }
      const client = createGraphClient(account);
      await saveSavedViews(client, next);
      setSavedViews(next);
    },
    [account],
  );

  const saveView = useCallback(
    async (name: string, filters: SavedViewFilters) => {
      const view: SavedView = { id: crypto.randomUUID(), name, isDefault: false, ...filters };
      await persist([...savedViewsRef.current, view]);
    },
    [persist],
  );

  const renameView = useCallback(
    async (id: string, name: string) => {
      const next = savedViewsRef.current.map((view) => (view.id === id ? { ...view, name } : view));
      await persist(next);
    },
    [persist],
  );

  const deleteView = useCallback(
    async (id: string) => {
      const next = savedViewsRef.current.filter((view) => view.id !== id);
      await persist(next);
    },
    [persist],
  );

  const setDefaultView = useCallback(
    async (id: string) => {
      const next = savedViewsRef.current.map((view) => ({ ...view, isDefault: view.id === id }));
      await persist(next);
    },
    [persist],
  );

  return { savedViews, loaded, saveView, renameView, deleteView, setDefaultView };
}
