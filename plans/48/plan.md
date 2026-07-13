# Plan — Story 48: No tabs and filters if no mails are present

## Context

When the configured `DevOps` folder contains **no e-mails**, the app still renders the customer
tab strip (as an empty `All (0)` tab), the project/type sidebar (with no facets), and an empty
list view. This is confusing: the chrome implies there is something to triage when there is
nothing. The story asks that, when the categorized set is empty, the app hide the tabs and
filters and instead show a **single warning message** telling the user there is nothing to
display.

The `Organizer` container is already the **single owner** of cross-cutting page states: story 46
established that it renders **only** a spinner while loading and **only** an error on failure, and
mounts the tabs/filters/list solely on success (`.claude/rules/frontend-architecture.md` — "a
cross-cutting UI concern has a single owner"). The empty-corpus state is the next state in exactly
that same lifecycle, so it belongs in the same place — a new branch in `Organizer` that returns
before the tabs/filters/list are mounted.

## Keep it simple

- **No new component or hook.** The empty state is one more branch in the existing
  `Organizer` render — mirroring the loading/error branches already there. It does not warrant
  its own component folder or logic hook (there is no logic beyond an `Array.length === 0`
  check the container already has the data for).
- **No change to `useOrganizer` / `useCategorizedMail`.** The container already receives the
  full `categorized` set; emptiness is derived during render (`categorized.length === 0`), not
  synced into new state (`.claude/rules/frontend-architecture.md` — derived state is computed
  during render).
- **Not touching `EmailList`'s own "No e-mails to show." text.** That message covers a
  *different* scenario — e-mails exist but the current filter selection yields zero rows — and
  stays as-is. This story's empty state is the **whole-corpus-empty** case, gated one level up in
  `Organizer` before `EmailList` ever mounts. (See AC coverage / Considerations.)
- **No new Graph scope, no data-flow change.** Purely a render-branch addition.

## AC coverage

| AC | Status | Where |
|---|---|---|
| When no e-mails are available, no tabs and filters are visible | covered | Task 1 — the new empty branch in `Organizer` returns before `CustomerTabs`/`SidebarFilters`/`EmailList` mount. |
| When no e-mails are available, a general warning message is visible to the user | covered | Task 1 — the empty branch renders a single warning message; Task 2 pins it with a component test. |

Both ACs are fully covered; none narrowed or deferred.

## Implementation approach

Add an **empty-corpus gate** to `src/components/Organizer/Organizer.tsx`, placed **after** the
`loading` and `error` branches and **before** the success return:

```tsx
if (categorized.length === 0) {
  return (
    <div className={styles.root}>
      <div className={styles.status}>
        <MessageBar intent="warning">
          <MessageBarBody>
            No e-mails found in "{folderName}". There is nothing to display.
          </MessageBarBody>
        </MessageBar>
      </div>
    </div>
  );
}
```

- Reuse the **existing** `styles.root` + `styles.status` wrappers (the same centering frame the
  loading and error branches already use) so the message sits in the same region — no new layout
  primitives.
- Use Fluent UI v9 **`MessageBar`** with `intent="warning"` + `MessageBarBody`
  (`@fluentui/react-components`, v9.74.3 — verified exported; not yet used elsewhere). This is the
  design-system component for a "warning message" and satisfies the Fluent-first rule
  (`.claude/rules/frontend-architecture.md`). Interpolate `folderName` (already destructured from
  `useData()`) so the message names the folder, consistent with the loading branch's
  `Loading mail from "${folderName}"…`.
- The gate keys on **`categorized`** (the full set), not `filtered`, so an active filter that
  happens to yield zero rows does **not** trigger it — only a genuinely empty corpus does.

Nothing else changes: `useOrganizer`, `useCategorizedMail`, `EmailList`, `CustomerTabs`, and
`SidebarFilters` are untouched.

## Task breakdown

1. **Add the empty-corpus branch to `Organizer`.**
   `src/components/Organizer/Organizer.tsx` — add the `categorized.length === 0` branch shown
   above between the `status === 'error'` branch and the success `return`. Add the `MessageBar`,
   `MessageBarBody` imports to the existing `@fluentui/react-components` import. Extend the
   component's JSDoc one line to note it now also owns the empty-corpus state (keeping the
   story-46 "single owner" narrative current).
   *Rules:* `.claude/rules/frontend-architecture.md` (Fluent-first; griffel tokens; single owner
   of cross-cutting states; derived-during-render).

2. **Cover the empty state with a component test.**
   `src/components/Organizer/Organizer.test.tsx` — add a case to the existing
   `describe('Organizer — load lifecycle gate', …)` using the existing `renderOrganizer` helper:
   `renderOrganizer({ status: 'success', categorized: [] })` and assert
   - the warning message text is present (`screen.getByText(/nothing to display/i)`),
   - the tabs, filters, and list are **absent** (reuse the exact `queryByRole` assertions the
     loading/error cases already use: `tablist` name `Organizations`, `complementary` name
     `Filters`, `table` name `E-mails`).
   *Rules:* `.claude/rules/testing.md` (render through the `FluentProvider` wrapper — the helper
   already does; presence/absence gate is testable in jsdom).

## Testing recommendations

- **Whether to test:** yes — the project has an established unit/component practice (Vitest +
  Testing Library, `test` skill, `.claude/rules/testing.md`).
- **At what altitude:** a **component test** on `Organizer`, mounted through the app's
  `FluentProvider` wrapper via the existing `renderOrganizer` helper — the same altitude and
  pattern as the story-46 loading/error gate tests already in `Organizer.test.tsx`.
- **Must-cover list:**
  - `status: 'success'` + `categorized: []` → the warning message is visible **and** the tabs
    (`tablist` "Organizations"), filters (`complementary` "Filters"), and list (`table` "E-mails")
    are all **absent**.
  - Guard against regressing the non-empty path: the existing "renders the tabs, filters, and
    list on success" case (with a non-empty set) must still pass — no new assertion needed, just
    keep it green.
- **Live verification:** not required. The acceptance is **presence/absence** of elements, not
  visual layout or sizing, so jsdom is sufficient here (contrast with the story-46 *scroll/height*
  checks, which needed Playwright). See open question OQ2 on whether to add a harness E2E anyway.

## Definition of done

- [ ] With an empty categorized set, `Organizer` renders **no** customer tabs and **no**
      project/type sidebar filters (AC 1).
- [ ] With an empty categorized set, `Organizer` renders exactly **one** warning message stating
      there is nothing to display (AC 2).
- [ ] The empty gate keys on the full `categorized` set, not `filtered` — an active filter that
      yields zero rows does not trigger it (the non-empty success path is unchanged).
- [ ] The new component test in `Organizer.test.tsx` covers the empty case and the full Vitest
      suite passes (`npm run test`).
- [ ] All new/changed files are git-tracked and included in the change
      (`.claude/rules/testing.md` — a green local suite does not prove a file shipped).
- [ ] Type-checks and builds cleanly; no ESLint errors; Prettier-formatted
      (`.claude/rules/frontend-architecture.md` "what done looks like").

## Considerations

- **`EmailList`'s "No e-mails to show." text is not dead code.** It covers the filtered-empty
  case (e-mails exist, but the current tab/facet selection matches none) while `EmailList` is
  mounted. This story's gate sits one level up and only fires for the whole-corpus-empty case, so
  the two do not overlap and neither should be removed. This is deliberately left in place.
- **Consistency with loading/error.** The empty branch reuses the same `root`/`status` centering
  frame, so all three non-success states render in the same region and read as one lifecycle.

## Assumptions & open questions

No open questions remain — all three were resolved by the reviewer at plan review (PR #32), each
in favor of the recommended option. They are recorded here as settled decisions, folded into the
plan body above:

- **OQ1 — Warning message component → `MessageBar` (resolved).** Use a Fluent
  `MessageBar intent="warning"` + `MessageBarBody` (over a plain `Text`) — the design-system
  component for a warning message. Reflected in *Implementation approach* and Task 1.
- **OQ2 — Test altitude → jsdom only (resolved).** A jsdom component test on `Organizer`, no
  Playwright E2E — the acceptance is element presence/absence. Reflected in *Testing
  recommendations* and Task 2.
- **OQ3 — Message wording → with-folder (resolved).** Use `No e-mails found in "<folder>". There
  is nothing to display.`, naming the folder (mirroring the loading label). Reflected in
  *Implementation approach*.

## Files/areas affected

- `src/components/Organizer/Organizer.tsx` — new empty-corpus render branch (+ imports, JSDoc line).
- `src/components/Organizer/Organizer.test.tsx` — new empty-state component test case.
