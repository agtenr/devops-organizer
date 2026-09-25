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
   * True once the initial load has **succeeded** — distinguishes "loaded, none saved" (`[]` + `true`)
   * from "not fetched yet, or the fetch failed" (`[]` + `false`). A one-time default-apply waits for
   * this instead of racing an empty initial array; every mutator also refuses to write until this is
   * `true`, so a transient load failure (network/auth/500 — as opposed to the "no file yet" 404,
   * which `fetchSavedViews` already turns into a successful empty array) can never let a save/rename/
   * delete overwrite the real stored file with an incomplete list.
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
 * hook). `fetchSavedViews` already treats a missing file (404) or malformed JSON as a non-fatal empty
 * array (see `savedViewsService.ts`); a **genuine** load failure (network/auth/server error) instead
 * leaves `loaded` at `false` forever this session, which blocks every mutator below — writing an
 * empty/incomplete array back would silently wipe the user's real stored views (review finding, PR
 * #60). Every successful mutation writes the whole array back (`saveSavedViews`) and updates state
 * from the result — write-then-reflect, the same shape as `resolveProjectGuid`.
 */
export function useSavedViews(): UseSavedViewsResult {
  const { accounts } = useMsal();
  const account = accounts[0];
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Latest views, read by the mutators so a write merges into current state (not a stale closure).
  // Updated directly wherever `savedViews` state is set (not via a reactive effect), so two mutations
  // fired in quick succession before a re-render each still see the other's result (review finding).
  const savedViewsRef = useRef<SavedView[]>(savedViews);

  useEffect(() => {
    if (!account) {
      return;
    }
    let cancelled = false;

    const client = createGraphClient(account);
    fetchSavedViews(client).then(
      (views) => {
        if (cancelled) {
          return;
        }
        savedViewsRef.current = views;
        setSavedViews(views);
        setLoaded(true);
      },
      () => {
        // A genuine load failure (not the 404/parse-error cases `fetchSavedViews` already resolves to
        // `[]`): leave `loaded` false so every mutator below refuses to write, rather than risk
        // overwriting the real stored file with an empty array.
      },
    );

    return () => {
      cancelled = true;
    };
  }, [account]);

  const persist = useCallback(
    async (next: SavedView[]) => {
      if (!account || !loaded) {
        throw new Error('Saved views have not finished loading yet — try again in a moment.');
      }
      const client = createGraphClient(account);
      await saveSavedViews(client, next);
      savedViewsRef.current = next;
      setSavedViews(next);
    },
    [account, loaded],
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
