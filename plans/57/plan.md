# Plan — Story 57: Collapsible filters

## Context

The left **Filters** sidebar (`SidebarFilters`) currently renders two always-open facet groups —
**Projects** and **Types** — as a plain vertical stack. On a busy corpus both lists can get long,
crowding the sidebar. This story makes each filter section **collapsible**: a chevron icon sits to
the left of the section title, sections are **expanded by default**, and clicking a section's
header collapses it, hiding that section's options (and clicking again re-expands it). The goal is a
tidier sidebar the user controls, with the pattern generalizing to any future filter section.

The cleanest way to get this in a Fluent UI v9 app is the framework's own **`Accordion`** family
(`Accordion` / `AccordionItem` / `AccordionHeader` / `AccordionPanel`, all exported from the
installed `@fluentui/react-components@9.74.3`). `AccordionHeader` renders the chevron on the **left**
by default (`expandIconPosition="start"`) and gives us keyboard/ARIA (`aria-expanded`) for free, so
this is almost entirely a presentational restructure of `SidebarFilters.tsx` with no new prop
surface and no new state to manage.

## Keep it simple

- **No new custom hook / no controlled state.** Fluent's `Accordion` is used **uncontrolled**
  (`defaultOpenItems` seeds "expanded by default"); it owns its own open/closed state internally, so
  there is genuinely no React logic to extract into a `useSidebarFilters` hook. The component stays
  purely presentational. (Surfaced as OQ1 — a reviewer who wants controlled state can say so.)
- **No persistence of collapse state.** Collapse/expand is in-memory only and resets to
  *expanded* on reload — matching the ratified in-memory posture of the resizable-panel work
  (`plans/55/plan.md`). No `localStorage`, no OneDrive, no URL state. (Surfaced as OQ2.)
- **No change to the facet data model or props.** `SidebarFiltersProps`, `facetFilters.ts`, and
  `Organizer`/`useOrganizer` are untouched — this is confined to how `SidebarFilters` lays out the
  groups it is already handed.
- **No hand-rolled collapse/animation.** No manual `useState` + CSS `max-height` transition, no
  custom chevron button — the Fluent `Accordion` supplies chevron, toggle, animation, and ARIA.

## AC coverage

| AC | Status | Where |
|---|---|---|
| End-user can collapse a filter by clicking the chevron icon next to the filter title (expanded by default; click collapses and hides that filter's options; click again re-expands) | covered | Task 1 (Accordion restructure); verified by Task 2 (unit) + Task 3 (E2E). Chevron-left, expanded-by-default, and hide-on-collapse are the `AccordionHeader` default `expandIconPosition="start"` + `defaultOpenItems` + `AccordionPanel` unmount behaviours. |

The story carries a single acceptance criterion; the description adds three concrete sub-behaviours
(chevron to the **left** of the title, **expanded by default**, click **hides the options**) — all
folded into the row above and pinned by tests. Nothing is narrowed or deferred.

## Implementation approach

Restructure **`src/components/SidebarFilters/SidebarFilters.tsx`** so the two `FilterGroup`s render
inside a single Fluent `Accordion`:

- Wrap the groups in `<Accordion multiple collapsible defaultOpenItems={[...]}>`:
  - **`multiple`** — both sections open independently (collapsing Projects must not close Types).
  - **`collapsible`** — allows *all* sections to be closed at once (without it, Fluent forces one
    section to stay open, which would violate "click to collapse" when only one is open).
  - **`defaultOpenItems={['Projects', 'Types']}`** — both expanded on first render (AC "expanded by
    default"). Uncontrolled: the `Accordion` tracks state itself thereafter.
- Turn each `FilterGroup` into an `<AccordionItem value={heading}>` containing:
  - `<AccordionHeader>{heading}</AccordionHeader>` — renders the section title with the chevron to
    its **left** (default `expandIconPosition="start"`; do not override the position). The header is
    the clickable toggle (`aria-expanded`), satisfying "clicking the chevron / title".
  - `<AccordionPanel>` wrapping the existing options markup (the `role="group"` +
    `aria-label` container and the `ToggleButton` rows / "None" placeholder). When the item is
    collapsed, Fluent **unmounts** the panel content, so the options are removed from the DOM —
    exactly the "options are hidden" behaviour.
- Keep the outer `<aside aria-label="Filters">` (the harness loading-gate E2E asserts
  `role="complementary"` name "Filters") and keep the existing `option` / `optionValue` /
  `optionCount` / `empty` styles on the panel contents so the counters, single-line 12px ellipsized
  values, `aria-pressed` selection, and "None" placeholder are all preserved unchanged.
- Preserve each group's accessible grouping: keep `role="group"` + the `aria-label`
  ("Filter by project" / "Filter by type") on the options wrapper inside its `AccordionPanel`.
- The current `<Text as="h2" size={300} weight="semibold">` heading is replaced by
  `AccordionHeader`'s own heading/button. Aim to keep a comparable strong section-title look via
  `AccordionHeader`'s `size` prop (default "medium" is close); no exact pixel match is required (see
  Considerations).

Style adjustments stay within griffel/`makeStyles` + Fluent `tokens` (the repo convention): drop the
now-unused `group`/`groupHeading` rules if the Accordion supplies the spacing, or retain minimal
spacing tokens on the panel. No raw CSS.

## Task breakdown

1. **Restructure `SidebarFilters.tsx` to use the Fluent `Accordion`.**
   *File:* `src/components/SidebarFilters/SidebarFilters.tsx`.
   Import `Accordion`, `AccordionItem`, `AccordionHeader`, `AccordionPanel` from
   `@fluentui/react-components`. Wrap the two groups as described in *Implementation approach*
   (`multiple collapsible defaultOpenItems={['Projects','Types']}`; header = title + default
   left chevron; panel = existing options + `role="group"` aria-labels). Keep `SidebarFiltersProps`
   and all option-row styling/behaviour identical. Reuse Fluent components + `tokens`/`makeStyles`;
   no new hook, no raw CSS.
   *Rules:* `.claude/rules/frontend-architecture.md` (Fluent v9 components & tokens over hand-rolled
   CSS; logic-vs-render split — here there is no logic to hook; sidebar layout invariants & entry
   ordering unchanged).

2. **Update unit tests for the collapsible behaviour.**
   *File:* `src/components/SidebarFilters/SidebarFilters.test.tsx`.
   Keep the existing four tests green (options, counters, `aria-pressed`, `onToggle` callbacks,
   "None" placeholder — all still visible because sections default to expanded). Add tests via the
   existing `renderSidebar` FluentProvider wrapper:
   - both sections' options are visible on initial render (expanded by default);
   - clicking the **Projects** header removes the project options from the DOM while the **Types**
     options remain (collapse hides options; independence via `multiple`);
   - clicking the collapsed **Projects** header again restores its options (re-expand).
   Assert against the header `button` (`name: /Projects/` / `/Types/`) and
   `queryByRole('button', { name: /Alpha/ })` going null when collapsed.
   *Rules:* `.claude/rules/testing.md` (render through `FluentProvider`; keep the suite green; ensure
   new test code is git-tracked). `.claude/rules/frontend-architecture.md` ("what done looks like").

3. **Add an E2E test for the interactive collapse (real browser).**
   *File:* `e2e/harness.spec.ts` (drives the real `Organizer` sidebar via `/harness.html`).
   Add a spec that: loads `/harness.html`; confirms a known project option (e.g. the "Types" facet
   row or a project row) is visible; clicks the **Projects** section header; asserts that section's
   options are no longer visible while the **Types** options still are; clicks again to re-expand.
   Also assert the **chevron sits to the left of the title** by comparing bounding boxes (the expand
   icon's `x` is less than the title text's `x` within the header). This is the visual/interactive
   half of the AC that jsdom cannot see.
   *Rules:* `.claude/rules/testing.md` (visual/interactive acceptance must be exercised in a real
   browser — Playwright — not jsdom alone; reuse the established harness seam rather than a new hack).

## Assumptions & open questions

- **OQ1 — Collapse state ownership.** Use Fluent's `Accordion` **uncontrolled** with
  `defaultOpenItems` (recommended — the story needs only "expanded by default, click to
  collapse", which the uncontrolled component does with zero extra state, keeping `SidebarFilters`
  purely presentational and adding no hook) **or** introduce a controlled `useSidebarFilters` hook
  owning `openItems` (only warranted if you foresee external control/persistence)? Reply A
  (uncontrolled) or B (controlled hook).
- **OQ2 — Persistence of collapse state.** Collapse/expand is **in-memory only and resets to
  expanded on reload** (recommended — mirrors the ratified in-memory posture of the resizable panel,
  `plans/55/plan.md`; the story says nothing about persistence) **or** should collapse state
  **persist across reloads** (would require controlled state + storage, i.e. also picking OQ1-B)?
  Reply A (no persistence) or B (persist).

## Considerations

- **Section-title styling shifts slightly.** Replacing `<Text as="h2" size={300} weight="semibold">`
  with `AccordionHeader` means Fluent's header typography/heading semantics apply instead of the
  current h2. The coder should get as close to the existing semibold section-title look as
  `AccordionHeader`'s `size` prop allows; an exact pixel/weight match is not an acceptance criterion,
  so this is FYI, not a blocker. (If you *do* want a specific heading level/weight, say so on OQ1's
  thread.)
- **`collapsible` is required, not optional.** Without it, Fluent keeps at least one item open; a
  user collapsing the last open section would be blocked. `collapsible` + `multiple` together give
  the "any/all sections independently open or closed" behaviour the story implies.
- **Existing E2E stays valid.** The current harness test "a long filter option stays on one line…"
  relies on the sidebar option being visible; since sections default to **expanded**, it is
  unaffected.

## Testing recommendations

Project has an established test practice (Vitest unit + Playwright E2E, `test` and `e2e` skills), so
tests are expected.

- **Altitude:** component-level unit tests (Vitest, through the `FluentProvider` wrapper) for the
  collapse/expand DOM behaviour, **plus** a Playwright E2E for the interactive/visual acceptance.
- **Must-cover list:**
  - Initial render → both sections expanded, all options present (expanded-by-default).
  - Collapse Projects → project options removed from DOM; Types options unaffected (hide + independence).
  - Re-expand Projects → project options present again.
  - Regression: counters, `aria-pressed` selection, `onSelectProject`/`onToggleType` callbacks, and
    the "None" empty-facet placeholder still work (existing tests, kept green).
  - E2E: chevron rendered to the **left** of each section title; clicking a header toggles that
    section's option visibility in a real browser.

## Definition of done

- [ ] Each filter section (Projects, Types) has a chevron to the **left** of its title and is
      **expanded by default**. (AC / description)
- [ ] Clicking a section's header collapses it and **hides that section's options**; clicking again
      re-expands it. (AC)
- [ ] Sections collapse/expand **independently** (collapsing one leaves the other unchanged). (description)
- [ ] Built with Fluent UI v9 `Accordion` components and `tokens`/`makeStyles` styling — no
      hand-rolled CSS, no new custom hook. (`frontend-architecture.md`)
- [ ] Existing sidebar behaviour intact: item counters, single-line 12px ellipsized option values,
      `aria-pressed` selection, "None" placeholder, and the `aside`/`role="complementary"` "Filters"
      label. (`frontend-architecture.md` / existing tests)
- [ ] New/updated Vitest tests pass and the full `npm run test` suite is green; all new/changed test
      files are git-tracked and included in the PR. (`testing.md`)
- [ ] The interactive/visual acceptance is verified in a real browser via a new Playwright E2E test
      (`npm run test:e2e`), not by jsdom alone. (`testing.md`)
- [ ] Type-checks and builds cleanly (`build` skill); no ESLint errors; Prettier-formatted
      (`lint` skill). (`frontend-architecture.md` "what done looks like")

## Files/areas affected

- `src/components/SidebarFilters/SidebarFilters.tsx` — restructure the two groups into a Fluent
  `Accordion` (chevron-left headers + collapsible panels). **Main change.**
- `src/components/SidebarFilters/SidebarFilters.test.tsx` — add collapse/expand/independence tests;
  keep existing tests green.
- `e2e/harness.spec.ts` — add the real-browser collapse-interaction + chevron-left spec.
- *(No changes to `facetFilters.ts`, `SidebarFiltersProps`, `Organizer`, `useOrganizer`, or
  `harness.tsx` — props and data flow are unchanged.)*
