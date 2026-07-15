# Plan — AB#54: Email overview column improvements

## Context
The center e-mail list (`src/components/EmailList/EmailList.tsx`) renders one row per e-mail in a
Fluent UI v9 **primitive `Table`** with a `tableLayout: 'fixed'` layout and hard-coded percentage
column widths (`colDate 14%`, `colOrg 14%`, `colProject 13%`, `colType 16%`, Subject taking the
rest). Three usability gaps remain:

1. **Columns cannot be resized** — widths are fixed by CSS; the user cannot widen Subject or
   narrow a column to taste.
2. **Long subjects are only ellipsized** — a truncated subject cannot be read in full without
   opening the row's body drawer.
3. **The Date column is oversized** — it reserves `14%` of the table, far more than the
   fixed-length received-date text (e.g. `24 Apr 2020, 06:50`) needs.

Outcome: the five data columns become **user-resizable**, the **Subject** cell shows the full
subject in a **hover tooltip**, and the **Date** column defaults to a tight width that fits its
fixed-length text.

## Keep it simple
- **Non-goal: do not migrate the primitive `Table` to `DataGrid`.** Column resizing is added to
  the existing `Table` via the Fluent v9 `useTableFeatures` + `useTableColumnSizing_unstable`
  hooks, which layer sizing onto the current markup. A full `DataGrid` migration would rewrite the
  selection model, row rendering, and row-click→drawer interaction (ratified in stories 40/43/46)
  and put every existing test at risk — disproportionate to three column tweaks. (Threaded — see
  *Assumptions & open questions* O1.)
- **Non-goal: no persistence of resized widths.** Widths reset to their defaults on reload; the
  story does not ask for persistence and the app has no width-storage layer. (Threaded — O3.)
- **Non-goal: no tooltip on the non-subject columns.** AC2 names the Subject column only; the
  Organization/Project/Type cells keep their plain ellipsis. (Threaded — O4.)
- **Non-goal: no change to the date *format*.** The existing locale-based `formatReceivedDate`
  output is unchanged; only the column's default *width* is tightened. (Threaded — O5.)
- **Non-goal: the selection and Actions columns stay fixed-width and non-resizable.** Only the five
  data columns (Date, Subject, Organization, Project, Type) get resize handles. (Threaded — O2.)

## AC coverage
| AC | Status | Where |
|---|---|---|
| Columns are resizable | covered | Task 2 (`useTableColumnSizing_unstable`), scoped to the 5 data columns per O2 |
| Subjects have hover tooltips to view the full subject | covered | Task 3 (Fluent `Tooltip` on the subject cell) |
| The date column fits the content correctly | covered | Task 2 (`columnSizingOptions` gives Date a tight `idealWidth`/`minWidth`) |

## Implementation approach
Add Fluent UI v9 **column sizing** to the existing primitive `Table` and a **`Tooltip`** on the
subject cell — no structural rewrite.

- **Column sizing (AC1 + AC3).** Use `useTableFeatures(..., [useTableColumnSizing_unstable({ columnSizingOptions })])`
  from `@fluentui/react-components`. The hook returns `columnSizing_unstable` whose
  `getTableProps()`, `getTableHeaderCellProps(columnId)`, and `getTableCellProps(columnId)` are
  spread onto the `Table`, each `TableHeaderCell`, and each `TableCell` of the five data columns.
  `getTableHeaderCellProps` injects the drag-to-resize handle (its `aside` slot) and sets the
  column width; `getTableCellProps` sets the matching cell width. Per-column defaults
  (`idealWidth`, `minWidth`) come from a `columnSizingOptions` map — this is also where the **Date**
  column's tight default width lives, so AC1 and AC3 are satisfied by the same mechanism.
  - The **selection** and **Actions** columns are *not* given sizing props — they keep their
    existing fixed-width classes (`colSelect` 44px, `colActions` 96px) and stay non-resizable.
  - The `tableLayout: 'fixed'` + percentage-width classes (`colDate`/`colOrg`/`colProject`/`colType`)
    are removed; the sizing feature now owns those widths via inline style. The single-line
    ellipsis `cell` class and the `subjectText`/`subjectCell` classes are kept. Preserve the
    horizontal-scroll behaviour: the sum of column widths gives the table a natural min content
    width, so `styles.main`'s `overflowX: 'auto'` still scrolls rather than crushing Subject.
- **Subject tooltip (AC2).** Wrap the truncated subject `span` (`styles.subjectText`) in
  `<Tooltip content={subject} relationship="label" withArrow>` from `@fluentui/react-components`.
  The `needsReview` badge stays a sibling (outside the tooltip trigger) so only the subject text is
  the hover target.
- **Where the logic lives.** Per `frontend-architecture.md`, React logic stays in the colocated
  hook. The `useTableFeatures`/`useTableColumnSizing_unstable` wiring goes into
  **`useEmailList.ts`**, which already receives `emails`; it returns the `columnSizing` getters
  alongside the existing selection/panel state. The static, React-free column config
  (`columnSizingOptions` + the `createTableColumn` column definitions) goes into a new **pure
  colocated helper** `emailColumns.ts` (mirrors the `emailFormatters.ts` / `facetFilters.ts`
  precedent — pure derivation/config in its own file, not the `use*` file).

## Task breakdown
1. **Add the column config helper.** Create `src/components/EmailList/emailColumns.ts` exporting:
   - a `COLUMN_ID` constant object (`select`, `date`, `subject`, `organization`, `project`, `type`,
     `actions`) as the single source of column ids;
   - `emailColumns` — the `createTableColumn<CategorizedEmail>({ columnId })` definitions for the
     five data columns (id only; cells are rendered in JSX, so no `renderCell` is needed);
   - `columnSizingOptions: TableColumnSizingOptions` — per-column `idealWidth`/`minWidth`, with the
     **Date** column sized tight to `24 Apr 2020, 06:50` (≈ `idealWidth: 140`, `minWidth: 120`) and
     **Subject** given the largest `idealWidth` so it stays the widest column (keeps the existing
     E2E "Subject is the widest" invariant true).
   - *Rules:* `frontend-architecture.md` (pure colocated helper in the component folder, not
     `services/`, not the `use*` file), `categorization-domain.md` (consumes tags verbatim; derives
     nothing).
2. **Wire column sizing into the hook.** Edit `src/components/EmailList/useEmailList.ts`: call
   `useTableFeatures({ columns: emailColumns, items: emails }, [useTableColumnSizing_unstable({ columnSizingOptions })])`
   and add `columnSizing` (the `columnSizing_unstable` value: `getTableProps`,
   `getTableHeaderCellProps`, `getTableCellProps`) to `UseEmailListResult` and the returned object.
   - *Rules:* `frontend-architecture.md` (logic in the hook, not JSX; the `use*` file holds real
     React hook logic).
3. **Apply sizing + tooltip in the view.** Edit `src/components/EmailList/EmailList.tsx`:
   - spread `columnSizing.getTableProps()` onto `<Table>` (merging `styles.table`);
   - spread `columnSizing.getTableHeaderCellProps(COLUMN_ID.x)` on the Date/Subject/Organization/
     Project/Type `TableHeaderCell`s and `getTableCellProps(COLUMN_ID.x)` on the matching
     `TableCell`s;
   - wrap the subject text span in `<Tooltip content={subject} relationship="label" withArrow>`;
   - drop the removed percentage width classes from `useStyles` (keep `colSelect`, `colActions`,
     `cell`, `subjectCell`, `subjectText`, `reviewBadge`, and reconcile `styles.table`).
   - *Rules:* `frontend-architecture.md` (Fluent v9 components/tokens; rendering only in the
     `.tsx`), `categorization-domain.md` (tags consumed verbatim).
4. **Update/extend unit tests.** Edit `src/components/EmailList/EmailList.test.tsx`: keep all
   existing assertions green (headers, rows, selection, delete, resolve-GUID, body panel), and add
   a test that the subject cell is wrapped by a tooltip trigger carrying the full subject as its
   content/accessible relationship. Do **not** assert hover-driven tooltip visibility or drag
   resizing in jsdom (no layout engine — see Testing recommendations).
   - *Rules:* `testing.md` (component tests render through `FluentProvider` + `webLightTheme`;
     jsdom cannot verify visual/interactive acceptance).
5. **Add real-browser E2E for the interactive/visual acceptance.** Edit `e2e/harness.spec.ts`
   (reuses the existing `/harness.html` mock-auth seam and its long-subject sample row) to assert:
   (a) dragging a data column's resize handle changes that column's rendered width; (b) hovering a
   truncated subject surfaces a tooltip (`role="tooltip"`) showing the full subject; (c) the Date
   column renders at its compact default width (narrower than Subject and roughly the date-text
   width). Keep the existing harness tests green.
   - *Rules:* `testing.md` (visual/layout/interactive acceptance verified in a real browser, not
     jsdom alone).

## Testing recommendations
- **Whether to test:** yes — the project has Vitest (`npm run test`) and Playwright
  (`npm run test:e2e`) practices; use both, no new framework.
- **Altitude:**
  - *Component (jsdom, Vitest):* regression-guard the existing `EmailList` behaviours and add the
    tooltip-wiring assertion. jsdom has no layout engine, so it **cannot** verify resize dragging,
    hover-tooltip visibility, or actual column widths — do not assert those here.
  - *E2E (Playwright, real browser):* the true acceptance for AC1 (resize drag changes width), AC2
    (hover shows the full-subject tooltip), and AC3 (Date renders compact). Driven via the existing
    `/harness.html` seam.
- **Must-cover list (beyond what the ACs already state):**
  - Subject tooltip content equals the **full** subject even when the visible cell is ellipsized →
    full text present in the tooltip, not the truncated text.
  - A missing subject (`'(no subject)'`) still renders without error and its tooltip shows that
    placeholder → no crash, no empty tooltip trigger.
  - Resizing a data column does not fire the row-open drawer or a selection toggle → drawer stays
    closed, selection unchanged after a drag.
- **Live verification:** the resize-drag and hover-tooltip acceptance is inherently interactive —
  **needs the Playwright E2E (Task 5) to pass before merge** (this is the real-browser check
  `testing.md` mandates; no separate manual step required if the E2E covers it).

## Considerations
- **Performance:** `useTableFeatures` re-derives on each render over the bounded (≤ ~100) in-memory
  set — negligible; no memoisation beyond what the hook already does is needed.
- **Accessibility:** `useTableColumnSizing_unstable` provides keyboard-accessible resize handles;
  `Tooltip relationship="label"` gives the subject an accessible name. The row keeps its
  `aria-label={subject}`, so the accessible row name is unchanged.
- **jsdom safety:** the sizing feature uses `ResizeObserver`, already stubbed in
  `src/setupTests.ts`, so mounting `EmailList` in Vitest will not crash.
- **`_unstable` API:** `useTableColumnSizing_unstable` is the current, documented Fluent v9 column-
  sizing hook (the `_unstable` suffix is Fluent's convention for this feature, used in its own docs
  and `DataGrid`); it is the intended API, not a private internal.

## Assumptions & open questions
- **O1 — Resizing approach.** Add sizing to the existing primitive `Table` via
  `useTableFeatures` + `useTableColumnSizing_unstable` (recommended — minimal diff, preserves the
  ratified selection/row-click/drawer behaviour and all existing tests) **or** migrate the list to
  `DataGrid` with `resizableColumns` (idiomatic for grids but rewrites selection + row interaction
  and risks the story-40/43/46 behaviours)? Reply O1-A or O1-B.
- **O2 — Which columns resize.** Make only the five data columns (Date, Subject, Organization,
  Project, Type) resizable and keep the selection + Actions columns fixed-width (recommended —
  those two are chrome, not data) **or** make every column resizable including selection/Actions?
  Reply O2-A or O2-B.
- **O3 — Persist resized widths.** Do not persist — widths reset to defaults on reload (recommended
  — the story doesn't ask, and there's no width-storage layer) **or** persist widths across reloads
  (e.g. `localStorage`)? Reply O3-A or O3-B.
- **O4 — Tooltip scope.** Tooltip on the Subject column only, per AC2 (recommended) **or** also add
  tooltips to the other truncatable cells (Organization/Project/Type)? Reply O4-A or O4-B.
- **O5 — Date format.** Keep the existing locale-based `formatReceivedDate` output and only tighten
  the column width (recommended — AC3 is about width, and the example string is illustrative of
  length) **or** pin the format to the AC's exact `24 Apr 2020, 06:50` shape (fixed `en-GB`-style
  formatting)? Reply O5-A or O5-B.

## Definition of done
- [ ] The five data columns (Date, Subject, Organization, Project, Type) are **resizable** by
      dragging their header handles (AC1), verified in the Playwright E2E.
- [ ] The **Subject** cell shows the **full subject** in a hover tooltip (AC2), verified in the
      Playwright E2E.
- [ ] The **Date** column defaults to a **compact** width fitting `24 Apr 2020, 06:50`, narrower
      than Subject (AC3), verified in the Playwright E2E.
- [ ] Column-sizing wiring lives in `useEmailList.ts`; the pure column config lives in
      `emailColumns.ts`; `EmailList.tsx` only renders (`frontend-architecture.md`).
- [ ] Categorization tags are consumed verbatim — nothing re-derived (`categorization-domain.md`).
- [ ] All existing `EmailList` component tests and `harness.spec.ts` E2E tests still pass; the new
      tooltip unit test and resize/tooltip/date-width E2E tests pass.
- [ ] `npm run test`, `npm run test:e2e`, `npm run lint`, and `npm run build` are all clean.
- [ ] New files (`emailColumns.ts`, any new test) are git-tracked and included in the PR
      (`testing.md` — green local tests don't prove a file shipped).

## Files/areas affected
- `src/components/EmailList/emailColumns.ts` — **new** pure column config (ids, definitions,
  `columnSizingOptions`).
- `src/components/EmailList/useEmailList.ts` — add column-sizing hook wiring + return the getters.
- `src/components/EmailList/EmailList.tsx` — spread sizing props, add subject `Tooltip`, reconcile
  styles.
- `src/components/EmailList/EmailList.test.tsx` — keep existing green; add tooltip-wiring test.
- `e2e/harness.spec.ts` — add resize / tooltip / compact-date real-browser tests.
