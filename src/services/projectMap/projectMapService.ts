import type { Client } from '@microsoft/microsoft-graph-client';
import type { ProjectGuidMap } from '../../models/categorization';

/**
 * Persistence for the project GUID→friendly-name mapping (story 42).
 *
 * The map is a small JSON file in the signed-in user's OneDrive **app folder** (`approot`), read on
 * app load and rewritten whole on each save. Least-privilege delegated access is via the
 * `Files.ReadWrite` scope (see `.claude/rules/authentication.md`); the AppFolder-only scope the story
 * named is unsupported for the organizational accounts this app signs in with, so the broader scope is
 * used while the storage location stays the dedicated app folder. This module only does the Graph I/O —
 * it returns plain data; the categorization engine consumes the map purely.
 */

// The map lives in the app's own OneDrive folder (`Apps/<app>/`). `approot` is case sensitive.
const MAP_ITEM_PATH = '/me/drive/special/approot:/project-guid-map.json:/content';

/** True for a Graph "item not found" (the map file has not been created yet). */
function isNotFound(error: unknown): boolean {
  return (error as { statusCode?: number } | null)?.statusCode === 404;
}

/**
 * Coerces the raw file body into a `ProjectGuidMap`. The Graph client may hand back the JSON file as an
 * already-parsed object or as a string; both are normalised, GUID keys are lowercased for
 * case-insensitive lookup, and non-string values are dropped. Any malformed content yields an empty map.
 */
function normalizeMap(content: unknown): ProjectGuidMap {
  let parsed: unknown = content;
  if (typeof content === 'string') {
    try {
      parsed = JSON.parse(content);
    } catch {
      return {};
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    return {};
  }
  const map: ProjectGuidMap = {};
  for (const [guid, name] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof name === 'string') {
      map[guid.toLowerCase()] = name;
    }
  }
  return map;
}

/**
 * Reads the persisted GUID→name map from the app folder. A missing file (404, not created yet) or any
 * malformed content resolves to an **empty map** — "if no mapping file is found, nothing changes"
 * (story 42). Other Graph errors propagate to the caller, which decides whether they are fatal.
 */
export async function fetchProjectMap(client: Client): Promise<ProjectGuidMap> {
  try {
    const content: unknown = await client.api(MAP_ITEM_PATH).get();
    return normalizeMap(content);
  } catch (error) {
    if (isNotFound(error)) {
      return {};
    }
    throw error;
  }
}

/**
 * Merges one `guid → name` resolution into the current map and writes the whole file back (creating the
 * app folder on first write). The GUID key is lowercased and the name trimmed to match the read path.
 * Returns the merged map so the caller can update in-memory state without a re-fetch.
 */
export async function saveProjectMapping(
  client: Client,
  current: ProjectGuidMap,
  guid: string,
  name: string,
): Promise<ProjectGuidMap> {
  const next: ProjectGuidMap = { ...current, [guid.toLowerCase()]: name.trim() };
  await client
    .api(MAP_ITEM_PATH)
    .header('Content-Type', 'application/json')
    .put(JSON.stringify(next));
  return next;
}
