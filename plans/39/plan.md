# Plan — Story 39: Project and Type facet filters

## Context
The app triages a daily flood of Azure DevOps notification e-mails
(`.claude/rules/categorization-domain.md`). Story 37 (*done*) added the pure categorization engine:
on load the app fetches every raw Graph `Message` from the `DevOps` folder and tags each into a
`(Customer, Project, Type)` triple. Story 38 (*done*) added the **organization tab strip**
(`CustomerTabs`) under the top bar and a permanent `Organizer` container that owns the
`selectedCustomer` state, derives the filtered set, and feeds the temporary `MailDebug` visualizer.

**This story adds the left sidebar's two facet filters — Project and Type** — the
"Left sidebar filters by project and/or type; each entry shows an item counter" invariant in
`.claude/rules/frontend-architecture.md`. They are **facet filters** layered on top of the
organization tab:

- **Project filter — single-value.** One project selectable at a time. Clicking the selected
  project deselects it; clicking a different one replaces the selection. Its options are
  pre-filtered by the selected organization **and** the selected types.
- **Type filter — multi-value.** Any number of types selectable. Clicking a type toggles it.
  Its options are pre-filtered by the selected organization **and** the selected project.
- Every option shows a **count** of available e-mails. Nothing selected → that facet applies no
  filter. **Switching organization tabs clears both facet selections.**

The three filters compose: the displayed e-mail set = organization ∩ project ∩ types. As in
story 38, there is still no real center list view, so the sidebar filters **what `MailDebug`
renders** (its cards **and** its raw `<pre>`); the real list view is a later story (see *Keep it
simple*).

## Keep it simple
- **List view stays `MailDebug`.** This story is the *sidebar*, not the center list view. Despite
  the forward-looking comment in `Organizer.tsx` ("#39 swaps that for the real list view"), story
  39's actual scope is the facet filters. `MailDebug` remains the (temporary) view surface and the
  sidebar simply narrows what it shows — exactly the seam story 38 established. Replacing
  `MailDebug` with a real list view is out of scope here.
- **Selection state stays in `Organizer`, no context / data-library.** `useOrganizer` already owns
  `selectedCustomer` and derives `filtered`; it grows to own `selectedProject` and `selectedTypes`
  and the composed filtering. No React Context, no store, no TanStack Query — the "state approach"
  in `frontend-architecture.md` is still deliberately undecided and local state + props suffice at
  this depth (same call story 38 made).
- **Pure derivation, no engine changes.** The sidebar consumes the engine's `project`/`type` tags
  **verbatim** and never re-derives them (`categorization-domain.md`). No GUID→name work: a project
  that resolves to a GUID is just another `project` string and gets its own option like any other.
- **No new dependencies.** The option rows use Fluent v9's `ToggleButton` + `CounterBadge`, both
  already in `@fluentui/react-components`.
- **No overflow/virtualization/responsive engineering.** With the bounded ~100-e-mail demo set the
  distinct project/type counts are small; a plain vertical stack of toggle buttons is enough.
- **No persisted or URL-encoded filter state.** Selections are in-memory React state only, reset on
  tab switch — nothing is written to storage or the URL.

## Implementation approach
Add a **presentational `SidebarFilters`** component in its own folder with a colocated
**`useSidebarFilters.ts`** that holds the **pure, unit-testable** derivation/filtering helpers —
the same split story 38 used (`CustomerTabs` presentational, `deriveCustomerTabs` pure in the hook
file). All selection *state* and the *composition* of the three filters live in the existing
`Organizer` container, so there is one source of the final `filtered` set.

**Facet model (the crux).** Let `orgBase` = the categorized set filtered by `selectedCustomer`
(today's `filtered` in `useOrganizer`, renamed). Then, so each facet's options reflect the *other*
active facet but not itself:

- **Project options** = `deriveProjectOptions(filterByTypes(orgBase, selectedTypes))` — distinct
  projects among e-mails matching the selected types, each with its count.
- **Type options** = `deriveTypeOptions(filterByProject(orgBase, selectedProject))` — distinct
  types among e-mails matching the selected project, each with its count.
- **Displayed set** (fed to `MailDebug`) =
  `filterByTypes(filterByProject(orgBase, selectedProject), selectedTypes)` — org ∩ project ∩ types.

`filterByProject(emails, null)` and `filterByTypes(emails, emptySet)` are identity (no selection →
no filter), so counts and options degrade correctly to the org-only set. Because type options are
always constrained by the selected project (and vice-versa), the selections stay mutually
consistent by construction and never strand the user on an empty list.

**Component.** `SidebarFilters.tsx` renders two labelled groups (Projects, Types), each a vertical
stack of Fluent `ToggleButton`s (one per option) with a trailing `CounterBadge`. `ToggleButton`'s
`checked`/`aria-pressed` gives the required visual selection indication and its click handler makes
"click the selected option to deselect it" natural for **both** facets (a native `Radio` can't
deselect on re-click, which is why `ToggleButton` is used for the single-value project facet too).
Styling via `makeStyles`/`tokens` only.

**Selection logic in `useOrganizer`.**
- `selectedProject: string | null` (default `null`), `selectedTypes: Set<string>` of **type keys**
  (default empty).
- `selectProject(value)`: if `value === selectedProject` → `null` (deselect); else `value`
  (single-value replace).
- `toggleType(key)`: add/remove `key` from the set (multi-value).
- `selectCustomer(value)`: sets `selectedCustomer` and, when the value actually changes, resets
  `selectedProject = null` and `selectedTypes = new Set()` (the "switching tabs clears filters" AC).
  This wraps the setter `CustomerTabs` already receives.
- Memoise `projectOptions`, `typeOptions`, and the displayed `filtered` per the facet model above.

**Layout.** `Organizer.tsx` keeps `CustomerTabs` on top, then renders a **horizontal** flex row:
`SidebarFilters` on the left (fixed-ish width) and `MailDebug` filling the rest. A small
`makeStyles` block on the container; no change to the top-bar/tabs invariants.

## Data contracts
Module boundary — `SidebarFilters` props and the pure helpers. The mismatch this section exists to
prevent is the **type identity**: the multi-select set stores a **string key** derived from the
`MessageType` object, and every producer/consumer must use the *same* `typeKey`.

```ts
// Colocated in src/components/SidebarFilters/useSidebarFilters.ts

// Stable string identity for a MessageType (objects can't be Set members / compared by value).
export function typeKey(type: MessageType): string;   // `${type.category}::${type.subType}`
export function typeLabel(type: MessageType): string;  // `${type.category} · ${type.subType}` (matches MailDebug badge)

// One selectable facet row: the value to toggle on, its display label, its e-mail count.
export interface FilterOption {
  value: string; // a project string (verbatim), or a typeKey for the type facet
  label: string; // project string; or typeLabel(...) for the type facet
  count: number; // # e-mails in the (cross-faceted) input set matching this option
}

// Pure, deterministic, React-free — count + order the options from an already-faceted set.
export function deriveProjectOptions(emails: CategorizedEmail[]): FilterOption[]; // alpha, UNCATEGORIZED last
export function deriveTypeOptions(emails: CategorizedEmail[]): FilterOption[];    // by label (localeCompare)

// Pure filters; empty selection is identity.
export function filterByProject(emails: CategorizedEmail[], project: string | null): CategorizedEmail[];
export function filterByTypes(emails: CategorizedEmail[], selectedTypeKeys: ReadonlySet<string>): CategorizedEmail[];

export interface SidebarFiltersProps {
  projectOptions: FilterOption[];
  selectedProject: string | null;         // matches a projectOptions[].value, or null
  onSelectProject: (value: string) => void; // fires with the clicked option's value (project string)
  typeOptions: FilterOption[];
  selectedTypeKeys: ReadonlySet<string>;   // typeKeys currently selected
  onToggleType: (key: string) => void;     // fires with the clicked option's value (a typeKey)
}
```

`UseCategorizedMailResult` (the shared `src/hooks/useCategorizedMail.ts`) is **unchanged**;
`MailDebugProps` is **unchanged** (it still receives the final filtered `CategorizedEmail[]`).
`useOrganizer`'s returned shape gains `projectOptions`, `typeOptions`, `selectedProject`,
`selectedTypeKeys`, `onSelectProject`, `onToggleType`, and swaps `setSelectedCustomer` for the
clearing `selectCustomer` wrapper (still passed to `CustomerTabs` as `onSelect`).

## Task breakdown
1. **Add pure facet helpers in `src/components/SidebarFilters/useSidebarFilters.ts`.** `typeKey`,
   `typeLabel`, `deriveProjectOptions` (distinct projects, alphabetical case-insensitive,
   `UNCATEGORIZED` pinned last — reuse the `UNCATEGORIZED` constant from
   `src/models/categorization.ts`, do not hardcode), `deriveTypeOptions` (distinct types ordered by
   `typeLabel` via `localeCompare`), `filterByProject`, `filterByTypes` (empty selection = identity).
   *Rules: `frontend-architecture.md` (logic in the hook/service layer, not JSX; reuse utilities),
   `categorization-domain.md` (consume `project`/`type` tags verbatim; never re-derive).*
2. **Add the presentational `SidebarFilters.tsx`.** Two `makeStyles`-styled groups (Projects, Types)
   each rendering `ToggleButton`s (`checked` from selection, `onClick` → the callback) with a
   trailing `CounterBadge` (`showZero`). No derivation inline — consumes `SidebarFiltersProps`.
   *Rules: `frontend-architecture.md` (own folder, presentational component + colocated hook, Fluent
   components/tokens over hand-rolled CSS; left-sidebar-with-counters layout invariant).*
3. **Grow `useOrganizer` to own the facet selections + composition.** Add `selectedProject`/
   `selectedTypes` state, the `selectProject`/`toggleType` handlers, the `selectCustomer` wrapper
   that clears both on a real tab change, and memoised `projectOptions`/`typeOptions`/`filtered`
   using the task-1 helpers per the facet model. *Rules: `frontend-architecture.md` (logic in the
   hook not JSX; bounded in-memory set, no re-fetch), `categorization-domain.md` (filter over the
   already-tagged set in memory).*
4. **Wire the sidebar + layout into `Organizer.tsx`.** Render `CustomerTabs` (unchanged, fed full
   `categorized`), then a horizontal flex row of `SidebarFilters` (fed the option lists + selection
   + handlers) and `MailDebug` (fed the composed `filtered` set). Pass `selectCustomer` as
   `CustomerTabs`' `onSelect`. *Rules: `frontend-architecture.md` (UI layout invariants: fixed top
   bar, tabs across the top, left sidebar, center view; logic/rendering split).*
5. **Tests.** `useSidebarFilters.test.ts` for the pure helpers (ordering, counts, `UNCATEGORIZED`
   last, empty-set, identity filters, `typeKey`/`typeLabel`); `SidebarFilters.test.tsx` rendering
   through the `FluentProvider`/`webLightTheme` wrapper (options + counters render, `checked`
   reflects selection, clicking fires the right callback with the right value); a
   `useOrganizer.test.ts` (`renderHook`) covering single-value replace/deselect, multi-value toggle,
   the facet interdependence (selecting a type narrows project options/counts and vice-versa), and
   clear-on-tab-switch. *Rules: `testing.md` (Vitest; test pure logic directly; render component
   tests through the provider wrapper).*
6. **Verify done.** `npm run build`, `npm run lint`, `npm run format:check`, `npm run test` all
   clean. *Rules: `frontend-architecture.md` ("what done looks like"), `testing.md`.*

## Assumptions & open questions
- **Facet counts are cross-faceted, not org-only.** Each project option's count reflects the set
  after applying the selected **types** (and each type option's count reflects the selected
  **project**), so selecting one facet updates the other's counts. I chose this over showing
  org-only counts because AC says options are "already filtered based on the selected
  organizations and/or types" and "the count of available e-mails" reads as availability under the
  current cross-selection. Reviewer may prefer org-only counts (options hidden, but counts fixed to
  the tab total).
- **A selected type that becomes unavailable after a project is chosen stays selected (no
  auto-prune).** Selecting types then a project can leave a selected type absent from the (now
  project-narrowed) type options, so its toggle isn't rendered until the project is deselected. I
  keep the selection intact (the composed filter stays correct and non-empty) rather than silently
  mutating the user's selection. Reviewer may prefer auto-pruning selected types to the available
  set.
- **List view stays `MailDebug`; the real center list view is a separate later story.** Story 39 is
  scoped to the sidebar only, filtering the existing debug surface — despite the forward-looking
  `Organizer.tsx` comment that "#39 swaps that for the real list view". Reviewer may want the list
  view built here instead.
- **`ToggleButton` is used for both facets (including single-value project) rather than
  `RadioGroup` + `Checkbox`.** This is because a native radio can't be deselected by re-clicking
  the selected item, which AC requires. Reviewer may prefer radios/checkboxes with custom deselect
  handling for stronger semantics.
- **Type options are ordered alphabetically by `typeLabel` (`localeCompare`), not by the taxonomy
  order** of the `MessageType` union (Work item → Pull request → Build → Release → Other). Alpha is
  simplest and deterministic; reviewer may prefer the taxonomy order for a more intuitive grouping.

## Considerations
- **Bounded, in-memory set.** Derivation, counting, and the three-way composition run over the
  already-fetched ≤~100-e-mail set with no re-fetch; all memoised, recomputation is trivial
  (`frontend-architecture.md`).
- **Type identity via `typeKey`.** `MessageType` is an object, so it can't be a `Set` member or
  compared by reference; every place that stores/compares a selected type routes through the single
  `typeKey` helper — the one spot a mismatch would break filtering.
- **Accessibility trade-off of `ToggleButton` for the project facet.** It is a toggle
  (`aria-pressed`) rather than a radio group; acceptable given the click-to-deselect requirement,
  noted so the reviewer is aware of the semantic choice.
- **`Uncategorized`/GUID projects surface as ordinary options** (visibility over silent grouping),
  consistent with how story 38 surfaces the `Uncategorized` organization tab.

## Testing recommendations
The project has an established test practice (Vitest, `npm run test`; `testing.md` requires the
categorization/derivation logic be unit-tested and component tests be mounted through the provider
wrapper), so this story ships tests.

- **Altitude:** unit tests for the pure helpers in `useSidebarFilters.ts`; one component/behavioral
  test for `SidebarFilters` through `FluentProvider` + `webLightTheme`; a hook test
  (`renderHook`) for `useOrganizer`'s selection/facet behavior.
- **Must-cover:**
  - `deriveProjectOptions([])` → `[]`; `deriveTypeOptions([])` → `[]` (never throws, no phantom
    "All" row — the sidebar has no "All" option).
  - `deriveProjectOptions` orders projects alphabetically (case-insensitive) with `UNCATEGORIZED`
    pinned **last** even when another project (e.g. `Zzz`) sorts after it; counts are correct.
  - `deriveTypeOptions` yields one option per distinct `(category, subType)` with the right count,
    ordered by `typeLabel`.
  - `filterByProject(emails, null)` and `filterByTypes(emails, new Set())` → return the input
    unchanged (identity); non-empty selections keep only matching e-mails.
  - `useOrganizer`: selecting an already-selected project deselects it; selecting a different
    project **replaces** (single value); toggling types adds/removes (multi value); selecting a
    type narrows the **project** options/counts and selecting a project narrows the **type**
    options/counts (facet interdependence); switching organization tabs clears both selections.
  - `SidebarFilters` renders one row per option with its counter, reflects the current selection as
    `checked`/pressed, and fires `onSelectProject`/`onToggleType` with the clicked option's `value`.

## Definition of done
- [ ] A left sidebar renders (under the tabs) with two facet groups: **Projects** and **Types**,
      each option showing an e-mail **count** (`frontend-architecture.md` layout invariant).
- [ ] **Project** is single-value: selecting a project filters the list and is visually indicated;
      clicking it again deselects; selecting a different one replaces the selection (AC §2).
- [ ] **Type** is multi-value: clicking a type toggles it (added/removed), with visual indication;
      multiple types can be active at once (AC §3).
- [ ] Project options are pre-filtered by the selected organization **and** selected types; type
      options are pre-filtered by the selected organization **and** selected project; nothing
      selected in a facet applies no filter (AC §2/§3).
- [ ] The displayed set (cards **and** the raw `<pre>` in `MailDebug`) reflects organization ∩
      project ∩ types.
- [ ] Switching organization tabs clears both facet selections (AC final bullet).
- [ ] `SidebarFilters` is its own folder with a colocated `useSidebarFilters` hook; all derivation/
      filtering lives in pure exported functions, not inline in JSX; selection state + composition
      live in `Organizer`/`useOrganizer` (`frontend-architecture.md`).
- [ ] Options consume the engine's `project`/`type` tags verbatim; no re-categorization and no
      engine changes (`categorization-domain.md`).
- [ ] New tests cover the pure helpers, a `SidebarFilters` render/interaction test through the
      `FluentProvider` wrapper, and a `useOrganizer` hook test (single/multi/facet/clear); the full
      `npm run test` suite passes (`testing.md`).
- [ ] Type-checks and builds cleanly (`npm run build`); no ESLint errors and Prettier-clean
      (`npm run lint`, `npm run format:check`).
- [ ] No new dependencies; no persistence/backend/URL state introduced (`frontend-architecture.md`).

## Files/areas affected
- `src/components/SidebarFilters/useSidebarFilters.ts` — **new** (`typeKey`, `typeLabel`,
  `deriveProjectOptions`, `deriveTypeOptions`, `filterByProject`, `filterByTypes`, `FilterOption`).
- `src/components/SidebarFilters/SidebarFilters.tsx` — **new** (presentational two-group toggle
  list with counters).
- `src/components/SidebarFilters/useSidebarFilters.test.ts` — **new** (pure helper tests).
- `src/components/SidebarFilters/SidebarFilters.test.tsx` — **new** (render/interaction via
  provider wrapper).
- `src/components/Organizer/useOrganizer.ts` — **edit** (own `selectedProject`/`selectedTypes`;
  `selectProject`/`toggleType`/`selectCustomer` handlers; memoised options + composed `filtered`).
- `src/components/Organizer/useOrganizer.test.ts` — **new** (selection/facet/clear behavior via
  `renderHook`).
- `src/components/Organizer/Organizer.tsx` — **edit** (horizontal layout: `SidebarFilters` left,
  `MailDebug` right; pass `selectCustomer` to `CustomerTabs`).
</content>
</invoke>
