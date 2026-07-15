# Plan — Story 58: Selected Filter Visualization

## Context

Today the only indication of which sidebar facets are active is the pressed state of the
`ToggleButton`s in the left `SidebarFilters`. When a facet is collapsed (story 57) — or when a
selected type has been narrowed out of the currently-shown type options by a project selection —
the active selection is invisible and, in the latter case, **no longer removable from the sidebar
at all**. This story adds a **`SelectedFilters`** overview that renders each active facet
selection as a labelled, dismissible chip next to the subject search box, giving the user an
always-visible summary and a one-click way to remove any individual filter.

Concretely, for each active sidebar facet the app shows a chip like `Project: Alpha` or
`Type: Build · Failed`, each carrying an `X` that removes just that filter.

## Keep it simple

- **Reuse the existing toolbar; don't lift it out of `EmailList`.** The subject search box already
  lives in `EmailList`'s `toolbar` (`EmailList.tsx:369`). The AC pins the overview "next to the
  search box", so `SelectedFilters` renders in that same toolbar. The selection state lives one
  level up in `useOrganizer`, so we thread the derived chip list + a single remove callback down
  through `Organizer` → `EmailList` as two new props — rather than the much larger refactor of
  hoisting the toolbar/search into `Organizer`.
- **Use Fluent v9's first-class dismissible chip, not a hand-rolled one.** Render the chips with
  `TagGroup` + dismissible `Tag` (`.claude/rules/frontend-architecture.md` — prefer the purpose-built
  Fluent v9 component). No custom pill/badge + button assembly.
- **Non-goals (deliberately out of scope):**
  - **No "Clear all" button.** AC2 asks only for *individual* removal.
  - **The subject search query is not a chip.** It already has its own built-in clear (dismiss)
    button on the `SearchBox`; it is a search, not a facet.
  - **No persistence / URL-sync of the selection.** Selection stays in-memory React state as today.
  - **The organization (customer) tab is out of scope for chips** — ratified at plan review
    (OQ1 resolved, option A): chips are scoped to the sidebar Project/Type facets only.

## AC coverage

| AC | Status | Where |
|---|---|---|
| AC1 — overview of individually selected filter options next to the search box | covered | Task 3 (`SelectedFilters` component) + Task 5 (rendered in the `EmailList` toolbar beside `SearchBox`) |
| AC2 — filter options can be removed individually by clicking the X icon | covered | Task 3 (dismissible `Tag`) → Task 5 (`onRemoveFilter`) → Task 4 (`removeFilter` in `useOrganizer`) |

Both ACs are **covered** — none narrowed or deferred. OQ1 (org-tab chip) does **not** narrow an AC:
the ACs' own examples are `Project:`/`Type:` (sidebar facets); the org tab is a separate open
question about *extending* scope, not a reduction of a stated AC.

## Implementation approach

New component folder `src/components/SelectedFilters/` with three files (the project's per-component
folder + logic/rendering split convention):

- **`selectedFilters.ts`** — pure, React-free derivation. Exports `SelectedFilterChip` and
  `buildSelectedFilters(selectedProject, selectedTypeKeys)` → ordered `SelectedFilterChip[]`.
- **`SelectedFilters.tsx`** — presentational component: given `filters: SelectedFilterChip[]` and
  `onRemove(chip)`, renders a `TagGroup` of dismissible `Tag`s (returns `null` when the list is
  empty, so the toolbar is visually unchanged when nothing is selected).
- **`selectedFilters.test.ts`** + **`SelectedFilters.test.tsx`** — unit + component tests.

Supporting the type label: add **`typeLabelFromKey(key: string): string`** to the existing
`SidebarFilters/facetFilters.ts` (the single authority on the `typeKey`/`typeLabel` string format),
the inverse of `typeKey`. This is required because a **selected type can be absent from the current
`typeOptions`** (a project selection can narrow it out — see Considerations), so we must reconstruct
its label from the key rather than look it up in `typeOptions`.

Wiring (`useOrganizer`): derive `selectedFilters` via `buildSelectedFilters(...)` in a `useMemo`
(derived-during-render, no `setState`-in-effect — story 43 rule), and add a `removeFilter(chip)`
callback that dispatches by `chip.facet` (`project` → clear the project selection; `type` →
`onToggleType(chip.value)`). Expose both on the returned `OrganizerData`. `Organizer` passes them
straight through to `EmailList`, which renders `<SelectedFilters>` in the toolbar next to the
`SearchBox`.

## Data contracts

This change moves data across the `useOrganizer` → `Organizer` → `EmailList` → `SelectedFilters`
module boundaries. The shared shape (TypeScript, the project's language):

```ts
// src/components/SelectedFilters/selectedFilters.ts
export interface SelectedFilterChip {
  /** Stable React key AND the dismiss `value` carried by the Fluent Tag (unique per chip). */
  key: string;
  /** Which sidebar facet this chip represents (drives removal dispatch). */
  facet: 'project' | 'type';
  /** The facet value to remove: the project string, or the `typeKey` for a type. */
  value: string;
  /** Display text, e.g. "Project: Alpha" or "Type: Build · Failed". */
  label: string;
}

export function buildSelectedFilters(
  selectedProject: string | null,
  selectedTypeKeys: ReadonlySet<string>,
): SelectedFilterChip[];
```

- **Ordering:** project chip (if any) **first**, then type chips ordered **alphabetically
  (case-insensitive) by label** — consistent with the "fixed entry first, then alphabetical"
  facet-ordering invariant in `.claude/rules/frontend-architecture.md`.
- **Label format:** `Project: <project>` and `Type: <typeLabelFromKey(key)>` — matches the AC's
  own examples ("Project: XXX, Type: ABC"). `<project>` is the verbatim project string (may be a
  GUID for an unresolved project — shown as-is, consistent with the categorization rules).
- **`key`/`value`:** for a project chip, `key = value = 'project:' + project`? No — `value` must be
  the raw project string the remover consumes; `key` is `` `project` `` (only one project can be
  selected, so it is unique). For a type chip, `key = value = typeKey`.

New `EmailList` props (added to `EmailListProps`):

```ts
selectedFilters: SelectedFilterChip[];
onRemoveFilter: (chip: SelectedFilterChip) => void;
```

`OrganizerData` (the `useData` seam type) gains `selectedFilters: SelectedFilterChip[]` and
`removeFilter: (chip: SelectedFilterChip) => void` (it is `ReturnType<typeof useOrganizer>`, so it
updates automatically — but every mock of it, i.e. the harness, must supply the new fields).

## Task breakdown

1. **`facetFilters.ts` — add `typeLabelFromKey`.** In `src/components/SidebarFilters/facetFilters.ts`
   add `typeLabelFromKey(key: string): string` (split on the **first** `::`, join with ` · ` so it
   is the exact inverse of `typeKey`/`typeLabel`). Add a round-trip unit test to
   `facetFilters.test.ts` (`typeLabelFromKey(typeKey(t)) === typeLabel(t)`).
   *Rules: `.claude/rules/frontend-architecture.md` (pure React-free helper stays colocated in
   `SidebarFilters`), `.claude/rules/testing.md`.*

2. **`selectedFilters.ts` — pure chip derivation.** Create
   `src/components/SelectedFilters/selectedFilters.ts` with `SelectedFilterChip` +
   `buildSelectedFilters` (reusing `typeLabelFromKey`). Create `selectedFilters.test.ts` covering:
   no selection → `[]`; project only → one `Project: …` chip; types only → chips per type sorted by
   label; both → project first then sorted types; **a selected type whose key would not appear in
   `typeOptions` still yields a correctly-labelled chip** (proves reconstruction, not lookup).
   *Rules: `.claude/rules/frontend-architecture.md` (pure derivation helper in its own colocated,
   non-`use*` file), `.claude/rules/testing.md`.*

3. **`SelectedFilters.tsx` — presentational component.** Create the component: props
   `{ filters: SelectedFilterChip[]; onRemove: (chip: SelectedFilterChip) => void }`. Render a
   Fluent `TagGroup` whose `onDismiss={(_e, { value }) => onRemove(chipByValue)}` maps back to the
   chip; each `Tag` is `dismissible` with `value={chip.key}` and text `{chip.label}`. Return `null`
   when `filters` is empty. Give the group an accessible label (e.g. `aria-label="Active filters"`).
   Create `SelectedFilters.test.tsx` (mounted through `FluentProvider` + `webLightTheme` per the
   testing rule): renders the expected chip labels; clicking a chip's dismiss button calls
   `onRemove` with the matching chip; renders nothing when `filters` is empty.
   *Rules: `.claude/rules/frontend-architecture.md` (Fluent v9 first-class `TagGroup`/`Tag`;
   component renders, no business logic inline), `.claude/rules/testing.md` (provider-wrapped
   component test).*

4. **`useOrganizer` — derive `selectedFilters` + `removeFilter`.** In
   `src/components/Organizer/useOrganizer.ts` add `const selectedFilters = useMemo(() =>
   buildSelectedFilters(selectedProject, selectedTypeKeys), [selectedProject, selectedTypeKeys])`
   and a `removeFilter` `useCallback` that dispatches by `facet` (`project` → `setSelectedProject(null)`;
   `type` → reuse `onToggleType(chip.value)`). Return both. Extend `useOrganizer.test.ts`:
   `removeFilter` on a project chip clears the project; `removeFilter` on a type chip removes just
   that key and leaves the other selected types intact.
   *Rules: `.claude/rules/frontend-architecture.md` (selection logic in the hook; derived value via
   `useMemo`, not effect+setState), `.claude/rules/testing.md`.*

5. **Render in the `EmailList` toolbar + pass props through `Organizer`.** Add `selectedFilters` and
   `onRemoveFilter` to `EmailListProps`; in the `toolbar` (`EmailList.tsx:369`) wrap the `SearchBox`
   and `<SelectedFilters filters={selectedFilters} onRemove={onRemoveFilter} />` in a left-aligned
   group so the chips sit **next to** the search box while the bulk-Delete button stays pinned right
   (adjust the `toolbar`/add a small `makeStyles` group as needed; let the group wrap on narrow
   widths). Update `Organizer.tsx` to pull `selectedFilters`/`removeFilter` from `useData()` and pass
   them to `<EmailList>`. Update `EmailList.test.tsx`'s `renderList` helper to default the two new
   props (`selectedFilters: []`, `onRemoveFilter: vi.fn()`).
   *Rules: `.claude/rules/frontend-architecture.md` (layout invariants; logic stays in hook),
   `.claude/rules/testing.md`.*

6. **Update the harness mock + add a seeded `filtered` state for the screenshot.** In
   `src/harness.tsx` add the new `OrganizerData` fields to `mockData` (`selectedFilters`,
   `removeFilter`). Add a `?state=filtered` variant that seeds `selectedProject` and one
   `selectedTypeKeys` entry, sets `filtered` to the matching subset, and populates `selectedFilters`
   via `buildSelectedFilters(...)` — so the harness renders the chips deterministically for the
   screenshot/E2E. Leave the default (no-`state`) harness view unchanged so existing E2E specs are
   unaffected.
   *Rules: `.claude/rules/testing.md` (drive screenshots/E2E only through the `useData` mock seam).*

7. **E2E presence/position assertion + committed screenshot.** In `e2e/harness.spec.ts` (or a new
   `e2e/selected-filters.spec.ts`) add a test that navigates to `/harness.html?state=filtered`,
   asserts the `Project:`/`Type:` chips are visible and positioned **to the right of** the search
   box (compare `boundingBox().x`), and captures `page.screenshot({ path:
   'e2e/screenshots/58/selected-filters.png' })`. Confirm the PNG is **git-tracked**.
   *Rules: `.claude/rules/testing.md` (real-browser verification for visual/layout acceptance;
   committed harness-seam screenshot under `e2e/screenshots/<id>/`).*

## Assumptions & open questions

_No open questions remain._

- **OQ1 (RESOLVED — option A, plan review) — chip scope.** Ratified: the removable chips are scoped
  to the sidebar **Project/Type** facets only; the active organization (customer) tab is **not**
  rendered as a chip. Rationale: the AC's own examples are `Project:`/`Type:`, and the org tab is a
  distinct top-level mechanism that always holds a value and resets to "All" rather than being
  removed to nothing. (Recorded for living-doc history; no further action.)

## Considerations

- **A selected type can be narrowed out of the sidebar's type options.** Because type options are
  derived from the org ∩ *selected-project* set, selecting a project can remove an
  already-selected type from the sidebar's Types list — leaving that type active but with **no
  sidebar toggle to switch it off**. This is exactly why the chip label is **reconstructed from the
  `typeKey`** (`typeLabelFromKey`) rather than looked up in `typeOptions`, and it makes the chip the
  *only* way to remove such a filter — a point in the feature's favour. (FYI; no alternative to
  choose.)
- **The empty-list toolbar branch is unreachable while a facet is active.** `EmailList` hides its
  toolbar only in the `emails.length === 0` branch (`EmailList.tsx:362`). The facets are
  cross-filtered so any active Project/Type selection always yields ≥1 e-mail; thus an active filter
  never coincides with the toolbar-less empty branch, and the chips are always reachable for
  removal. (FYI; monitored, not a blocker.)
- **No new Graph scope, no categorization change.** This is a pure presentation/selection feature
  over already-categorized, already-in-memory data — no auth or categorization-domain impact.

## Testing recommendations

The project has an established test practice — **Vitest** unit/component tests and **Playwright**
E2E (`.claude/rules/testing.md`, `.claude/skills/test`, `.claude/skills/e2e`). Follow it:

- **Unit (pure logic) — the primary altitude:**
  - `facetFilters.test.ts`: `typeLabelFromKey` round-trips `typeKey`/`typeLabel`.
  - `selectedFilters.test.ts`: `buildSelectedFilters` — **empty selection → `[]`**; project-only →
    single `Project: <name>` chip; types-only → one chip per type, **sorted by label**; project +
    types → **project chip first**, then sorted type chips; **a type key not present in any
    `typeOptions` still produces a correct `Type: …` label** (reconstruction, not lookup).
- **Component (jsdom, provider-wrapped):**
  - `SelectedFilters.test.tsx`: renders the expected chip labels; clicking a chip's **dismiss (X)**
    calls `onRemove` with the matching chip; **empty `filters` → renders nothing**.
  - `useOrganizer.test.ts`: `removeFilter` on a project chip → project cleared; on a type chip →
    only that key removed, others retained.
- **E2E / real-browser (required — acceptance is visual/positional):** `harness.spec.ts` (or a new
  spec) asserts the chips are visible and positioned next to the search box at
  `/harness.html?state=filtered`, and commits `e2e/screenshots/58/selected-filters.png`. jsdom
  cannot verify the "next to the search box" layout claim, so this real-browser check is
  mandatory, not optional.
- **Must-cover (beyond what the ACs already state):** empty-selection → no chips rendered (no stray
  empty `TagGroup`); reconstruction of a type label for a type absent from `typeOptions`.

## Definition of done

- [ ] AC1 — active Project/Type selections render as labelled chips next to the subject search box
      (verified in a real browser via the harness screenshot).
- [ ] AC2 — each chip's `X` removes exactly that one filter (project chip clears the project; type
      chip removes only that type) — covered by component + `useOrganizer` tests.
- [ ] Chips use Fluent v9 `TagGroup`/`Tag` (dismissible), not a hand-rolled control
      (`.claude/rules/frontend-architecture.md`).
- [ ] Chip label format is `Project: <name>` / `Type: <category · subType>`, ordered project-first
      then alphabetical (case-insensitive) by label.
- [ ] `buildSelectedFilters` and `typeLabelFromKey` are pure, colocated, non-`use*` helpers with
      unit tests; selection logic (`removeFilter`) lives in `useOrganizer`, not JSX.
- [ ] `SelectedFilters` returns nothing when no filter is selected (toolbar unchanged).
- [ ] Type-checks and builds cleanly; no ESLint errors; Prettier-formatted (`.claude/skills/lint`,
      `.claude/skills/build`).
- [ ] Full Vitest suite passes (`npm run test`), including the updated `EmailList`/`useOrganizer`
      tests and the new `SelectedFilters`/`selectedFilters`/`facetFilters` tests.
- [ ] A committed, git-tracked Playwright screenshot exists at
      `e2e/screenshots/58/selected-filters.png`, taken through the `?state=filtered` harness seam,
      and is referenced from the code PR description (`.claude/rules/testing.md`).
- [ ] All new/required source and test files are git-tracked (nothing the change needs is left
      untracked).

## Files/areas affected

- `src/components/SelectedFilters/selectedFilters.ts` **(new)**
- `src/components/SelectedFilters/selectedFilters.test.ts` **(new)**
- `src/components/SelectedFilters/SelectedFilters.tsx` **(new)**
- `src/components/SelectedFilters/SelectedFilters.test.tsx` **(new)**
- `src/components/SidebarFilters/facetFilters.ts` (add `typeLabelFromKey`)
- `src/components/SidebarFilters/facetFilters.test.ts` (round-trip test)
- `src/components/Organizer/useOrganizer.ts` (`selectedFilters`, `removeFilter`)
- `src/components/Organizer/useOrganizer.test.ts` (removeFilter tests)
- `src/components/Organizer/Organizer.tsx` (pass the two props through)
- `src/components/EmailList/EmailList.tsx` (toolbar: render `SelectedFilters`; new props)
- `src/components/EmailList/EmailList.test.tsx` (`renderList` default props)
- `src/harness.tsx` (new `OrganizerData` fields; `?state=filtered` seeded selection)
- `e2e/harness.spec.ts` or `e2e/selected-filters.spec.ts` **(new/updated)** (assertion + screenshot)
- `e2e/screenshots/58/selected-filters.png` **(new, committed)**
