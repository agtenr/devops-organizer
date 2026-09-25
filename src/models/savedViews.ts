/**
 * Saved filter views (story 126): a user-named snapshot of the whole filter combination
 * (`useOrganizer` owns all four fields — see `.claude/rules/frontend-architecture.md`), persisted to
 * the signed-in user's OneDrive app folder (`src/services/savedViews/savedViewsService.ts`) the same
 * way the project GUID map is (`.claude/rules/authentication.md` — reuses `Files.ReadWrite`, no new
 * scope).
 */

/** One saved filter combination. */
export interface SavedView {
  /** Stable identity (`crypto.randomUUID()`), independent of the user-editable `name`. */
  id: string;
  /** The user-chosen name; not required to be unique. */
  name: string;
  /** The selected customer tab value ({@link ALL_CUSTOMERS} or an organization name). */
  customer: string;
  /** The selected project facet value, or `null` when none is selected. */
  project: string | null;
  /** The selected type facet keys (a `typeKey` per entry; serialized array, not a `Set`, for JSON). */
  typeKeys: string[];
  /** The subject-search query. */
  searchQuery: string;
  /** True for the one view (at most) auto-applied the next time mail loads. */
  isDefault: boolean;
}
