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

Outcome: the list migrates to Fluent v9 **`DataGrid`** (reviewer decision **O1-B**) with
**`resizableColumns`**, the **Subject** cell shows the full subject in a **hover tooltip**, and the
**Date** column defaults to a tight width that fits its fixed-length text.

## Decisions already ratified at plan review
- **O1-B — use `DataGrid` with `resizableColumns`** (not the primitive `Table` + sizing hook).
- **O2-A — only the data columns are meant to be resizable**, selection + Actions kept fixed.
  *Under `DataGrid` this is in tension with O1-B (see O6 below) — `resizableColumns` is global.*
- **O4-A — tooltip on the Subject column only.**
- **O5-A — keep the existing locale-based `formatReceivedDate` output**; only tighten the Date
  column width.

## Keep it simple
- **Migrate to `DataGrid`, but keep the existing custom selection model — do not adopt
  `DataGrid`'s built-in `selectionMode`.** When `selectionMode` is set, `DataGridRow` calls
  `selection.toggleRow` on every row `onClick` (confirmed in
  `@fluentui/react-table` `useDataGridRow`), which would both open the body drawer *and* toggle
  selection on a single row click — breaking the ratified row-click→drawer UX (stories 40/46) and
  the existing tests. Instead, `DataGrid` is used for layout + `resizableColumns` only; the proven
  selection state in `useEmailList` (raw/effective `selectedIds`, `toggleSelected`,
  `toggleSelectAll`) and the row-click→drawer handler are preserved verbatim, with the selection
  checkbox rendered as an ordinary column cell (its click `stopPropagation`, exactly as today).
- **Non-goal: no persistence of resized widths.** Widths reset to defaults on reload; the story
  doesn't ask for it and there's no width-storage layer. (Open — O3.)
- **Non-goal: no tooltip on the non-subject columns.** AC2 names Subject only (O4-A); the
  Organization/Project/Type cells keep their plain ellipsis.
- **Non-goal: no change to the date *format*** (O5-A) — only the Date column's default *width* is
  tightened.
- **Non-goal: no sorting, grouping, or virtualization.** `DataGrid` offers these; the story asks
  for none, so they are not enabled.

## AC coverage
| AC | Status | Where |
|---|---|---|
| Columns are resizable | covered | Task 3 (`DataGrid resizableColumns` + `columnSizingOptions`); O2-A scope vs. global resize tracked in O6 |
| Subjects have hover tooltips to view the full subject | covered | Task 3 (Fluent `Tooltip` on the subject cell, per O4-A) |
| The date column fits the content correctly | covered | Task 2 (`columnSizingOptions` gives Date a tight `idealWidth`/`minWidth`) |

## Implementation approach
Replace the primitive `Table` markup with `DataGrid` (`@fluentui/react-components`), driving it
with column definitions and `resizableColumns`, while keeping the current selection logic and
row-click behaviour.

- **DataGrid wiring (AC1 + AC3).**
  `<DataGrid items={emails} columns={columns} getRowId={(e) => e.message.id ?? ''} resizableColumns columnSizingOptions={columnSizingOptions} size="small" aria-label="E-mails">`
  with `DataGridHeader`/`DataGridRow` (header) and `DataGridBody`/`DataGridRow`/`DataGridCell`
  (body). **No `selectionMode`** (see *Keep it simple*).
  - `columnSizingOptions` holds per-column `idealWidth`/`minWidth`; the **Date** column is sized
    tight to `24 Apr 2020, 06:50` (≈ `idealWidth: 140`, `minWidth: 120`) — this is AC3 — and
    **Subject** gets the largest `idealWidth` so it stays the widest column (keeps the existing E2E
    "Subject is the widest" invariant true).
- **Column definitions.** Seven columns via `createTableColumn<CategorizedEmail>`:
  `select`, `date`, `subject`, `organization`, `project`, `type`, `actions`. Each defines
  `renderHeaderCell` and `renderCell`. Because these render functions return JSX and close over the
  hook's handlers (`selectedIds`, `toggleSelected`, `toggleSelectAll`, `openResolve`,
  `openDeleteRow`, `typeLabel`, `formatReceivedDate`), the `columns` array is built **inside
  `EmailList.tsx`** (memoised with `useMemo`), not in the pure helper — rendering lives in the
  `.tsx` (`frontend-architecture.md`). The pure, React-free `columnSizingOptions` + `COLUMN_ID`
  constants live in a new colocated helper `emailColumns.ts`.
- **Selection column (`select`).** `renderHeaderCell` returns the select-all `Checkbox`
  (checked/mixed logic unchanged); `renderCell` returns the per-row `Checkbox`. Both keep the
  `onClick`/`onKeyDown` `stopPropagation` so toggling selection never opens the drawer. The cell's
  `focusMode="group"` (it holds an interactive control).
- **Row behaviour.** In `DataGridBody`, each `DataGridRow` gets `onClick={() => openEmail(id)}`,
  the Enter/Space `onKeyDown`, `tabIndex={0}`, `aria-label={subject}`, and `className={styles.row}`
  — identical to today. With no `selectionMode`, `DataGridRow.onClick` does **not** toggle
  selection, so clicking the row only opens the drawer.
- **Subject cell (`subject`).** `renderCell` returns the existing `subjectCell` span with the
  truncated `subjectText` span wrapped in `<Tooltip content={subject} relationship="label" withArrow>`
  (O4-A). The `needsReview` badge stays a sibling outside the tooltip trigger.
- **Actions cell (`actions`).** `renderCell` returns the existing delete + conditional
  resolve-GUID icon buttons (handlers + `stopPropagation` unchanged); `focusMode="group"`.
- **Body drawer, resolve dialog, confirm-delete dialog, and `useEmailList` selection/panel/dialog
  state are unchanged** — only the table markup changes.

## Task breakdown
1. **Add the column config helper.** Create `src/components/EmailList/emailColumns.ts` exporting:
   - `COLUMN_ID` — a constant object mapping `select`/`date`/`subject`/`organization`/`project`/
     `type`/`actions` to their `TableColumnId` strings (single source of column ids);
   - `columnSizingOptions: TableColumnSizingOptions` — per-column `idealWidth`/`minWidth`, Date
     sized tight (≈140/120), Subject the widest, selection ≈44 and actions ≈96 as sensible fixed
     defaults.
   No JSX (pure, React-free helper). *Rules:* `frontend-architecture.md` (pure colocated helper in
   the component folder, not `services/`, not the `use*` file), `categorization-domain.md`
   (derives nothing; tags consumed verbatim).
2. **Confirm/adjust the Date width target.** Verify ≈140px comfortably fits `formatReceivedDate`'s
   output (locale `toLocaleString` with `year/month:short/day/2-digit hour/minute`) without
   ellipsis at the default width; tune `idealWidth`/`minWidth` in `emailColumns.ts` if needed
   (AC3, O5-A). *Rules:* `frontend-architecture.md`.
3. **Migrate the view to `DataGrid`.** Rewrite the table in `src/components/EmailList/EmailList.tsx`:
   build the memoised `columns` array (7 `createTableColumn` defs with `renderHeaderCell`/
   `renderCell` as above); render `DataGrid`/`DataGridHeader`/`DataGridBody`/`DataGridRow`/
   `DataGridCell`/`DataGridHeaderCell` with `resizableColumns` + `columnSizingOptions` +
   `getRowId`; wrap the subject text in `Tooltip` (O4-A); set `focusMode="group"` on the selection
   and actions cells; keep the toolbar (bulk Delete), empty state, drawer, and dialogs as-is;
   reconcile `useStyles` (drop the `tableLayout: 'fixed'` percentage classes `colDate`/`colOrg`/
   `colProject`/`colType`; keep `cell` ellipsis, `subjectCell`, `subjectText`, `reviewBadge`,
   `row`, `actionsCell`, and the `main` horizontal-scroll region). *Rules:*
   `frontend-architecture.md` (Fluent v9 components/tokens; rendering only in `.tsx`; logic stays
   in the hook), `categorization-domain.md` (tags consumed verbatim).
4. **Keep selection wiring in the hook.** In `src/components/EmailList/useEmailList.ts`, the
   existing selection/panel/dialog state is unchanged; expose whatever the new `renderCell`
   closures need (already returned). No `DataGrid` selection feature is used. *Rules:*
   `frontend-architecture.md` (logic in the hook, not JSX).
5. **Update/extend unit tests.** In `src/components/EmailList/EmailList.test.tsx`: keep all
   existing assertions green, **adjusting only ARIA-role queries if `DataGrid` changes an element's
   role vs. the primitive `Table`** (e.g. header cell `columnheader`/`rowheader`, row `row`); add a
   test that the subject cell is wrapped by a tooltip trigger carrying the **full** subject as its
   content/accessible relationship. Do **not** assert hover-driven tooltip visibility or drag
   resizing in jsdom. *Rules:* `testing.md` (render through `FluentProvider` + `webLightTheme`;
   jsdom cannot verify visual/interactive acceptance).
6. **Add real-browser E2E for the interactive/visual acceptance.** In `e2e/harness.spec.ts` (reuses
   the `/harness.html` mock-auth seam and its long-subject sample row) assert: (a) dragging a data
   column's resize handle changes that column's rendered width; (b) hovering a truncated subject
   surfaces a `role="tooltip"` with the full subject; (c) the Date column renders at its compact
   default width (narrower than Subject). **Update the existing harness tests if `DataGrid` changes
   the header roles they query** (the current "Subject is the widest" test reads the Date header as
   `rowheader`), keeping them green. *Rules:* `testing.md` (visual/layout/interactive acceptance in
   a real browser, not jsdom alone).

## Testing recommendations
- **Whether to test:** yes — Vitest (`npm run test`) and Playwright (`npm run test:e2e`) are both
  set up; use both, no new framework.
- **Altitude:**
  - *Component (jsdom, Vitest):* regression-guard the existing `EmailList` behaviours (headers,
    rows, selection count, bulk/row delete, resolve-GUID, body panel) and add the tooltip-wiring
    assertion. jsdom has no layout engine — do not assert resize dragging, hover-tooltip
    visibility, or actual column widths here.
  - *E2E (Playwright, real browser):* the true acceptance for AC1 (resize drag changes width), AC2
    (hover shows the full-subject tooltip), AC3 (Date renders compact), via `/harness.html`.
- **Must-cover list (beyond what the ACs already state):**
  - Subject tooltip content equals the **full** subject even when the visible cell is ellipsized →
    full text present in the tooltip, not the truncated text.
  - A missing subject (`'(no subject)'`) still renders and its tooltip shows that placeholder → no
    crash, no empty tooltip trigger.
  - Clicking the selection checkbox toggles selection **without** opening the body drawer; clicking
    the row body opens the drawer **without** toggling selection → the two interactions stay
    separate under `DataGrid` (this is the concrete regression the no-`selectionMode` choice
    guards).
- **Live verification:** the resize-drag and hover-tooltip acceptance is inherently interactive —
  **the Playwright E2E (Task 6) must pass before merge** (the real-browser check `testing.md`
  mandates; no separate manual step if the E2E covers it).

## Considerations
- **DataGrid role changes are expected.** Swapping the primitive `Table` for `DataGrid` can change
  some ARIA roles the current tests query (header `rowheader` vs `columnheader`); Tasks 5–6 keep
  the suites green by adjusting the queries, not by weakening assertions.
- **Performance:** `DataGrid` re-derives over the bounded (≤ ~100) in-memory set; `columns` is
  memoised. Negligible.
- **Accessibility:** `resizableColumns` provides keyboard-accessible resize handles;
  `Tooltip relationship="label"` gives the subject an accessible name; the row keeps
  `aria-label={subject}`.
- **jsdom safety:** `DataGrid`/column sizing uses `ResizeObserver`, already stubbed in
  `src/setupTests.ts`, so mounting `EmailList` in Vitest will not crash.

## Assumptions & open questions
- **O3 — Persist resized widths *(still open — no reviewer selection yet)*.** Do not persist —
  widths reset to defaults on reload (recommended — the story doesn't ask, and there's no
  width-storage layer) **or** persist widths across reloads (e.g. `localStorage`)? Reply O3-A or
  O3-B. *(The plan proceeds on O3-A pending your call.)*
- **O6 — `resizableColumns` is global, which conflicts with O2-A *(new — raised by the O1-B
  decision)*.** Under `DataGrid`, `resizableColumns` enables resizing for **every** column, so the
  selection and Actions columns will also carry resize handles — whereas O2-A asked to keep those
  two fixed/non-resizable. `DataGrid` has no per-column resize opt-out. Which wins:
  **O6-A (recommended)** — honour O1-B: keep `DataGrid`, accept that selection + Actions are
  technically draggable but pin them to sensible fixed default widths in `columnSizingOptions`;
  **or O6-B** — honour O2-A strictly: revert to the primitive `Table` + `useTableColumnSizing_unstable`
  (the O1-A approach), the only way to make **only** the five data columns resizable while keeping
  selection + Actions truly non-resizable? Reply O6-A or O6-B.

## Definition of done
- [ ] The list renders via Fluent v9 `DataGrid` with `resizableColumns`; data columns resize by
      dragging their header handles (AC1, O1-B), verified in the Playwright E2E.
- [ ] The **Subject** cell shows the **full subject** in a hover tooltip (AC2, O4-A), verified in
      the Playwright E2E.
- [ ] The **Date** column defaults to a **compact** width fitting `24 Apr 2020, 06:50`, narrower
      than Subject (AC3, O5-A), verified in the Playwright E2E.
- [ ] Clicking a row opens the body drawer and clicking the checkbox toggles selection, and the two
      never trigger each other (ratified UX preserved under `DataGrid`; no `selectionMode`).
- [ ] Column-sizing config lives in the pure `emailColumns.ts`; the memoised `columns` (with JSX
      render functions) and rendering live in `EmailList.tsx`; selection/panel logic stays in
      `useEmailList.ts` (`frontend-architecture.md`).
- [ ] Categorization tags are consumed verbatim — nothing re-derived (`categorization-domain.md`).
- [ ] All existing `EmailList` component tests and `harness.spec.ts` E2E tests still pass (ARIA-role
      queries updated for `DataGrid` where needed); the new tooltip unit test and the
      resize/tooltip/compact-date E2E tests pass.
- [ ] `npm run test`, `npm run test:e2e`, `npm run lint`, and `npm run build` are all clean.
- [ ] New files (`emailColumns.ts`, any new test) are git-tracked and included in the PR
      (`testing.md` — green local tests don't prove a file shipped).

## Files/areas affected
- `src/components/EmailList/emailColumns.ts` — **new** pure column config (`COLUMN_ID`,
  `columnSizingOptions`).
- `src/components/EmailList/EmailList.tsx` — migrate `Table` → `DataGrid`; build memoised `columns`
  with `renderHeaderCell`/`renderCell`; add subject `Tooltip`; reconcile styles.
- `src/components/EmailList/useEmailList.ts` — selection/panel state unchanged; keep exposing what
  the render closures need.
- `src/components/EmailList/EmailList.test.tsx` — keep green (adjust roles for `DataGrid`); add
  tooltip-wiring test.
- `e2e/harness.spec.ts` — add resize / tooltip / compact-date tests; adjust existing header-role
  queries for `DataGrid`.
