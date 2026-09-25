import type { Client } from '@microsoft/microsoft-graph-client';
import type { SavedView } from '../../models/savedViews';

/**
 * Persistence for saved filter views (story 126).
 *
 * Mirrors `projectMapService.ts` (story 42): a small JSON file in the signed-in user's OneDrive
 * **app folder** (`approot`), read on app load and rewritten whole on every change. Reuses the
 * existing `Files.ReadWrite` scope (see `.claude/rules/authentication.md`) — no new scope is added.
 * This module only does the Graph I/O; it returns/accepts plain data.
 */

// The file lives in the app's own OneDrive folder (`Apps/<app>/`), alongside `project-guid-map.json`.
const SAVED_VIEWS_ITEM_PATH = '/me/drive/special/approot:/saved-views.json:/content';

/** True for a Graph "item not found" (the file has not been created yet). */
function isNotFound(error: unknown): boolean {
  return (error as { statusCode?: number } | null)?.statusCode === 404;
}

/**
 * Coerces the raw file body into a `SavedView[]`. The Graph client may hand back the JSON file as an
 * already-parsed value or as a string; both are normalised. Anything that isn't an array of
 * plausible saved-view objects yields an empty array (never blocks mail from loading).
 */
function normalizeSavedViews(content: unknown): SavedView[] {
  let parsed: unknown = content;
  if (typeof content === 'string') {
    try {
      parsed = JSON.parse(content);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter((entry): entry is SavedView => {
    return (
      !!entry &&
      typeof entry === 'object' &&
      typeof (entry as SavedView).id === 'string' &&
      typeof (entry as SavedView).name === 'string' &&
      typeof (entry as SavedView).customer === 'string' &&
      ((entry as SavedView).project === null || typeof (entry as SavedView).project === 'string') &&
      Array.isArray((entry as SavedView).typeKeys) &&
      typeof (entry as SavedView).searchQuery === 'string' &&
      typeof (entry as SavedView).isDefault === 'boolean'
    );
  });
}

/**
 * Reads the persisted saved views from the app folder. A missing file (404, not created yet) or any
 * malformed content resolves to an **empty array** — "if no file is found, nothing changes" (matches
 * the project map's non-fatal load). Other Graph errors propagate to the caller.
 */
export async function fetchSavedViews(client: Client): Promise<SavedView[]> {
  try {
    const content: unknown = await client.api(SAVED_VIEWS_ITEM_PATH).get();
    return normalizeSavedViews(content);
  } catch (error) {
    if (isNotFound(error)) {
      return [];
    }
    throw error;
  }
}

/**
 * Writes the whole saved-views array back (creating the app folder on first write) — a "whole-file
 * write, last-write-wins" store, same as the project map.
 */
export async function saveSavedViews(client: Client, views: SavedView[]): Promise<void> {
  await client
    .api(SAVED_VIEWS_ITEM_PATH)
    .header('Content-Type', 'application/json')
    .put(JSON.stringify(views));
}
