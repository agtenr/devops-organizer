import type { Client } from '@microsoft/microsoft-graph-client';

/**
 * Persistence for the user's theme preference (story 87).
 *
 * The preference is a small JSON file in the signed-in user's OneDrive **app folder** (`approot`),
 * read on app load and rewritten whole on each toggle. Reuses the `Files.ReadWrite` Graph scope
 * that persists the project GUID map (see `.claude/rules/authentication.md`).
 * Shape: `{ "theme": "light" | "dark" }`. A 404 (first use) resolves to `'light'`.
 */

const THEME_FILE_PATH = '/me/drive/special/approot:/theme-preference.json:/content';

export type ThemeMode = 'light' | 'dark';

interface ThemePayload {
  theme: ThemeMode;
}

/** True for a Graph "item not found" (the file has not been created yet). */
function isNotFound(error: unknown): boolean {
  return (error as { statusCode?: number } | null)?.statusCode === 404;
}

/**
 * Coerces the raw file body into a `ThemeMode`. The Graph client may hand back the JSON file as an
 * already-parsed object or as a string; both are normalised. Any malformed content yields `'light'`
 * (graceful degradation — the default).
 */
function normalizeTheme(content: unknown): ThemeMode {
  let parsed: unknown = content;
  if (typeof content === 'string') {
    try {
      parsed = JSON.parse(content);
    } catch {
      return 'light';
    }
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const payload = parsed as Record<string, unknown>;
    if (payload.theme === 'light' || payload.theme === 'dark') {
      return payload.theme as ThemeMode;
    }
  }
  return 'light';
}

/**
 * Reads the persisted theme preference from the app folder. A missing file (404, not created yet)
 * or any malformed content resolves to **`'light'`** — the default theme. Other Graph errors
 * propagate to the caller, which decides whether they are fatal.
 */
export async function fetchThemePreference(client: Client): Promise<ThemeMode> {
  try {
    const content: unknown = await client.api(THEME_FILE_PATH).get();
    return normalizeTheme(content);
  } catch (error) {
    if (isNotFound(error)) {
      return 'light';
    }
    throw error;
  }
}

/**
 * Saves the user's theme preference to the app folder (creating the file on first write).
 * The payload is `{ "theme": "light" | "dark" }`.
 */
export async function saveThemePreference(client: Client, theme: ThemeMode): Promise<void> {
  const payload: ThemePayload = { theme };
  await client
    .api(THEME_FILE_PATH)
    .header('Content-Type', 'application/json')
    .put(JSON.stringify(payload));
}
