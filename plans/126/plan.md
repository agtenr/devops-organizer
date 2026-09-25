# Plan — AB#126: Saved filter views

## Context

Recurring triage (e.g. "my customer's failed builds") means rebuilding the same customer tab +
sidebar facets + search text every session. This story lets a user **save** the current filter
combination under a name, **list** their saved views, **reapply** one with a click, **rename**/
**delete** one, mark **one as default** (auto-applied the next time mail loads), and have all of
this **persist across sessions**.

**Found:** the app already has an established pattern for exactly this kind of "small user data,
persisted per-account" need — the project GUID→name map (story 42,
`src/services/projectMap/projectMapService.ts`), a flat JSON file written to the signed-in user's
OneDrive **app folder** via Microsoft Graph, using the already-granted `Files.ReadWrite` scope. This
plan reuses that same pattern for saved views — **no new Graph scope is needed.**

*(dev-seeded: no extra steering given — proceed on the codebase read above; see the "decided in
planning" notes below for the choices confirmed live with the dev.)*

## Keep it simple

- **Non-goal: no new Graph scope, no scope-staging change.** `Files.ReadWrite` (already consented at
  sign-in for the project map) is reused as-is. `.claude/rules/authentication.md`'s Scope staging log
  is unchanged.
- **Non-goal: no `localStorage` cache for saved views.** Unlike the theme mode (`plans/125/plan.md`),
  saved views have no "first paint" flash to avoid — they only matter once mail has loaded and the
  sidebar renders, by which point the OneDrive fetch has had time to resolve alongside the mail fetch.
  OneDrive stays the single source of truth.
- **Non-goal: no ADO-side or server-side view sharing.** A saved view is per-signed-in-user, stored in
  that user's own OneDrive app folder, exactly like the project map. No sharing between users.
- **Non-goal: no confirm dialog for deleting a saved view** *(decided in planning with the dev)*. A
  saved view is a shortcut to filters the user could re-set manually — low stakes and easy to recreate,
  unlike deleting e-mails. One click removes it.
- **Non-goal: no generic "views API"/plugin system.** This adds exactly the CRUD + default-apply the
  ACs ask for; no extensibility beyond that.

## AC coverage

| AC | Status | Where |
|---|---|---|
| "Save current view" action saves the active filter combination under a chosen name | covered | Tasks 4, 6 |
| Saved views appear in a list; selecting one reapplies its filters | covered | Tasks 4, 6 |
| Rename and delete a saved view | covered | Tasks 4, 6 |
| Saved views persist across sessions (reload / re-sign-in) | covered | Tasks 1–3 |
| A saved view referencing a project that no longer resolves to a friendly name still applies without erroring | covered | see note under *Considerations* — no extra code needed, verified by a unit test in Task 4 |
| Mark one view as default, auto-applied the next time mail loads | covered | Task 5 |

## Implementation approach

Reuse the project-map pattern end-to-end: a new persisted JSON file, a thin Graph storage service, a
shared data hook, and UI wired into `Organizer`/`SidebarFilters`'s sibling.

**Storage.** A new OneDrive app-folder file, `saved-views.json`, holding a flat JSON array of saved
views (mirrors `project-guid-map.json`'s "whole-file write, last-write-wins" approach — the whole array
is written back on every add/rename/delete/default change). Fetched once per session; a missing file
(404) or unparsable content resolves to `[]`, exactly like the project map's non-fatal load.

**Filter-state ownership** *(decided in planning with the dev)*: the subject-search query moves from
being owned inside `useEmailList` up into `useOrganizer`, which already owns the customer tab and the
project/type facets. `useOrganizer` becomes the single owner of the whole filter combination a saved
view captures — `useEmailList` receives `searchQuery`/`setSearchQuery` as parameters instead of owning
its own `useState`.

**UI placement** *(decided in planning with the dev)*: a new, independent `SavedViews` component
renders in the sidebar next to `SidebarFilters` (not folded into `SidebarFilters` itself — its rows
need actions `SidebarFilters`'s `FilterOption` model doesn't have: apply / rename / delete / mark
default). It owns the "Save current view" button and the saved-views list.

**Default-view apply.** Applying the default view once "the next time mail loads" is done in a
one-time effect in `useOrganizer`, guarded by a ref so it only ever fires once per app session: it
fires when both `useCategorizedMail`'s `status` is `'success'` **and** the saved views have finished
their own (independent) load. This mirrors the existing accepted shape of `useCategorizedMail`'s own
load effect — a one-off reaction to async data becoming ready, not a render-loop state sync.

## Data contracts

**A. OneDrive app-folder file (Graph ↔ app).** File `saved-views.json` at
`/me/drive/special/approot:/saved-views.json:/content`. Body is a JSON array:
```jsonc
[
  {
    "id": "b3f1c2a0-...",           // crypto.randomUUID()
    "name": "Contoso failed builds",
    "customer": "Contoso",          // or the ALL_CUSTOMERS sentinel value
    "project": "Alpha",             // or null (no project selected)
    "typeKeys": ["Build::Failed"],  // serialized array (Set on the client side)
    "searchQuery": "",
    "isDefault": true
  }
]
```

**B. Types (`src/models/savedViews.ts`, new).**
```ts
export interface SavedView {
  id: string;
  name: string;
  customer: string;
  project: string | null;
  typeKeys: string[];
  searchQuery: string;
  isDefault: boolean;
}
```

**C. Storage service (`src/services/savedViews/savedViewsService.ts`, new).**
```ts
export function fetchSavedViews(client: Client): Promise<SavedView[]>;      // 404 / parse error -> []
export function saveSavedViews(client: Client, views: SavedView[]): Promise<void>; // whole-array PUT
```

**D. Data hook (`src/hooks/useSavedViews.ts`, new).**
```ts
export interface UseSavedViewsResult {
  savedViews: SavedView[];
  loaded: boolean; // true once the initial fetch has resolved (loaded-empty vs. not-yet-loaded)
  saveView: (name: string, filters: Omit<SavedView, 'id' | 'name' | 'isDefault'>) => Promise<void>;
  renameView: (id: string, name: string) => Promise<void>;
  deleteView: (id: string) => Promise<void>;
  setDefaultView: (id: string) => Promise<void>; // clears isDefault on every other view
}
```

No field is renamed across the boundary; the OneDrive file's JSON keys match `SavedView`'s field
names verbatim (same convention as the project map file).

## Task breakdown

1. **Model.** Add `src/models/savedViews.ts` with the `SavedView` type (contract B above).
   Rule: `.claude/rules/frontend-architecture.md` (models live in `src/models/`).

2. **Storage service.** Add `src/services/savedViews/savedViewsService.ts`
   (`fetchSavedViews`, `saveSavedViews`) against the app-folder file, mirroring
   `projectMapService.ts`'s 404/parse-failure → `[]` handling and its "coerce string-or-object Graph
   response" normalization. Unit-test with a fake `Client` (stub `.api().get()/.put()`), covering the
   404, malformed-JSON, and well-formed-array cases.
   Rules: `.claude/rules/authentication.md` (Graph only via an MSAL-acquired token; no new scope —
   reuses `Files.ReadWrite`), `.claude/rules/testing.md`.

3. **Data hook.** Add `src/hooks/useSavedViews.ts` (contract D). On mount (once `account` is
   available), fetch the file into `savedViews` state and set `loaded = true` regardless of success or
   the non-fatal failure path. `saveView`/`renameView`/`deleteView`/`setDefaultView` each build the
   next array in memory, call `saveSavedViews`, and update state from the result (write-then-reflect,
   same shape as `resolveProjectGuid` in `useCategorizedMail.ts`). `setDefaultView(id)` sets
   `isDefault: true` only on the matching view and `false` on every other. Unit-test each action
   (including that `setDefaultView` clears the previous default) with a fake Graph client.
   Rule: `.claude/rules/frontend-architecture.md` ("hoist reusable data hooks up front" — this is a
   shared, non-colocated data hook, so it lives in `src/hooks/`, not colocated with a component).

4. **Hoist search text into `useOrganizer`; wire saved-view actions.**
   File: `src/components/Organizer/useOrganizer.ts`.
   - Add `searchQuery`/`setSearchQuery` state here (moved out of `useEmailList` — see Task 6).
   - Call `useSavedViews()` and re-export `savedViews`, `saveCurrentView(name)`, `renameView`,
     `deleteView`, `setDefaultView`, `applyView(id)`.
   - `saveCurrentView(name)` calls `saveView(name, { customer: selectedCustomer, project:
     selectedProject, typeKeys: [...selectedTypeKeys], searchQuery, isDefault: false })`.
   - `applyView(id)` looks up the view in `savedViews` and sets `selectedCustomer`, `selectedProject`,
     `selectedTypeKeys` (`new Set(view.typeKeys)`), and `searchQuery` directly — it does **not** go
     through `selectCustomer` (whose side effect of clearing the facets on a tab change would fight a
     view that also sets a project/type). A saved view referencing a project string that no longer
     matches any current row (AC 5) just filters to an empty/narrower set — `filterByProject` is a
     plain string comparison, so this can never throw; add a unit test pinning it (no special-case code
     needed).
   - One-time default-apply effect: when `status === 'success'` and the saved-views hook's `loaded` is
     `true` (both conditions, either order), and a ref flag hasn't fired yet, find the view with
     `isDefault === true` and — if present — call the same apply logic as `applyView`, then set the
     ref so it never re-fires this session.
   Rules: `.claude/rules/frontend-architecture.md` ("state that outlives a transitional component
   lives in a permanent container" — `useOrganizer` is that container for the whole filter
   combination; "derived state is computed during render" — the default-apply is a one-off reaction to
   data becoming ready, not a per-render sync, so it does not trip `react-hooks/set-state-in-effect`),
   `.claude/rules/categorization-domain.md` (filtering stays in-memory over already-tagged data).

5. **Sidebar UI — new `SavedViews` component.**
   Files: `src/components/SavedViews/SavedViews.tsx` (new), `src/components/SavedViews/
   useSavedViewsPanel.ts` (new, UI-only: which dialog is open — save vs. rename — and its target;
   named to avoid colliding with the data hook `useSavedViews`, per the "differ by more than
   first-letter case" rule).
   - Renders a labelled section (matching `SidebarFilters`'s Fluent styling/tokens) with a "Save
     current view" button at the top and one row per saved view below: the name (click → `applyView`),
     a star-style toggle for "mark as default" (→ `setDefaultView`), a rename icon (opens the shared
     dialog below), and a delete icon (→ `deleteView`, no confirm — decided above).
   - Add `src/components/SaveViewDialog/SaveViewDialog.tsx` + `useSaveViewDialog.ts` (new): a small
     Fluent `Dialog` with a name text field, reused for both **create** (opened with an empty name,
     calls `saveCurrentView`) and **rename** (opened pre-filled with the current name, calls
     `renameView`) — mirrors `ResolveProjectDialog`'s Cancel/Save + spinner-while-saving shape.
   - Render `SavedViews` in `Organizer.tsx`, in the sidebar `<div>` alongside `SidebarFilters`.
   Rules: `.claude/rules/frontend-architecture.md` (own folder per component; logic in a colocated
   hook; Fluent v9 components/tokens; UI layout invariants — this sits in the existing left sidebar),
   `.claude/rules/testing.md` (render through the `FluentProvider`/`webLightTheme` wrapper).

6. **`useEmailList`/`EmailList` — accept search state as props.**
   Files: `src/components/EmailList/useEmailList.ts`, `src/components/EmailList/EmailList.tsx`.
   - Remove the internal `searchQuery` `useState`; `useEmailList` takes `searchQuery` as a parameter
     (alongside `emails`/`allEmails`) and keeps returning it unchanged for the `SearchBox` binding.
   - `EmailListProps` gains `searchQuery: string` / `setSearchQuery: (query: string) => void`, passed
     through to `useEmailList` and the `SearchBox`'s `value`/`onChange`.
   Rule: `.claude/rules/frontend-architecture.md` (a child renders success-only/controlled state; the
   owner — now `useOrganizer` — is the single owner of this cross-cutting filter state).

7. **Pass-through — `Organizer.tsx`.** Pass `searchQuery`/`setSearchQuery` into `EmailList`, and render
   `savedViews`/`saveCurrentView`/`renameView`/`deleteView`/`setDefaultView`/`applyView` into the new
   `SavedViews` component. Update `OrganizerData`/`useOrganizer.test.ts`/`Organizer.test.tsx`
   accordingly.
   Rule: `.claude/rules/frontend-architecture.md` (container owns data wiring).

8. **Keep the harness mock in lockstep.** File: `src/harness.tsx`. `useOrganizer`'s return shape grows
   (`searchQuery`, `setSearchQuery`, `savedViews`, `saveCurrentView`, `renameView`, `deleteView`,
   `setDefaultView`, `applyView`) — seed all of them on `mockData` in this same change, or the harness
   build breaks (per `.claude/rules/testing.md`'s same-change reminder). Add a `?state=` seed with a
   couple of saved views (one marked default) so the new UI is screenshot-able.
   Rule: `.claude/rules/testing.md`.

9. **Screenshots + verify done.** Capture at least one Playwright screenshot of the sidebar with the
   new "Saved views" section (via the harness, per `.claude/rules/testing.md`), save to
   `e2e/screenshots/126/`, and reference it from the code PR description. Then
   `npm run build`, `npm run lint`, `npm run format:check`, `npm run test` all clean.
   Rules: `.claude/rules/testing.md`, `.claude/rules/frontend-architecture.md` ("what done looks
   like").

## Assumptions & open questions

None remaining — the three genuine either/or choices (search-state ownership, UI placement, delete
confirmation) were resolved live with the dev during planning; see the "decided in planning with the
dev" notes above for each.

## Considerations

- **AC 5 (unresolved-GUID-style project mismatch) needs no special-case code.** Applying a saved view
  just sets `selectedProject` to whatever string was saved; `filterByProject` (`facetFilters.ts`) is a
  plain equality filter, so a project value that no longer matches anything in the current categorized
  set simply yields an empty/narrower filtered list — it can never throw. The unit test in Task 4 pins
  this so the behavior stays intentional, not accidental.
- **Two saved views with the same name are allowed.** Names are not required to be unique (the AC
  doesn't ask for it); each view is identified internally by its `id`, so a duplicate name is a
  cosmetic, not a functional, issue.
- **Concurrency (last-write-wins), same as the project map.** Saving/renaming/deleting rewrites the
  whole `saved-views.json` from the last-loaded array. Two tabs editing views around the same time
  could clobber each other's newest change — acceptable for a single-user tool, matching the accepted
  risk already documented for the project map (`plans/42/plan.md`).
- **jsdom can't verify the sidebar layout/interaction.** Per `.claude/rules/testing.md`, the new
  section's rendering, rows, and dialog are interactive/visual; jsdom component tests assert
  DOM/state/wiring, and the real look is verified by the Task 9 screenshot plus a manual live check.

## Testing recommendations

The project uses Vitest for unit tests and Playwright for E2E/screenshots (`.claude/rules/testing.md`).

- **Altitude:** unit tests for the storage service (mocked client), the `useSavedViews` data hook
  (`renderHook`), the hoisted search-state + saved-view actions in `useOrganizer`, and component tests
  for `SavedViews`/`SaveViewDialog` through the `FluentProvider`/`webLightTheme` wrapper.
- **Must-cover list:**
  - `fetchSavedViews`: 404 → `[]` (not a throw); malformed JSON → `[]`; well-formed array → parsed as
    given.
  - `saveSavedViews`/`useSavedViews` actions: `saveView` appends a new view with a generated `id`;
    `renameView` changes only the `name`; `deleteView` removes only the targeted `id`; `setDefaultView`
    sets `isDefault` on exactly one view, clearing every other.
  - `useOrganizer`: `applyView` sets customer/project/typeKeys/searchQuery to the view's values in one
    step (not through `selectCustomer`'s facet-clearing path); the one-time default-apply effect fires
    exactly once, only after both mail and saved views have loaded, and does nothing when no view is
    marked default.
  - `applyView`/filtering with a saved `project` value that matches no current row → filtered list is
    empty, no error thrown (AC 5, see *Considerations*).
  - `SavedViews` component: "Save current view" opens the dialog; saving calls `saveCurrentView` with
    the entered name; clicking a row calls `applyView`; the rename icon opens the dialog pre-filled;
    the delete icon calls `deleteView` with no confirm dialog rendered.
- **Live verification:** add to Definition of done — after implementing, sign in, save a view, reload
  the browser, and confirm the saved view (and the default-apply behavior, if one is marked default)
  survives the reload against the real OneDrive app folder.

## Definition of done

- [ ] "Save current view" saves the active customer/project/type/search combination under a
      user-chosen name (AC 1).
- [ ] Saved views appear in a list; selecting one reapplies its filters (AC 2).
- [ ] A saved view can be renamed and deleted (AC 3).
- [ ] Saved views persist across a reload/re-sign-in via the OneDrive app-folder file (AC 4) —
      verified live (manual, per Live verification above).
- [ ] Applying a saved view whose project no longer matches any current row does not error (AC 5;
      unit-tested, see *Considerations*).
- [ ] Exactly one saved view can be marked default; it is auto-applied once, the next time mail loads
      (AC 6).
- [ ] No new Graph scope was added; `Files.ReadWrite` is reused as-is
      (`.claude/rules/authentication.md`).
- [ ] `src/harness.tsx`'s mock `OrganizerData` includes every new field so the harness build and
      screenshot/E2E seam keep working (`.claude/rules/testing.md`).
- [ ] At least one Playwright screenshot of the new sidebar section is committed under
      `e2e/screenshots/126/` and referenced from the code PR.
- [ ] New/updated unit + component tests pass; full `npm run test` is green.
- [ ] Type-checks and builds cleanly (`npm run build`); no ESLint errors; Prettier-clean
      (`npm run lint`, `npm run format:check`).

## Files/areas affected

- `src/models/savedViews.ts` — **new**.
- `src/services/savedViews/savedViewsService.ts` — **new**.
- `src/services/savedViews/savedViewsService.test.ts` — **new**.
- `src/hooks/useSavedViews.ts` — **new**.
- `src/hooks/useSavedViews.test.ts` — **new**.
- `src/components/Organizer/useOrganizer.ts` — **edit** (hoisted search state, saved-view actions,
  default-apply effect).
- `src/components/Organizer/useOrganizer.test.ts` — **edit**.
- `src/components/Organizer/Organizer.tsx` — **edit** (pass-through + render `SavedViews`).
- `src/components/Organizer/Organizer.test.tsx` — **edit**.
- `src/components/EmailList/useEmailList.ts` — **edit** (`searchQuery` becomes a parameter).
- `src/components/EmailList/EmailList.tsx` — **edit** (`searchQuery`/`setSearchQuery` props).
- `src/components/EmailList/useEmailList.test.ts`, `EmailList.test.tsx` — **edit**.
- `src/components/SavedViews/SavedViews.tsx` — **new**.
- `src/components/SavedViews/useSavedViewsPanel.ts` — **new**.
- `src/components/SavedViews/SavedViews.test.tsx`, `useSavedViewsPanel.test.ts` — **new**.
- `src/components/SaveViewDialog/SaveViewDialog.tsx` — **new**.
- `src/components/SaveViewDialog/useSaveViewDialog.ts` — **new**.
- `src/components/SaveViewDialog/SaveViewDialog.test.tsx`, `useSaveViewDialog.test.ts` — **new**.
- `src/harness.tsx` — **edit** (seed new mock fields + a saved-views state seed).
- `e2e/screenshots/126/` — **new** (committed screenshot).
