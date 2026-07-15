# Plan — Story 56: E-mail search box

## Context
The app makes a daily flood of Azure DevOps notification e-mails triageable by tagging each with a
`(Customer, Project, Type)` triple and filtering the in-memory list by the customer tabs and the
project/type sidebar facets. Story 56 adds a **fast, free-text way to find an e-mail by its
subject** on top of that categorization filtering: a search box above the e-mail view, on the same
row (height) as the bulk-delete button. Typing narrows the list live to e-mails whose **subject
contains** the typed string; it is pure in-memory substring filtering over the already-tagged set,
so **no debounce** is needed (per the story).

Intended outcome: a user who knows a word from a subject can jump to that e-mail without hunting
through tabs/facets, and clear the box to return to the current tab/facet view.

## Keep it simple
The search is a **view-local filter on the center list**, layered *downstream* of the existing
`(org ∩ project ∩ types)` composition — it does not become a fourth dimension in `useOrganizer`.
That keeps the categorization/facet machinery untouched and puts the box exactly where the AC wants
it (in `EmailList`'s toolbar, next to Delete). Explicit non-goals (each fences off **unrequested**
scope only):

- **No debounce / async.** The story explicitly says none is needed — it is synchronous in-memory
  filtering. No timers, no request cancellation.
- **Search subject only.** Not body, organization, project, type, or date — the AC says "by
  subject". No multi-field or "search everything" box.
- **No match highlighting, fuzzy/regex matching, or ranking.** Plain case-insensitive substring
  containment; rows keep their existing date order.
- **No query persistence** (URL param, storage) and **no new component/folder** — the box lives in
  the existing `EmailList` toolbar. No new Graph scope, no auth change (front-end, in-memory only).
- **Facet/tab counters are not re-scoped by the search** (ratified decision D1).

## AC coverage
The story carries one acceptance criterion; its description adds concrete requirements, mapped here
too so none is dropped.

| AC / requirement | Status | Where |
|---|---|---|
| Find e-mails by subject via a search box above the e-mail view | covered | Tasks 2–3 (SearchBox in `EmailList` toolbar) |
| Search box on the same height/row as the Delete button | covered | Task 3 (toolbar layout) + Task 5 (E2E) |
| Typing filters the list: show all e-mails whose **subject contains** the string | covered | Tasks 1–2 (`filterBySubject` + wiring) |
| No debounce (in-memory filtering) | covered | Task 2 (controlled state, synchronous derive) |
| Search narrows only the displayed list, not tab/facet counters | narrowed (ratified) | Decision D1 — reviewer chose A on PR #42 |
| Case-insensitive matching | narrowed (ratified) | Decision D2 — reviewer chose A on PR #42 |

## Implementation approach
Add the search as a concern of the **`EmailList` component** (the toolbar that already owns the
bulk-delete button), split per `frontend-architecture.md` into (a) a **pure, React-free matcher**
in its own colocated file and (b) **query state in the existing colocated hook** `useEmailList`:

- **`src/components/EmailList/emailSearch.ts`** *(new, pure helper)* — `filterBySubject(emails,
  query)`: trims the query; returns the input array **unchanged (same reference)** when the trimmed
  query is empty; otherwise returns the emails whose `message.subject` (treated as `''` when
  null/undefined) **contains** the query, compared **case-insensitively**. Mirrors the existing
  `emailFormatters.ts` / `facetFilters.ts` "pure derivation in its own file" pattern.
- **`src/components/EmailList/useEmailList.ts`** — own the query state (`useState('')`) and derive
  the searched subset **during render** via `useMemo(() => filterBySubject(emails, searchQuery),
  [emails, searchQuery])` (no `setState`-in-effect — `react-hooks/set-state-in-effect`). Use this
  searched subset as the internal "visible" set everywhere `emails` is used today (the
  `openEmail` lookup and the `visibleIds` that scope selection/select-all), so bulk-delete and
  select-all naturally operate on **what the user currently sees**. Expose `visibleEmails`,
  `searchQuery`, and `setSearchQuery`.
- **`src/components/EmailList/EmailList.tsx`** — render a Fluent v9 **`SearchBox`** (controlled:
  `value={searchQuery}`, `onChange={(_, data) => setSearchQuery(data.value)}`, so its built-in clear
  button also flows through), left-aligned in the toolbar with the Delete button pushed to the
  right. Render the `DataGrid` over `visibleEmails`; keep the toolbar visible whenever the
  pre-search `emails` set is non-empty so a zero-match search still shows the box (and a short "no
  match" message) instead of trapping the user.

`Organizer`/`useOrganizer` and the categorization service are **not touched** — the search sits
entirely inside `EmailList`.

## Task breakdown
Ordered so the pure matcher (consumed by the hook) lands before its consumers.

1. **Pure subject matcher + unit test.**
   *Files:* `src/components/EmailList/emailSearch.ts` (new), `src/components/EmailList/emailSearch.test.ts` (new).
   Implement `filterBySubject(emails: CategorizedEmail[], query: string): CategorizedEmail[]`:
   trim `query`; empty → return `emails` unchanged; else `subject.toLowerCase().includes(trimmed.toLowerCase())`
   over `email.message.subject ?? ''`. Pin the behavior with tests (see Testing recommendations).
   *Rules:* `frontend-architecture.md` (pure React-free helper in its own colocated file, **not** the
   `use*` hook, **not** `src/services/`); `testing.md` (the pure logic is unit-tested directly);
   `categorization-domain.md` (a text filter over the already-tagged in-memory set — tags are
   consumed verbatim, never re-derived).

2. **Query state + searched subset in `useEmailList`.**
   *File:* `src/components/EmailList/useEmailList.ts`.
   Add `searchQuery`/`setSearchQuery` state and a `visibleEmails = useMemo(filterBySubject(emails,
   searchQuery), …)`; switch the internal `openEmail` lookup and `visibleIds` derivation to
   `visibleEmails`; add `visibleEmails`, `searchQuery`, `setSearchQuery` to `UseEmailListResult` and
   the returned object (with doc comments). Selection stays pruned to visible rows (existing
   invariant) — now "visible" = the searched subset.
   *Rules:* `frontend-architecture.md` (stateful logic in the hook; derived state computed during
   render via `useMemo`, never synced with `useEffect` + `setState`).

3. **SearchBox in the `EmailList` toolbar + zero-match handling.**
   *File:* `src/components/EmailList/EmailList.tsx`.
   Import `SearchBox` from `@fluentui/react-components`; destructure the new hook values. Render a
   controlled `SearchBox` (`placeholder="Search by subject"`, `aria-label="Search e-mails by
   subject"`) in the `toolbar`, and change the toolbar style from `justifyContent: 'flex-end'` to
   `space-between` with `alignItems: 'center'` so the box and Delete share one row/height. Render the
   `DataGrid` `items={visibleEmails}` and compute `visibleIds` from `visibleEmails`. Restructure the
   empty branch so the toolbar renders whenever pre-search `emails.length > 0`, and show a short
   "No e-mails match your search." message (styled like the existing `empty` text) when
   `visibleEmails.length === 0`.
   *Rules:* `frontend-architecture.md` (Fluent v9 components + tokens; rendering only — logic stays
   in the hook); `frontend-architecture.md` UI-layout invariants (search sits in the list view's
   toolbar, above the list).

4. **Component tests for the search behavior.**
   *File:* `src/components/EmailList/EmailList.test.tsx`.
   Add a `describe('EmailList — subject search')` block (rendered through the existing
   `FluentProvider` wrapper): typing filters visible rows; clearing restores; a zero-match query
   keeps the search box + Delete present and shows the "no match" message; select-all/bulk-delete
   scope to the matched subset. Note in a comment that the *visual* "same height as Delete"
   acceptance is covered by the E2E (jsdom has no layout engine).
   *Rules:* `testing.md` (component tests mount through the app's `FluentProvider`; prefer pure-logic
   tests for the matcher, done in Task 1).

5. **E2E: search box in the toolbar + live filtering (visual/interactive acceptance).**
   *File:* `e2e/harness.spec.ts`.
   Add tests driving `/harness.html` (the existing mock-data seam — no code change needed to the
   harness; its rows have distinct subjects like "Build failed on main…", "PR review requested",
   "Filler notification N"): (a) the search box is visible and vertically aligned with the Delete
   button (their bounding boxes overlap on the Y axis / share a row); (b) typing a subject fragment
   reduces the rendered rows to the matching ones; (c) clearing the box restores the full list.
   *Rules:* `testing.md` (visual/layout/interactive acceptance verified in a real browser — jsdom
   cannot see layout or that the box is on the same height as Delete); `frontend-architecture.md`
   (UI-layout invariants exercised in the real shell).

## Assumptions & open questions
All open questions were ratified by the reviewer on PR #42 (each answered **A** — the recommended
option). No open questions remain; the decisions below are settled and baked into the plan above.

- **D1 — Search scope vs. counters (ratified A).** Search filters **the center list only**, applied
  **downstream** of the tab/facet composition — the customer-tab and sidebar project/type counters
  keep reflecting categorization availability and do **not** move as you type. (Rejected: moving the
  filter up into `useOrganizer` as a fourth dimension.)
- **D2 — Case sensitivity (ratified A).** Subject matching is **case-insensitive** (typing `build`
  matches "Build failed").
- **D3 — Search box when the current tab/facet combo is empty (ratified A).** When the selected
  tab/facets yield **zero** e-mails (pre-search) there is nothing to search, so the toolbar (and
  search box) stays hidden and only the existing "No e-mails to show." message renders; the box
  appears as soon as the combo has at least one e-mail.

## Considerations
- **Selection interaction (FYI).** Because "visible" becomes the searched subset, selecting rows and
  then typing a search that hides some of them prunes those from the selection — the same
  established behavior as changing a tab/facet (`plans/43/plan.md`), so bulk-delete can never act on
  a hidden row. No change to that invariant.
- **Preview persistence (FYI).** An open body preview is kept until closed even if the search would
  hide its row, because panel-open is derived against the full corpus (`allEmails`), exactly like an
  ordinary filter change (`plans/40/plan.md`, `plans/55/plan.md`).
- **Layout (FYI).** The box is placed at the left of the toolbar with Delete pushed to the right
  (`justify-content: space-between`); if a different arrangement is preferred it is a one-line style
  change.
- **Performance.** The corpus is bounded (~100 e-mails, in memory), so per-keystroke substring
  filtering with no debounce is trivially fast — this is why the story waives debounce.

## Testing recommendations
The project has an established test practice — **Vitest** unit/component tests (`npm run test`) and
**Playwright** E2E (`npm run test:e2e`) — so this change ships with tests at three altitudes:

- **Unit (pure matcher, `emailSearch.test.ts`)** — the primary correctness net. Must-cover:
  - empty query (`''`) → returns the input array **unchanged / same reference** (no filtering).
  - whitespace-only query (`'   '`) → same as empty (returns all).
  - case-insensitive match → `'build'` matches subject `'Build failed'`.
  - substring (not prefix) match → `'failed'` matches `'Build failed on main'`.
  - no match → returns `[]` (empty array, not an error).
  - `null`/`undefined` subject → that e-mail is **excluded** from a non-empty query (never throws),
    and **included** when the query is empty.
- **Component (`EmailList.test.tsx`, through `FluentProvider`)** — behavioral wiring: typing filters
  the rendered rows; clearing restores them; a zero-match query keeps the search box + Delete
  present and shows the "no match" message; select-all/bulk-delete act only on the matched subset.
- **E2E (`e2e/harness.spec.ts`, Playwright)** — the **visual/interactive acceptance**: the search
  box renders in the toolbar on the **same height as the Delete button** and live-filters the rows
  as text is typed, and clearing restores the list. Required because the "above the e-mail view, on
  the same height as the delete button" acceptance is layout/visual and jsdom cannot verify it.

No manual live-verification line is added — the E2E exercises the running app for this story's
acceptance.

## Definition of done
- [ ] A search box renders above the e-mail list, on the same row/height as the bulk-delete button.
- [ ] Typing filters the list to e-mails whose **subject contains** the typed text; clearing the box
      restores the current tab/facet view. No debounce (synchronous in-memory filtering).
- [ ] Subject matching is case-insensitive substring containment (ratified decision D2).
- [ ] A zero-match search keeps the search box (and Delete) visible and shows a "no match" message —
      the user is never trapped with no way to clear the query.
- [ ] Bulk-delete / select-all operate only on the currently-visible (searched) rows.
- [ ] `filterBySubject` is a pure, colocated, React-free helper in its own file (not the `use*` hook,
      not `src/services/`), unit-tested with the must-cover cases above.
- [ ] Search query state lives in `useEmailList`; the searched subset is derived during render via
      `useMemo` (no `setState`-in-effect).
- [ ] Component tests (through `FluentProvider`) and Playwright E2E (search box on the same height as
      Delete + live filtering) are added and pass.
- [ ] `npm run test`, `npm run test:e2e`, `npm run build`, and `npm run lint` all pass; all new files
      are git-tracked and included in the PR.

## Files/areas affected
- `src/components/EmailList/emailSearch.ts` *(new — pure matcher)*
- `src/components/EmailList/emailSearch.test.ts` *(new — unit tests)*
- `src/components/EmailList/useEmailList.ts` *(query state + `visibleEmails` derivation)*
- `src/components/EmailList/EmailList.tsx` *(SearchBox in toolbar, grid over `visibleEmails`, zero-match state)*
- `src/components/EmailList/EmailList.test.tsx` *(search behavior tests)*
- `e2e/harness.spec.ts` *(search box layout + live-filter E2E)*
