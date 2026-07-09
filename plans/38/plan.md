# Plan — Story 38: Organization tabs

## Context
The app triages a daily flood of Azure DevOps notification e-mails
(`.claude/rules/categorization-domain.md`). Story 37 (*done*) added the categorization engine: on
load the app fetches every raw Graph `Message` from the `DevOps` folder and tags each into a
`(Customer, Project, Type)` triple, where **Customer = the ADO organization**. Today that output is
shown only through the **temporary** `MailDebug` component — categorized cards on the left, the raw
Graph JSON in a `<pre>` on the right.

**This story adds the organization tabs:** a horizontal tab strip under the top bar with an **"All"**
tab plus one tab per distinct organization, each showing a **counter** of how many e-mails fall under
it. Selecting a tab **filters** the displayed e-mail set to that organization; "All" (the default)
shows everything. This is the first slice of the "Customer tabs across the top… each tab shows an
item counter" layout invariant in `.claude/rules/frontend-architecture.md`.

Because there is no real list view yet, the story explicitly targets the existing debug surface: the
tabs filter what `MailDebug` renders (the cards **and** the raw `<pre>`). The real list view that
replaces `MailDebug` is the successor story (#39); the permanent, reusable pieces built here — the
`CustomerTabs` component and its pure tab-derivation logic — survive that transition unchanged.

## Keep it simple
- **No dedicated permanent container / state store.** The selected-tab state and the fetch+
  categorize data stay in the existing `useMailDebug` hook; `MailDebug` renders `CustomerTabs` above
  its columns. This is transitional wiring that dies with `MailDebug` in #39. We do **not** stand up a
  new `OrganizerView`/context/data-library layer now — that is #39's job and would be speculative here
  (see open question below).
- **No project/type sidebar, no real list view.** AC and the frontend rule also call for a left
  sidebar (project/type) and a center list; those are **not** this story. Only the organization tab
  strip and the filtering of the current debug display are in scope.
- **No GUID→name work, no re-categorization.** Tabs consume the already-tagged `customer` field
  verbatim; no engine changes. `Uncategorized` is just another organization value and gets its own
  tab like any other.
- **No new dependencies.** Tabs use Fluent UI v9's `TabList`/`Tab` (+ a counter badge) already in
  `@fluentui/react-components`.
- **No overflow/responsive engineering.** With the bounded ~100-e-mail demo set the distinct-org
  count is small; a plain horizontal `TabList` is enough. No custom overflow menu is built.

## Implementation approach
Add a **`CustomerTabs`** component in its own folder with a colocated **`useCustomerTabs`** hook —
exactly the pattern named in `.claude/rules/frontend-architecture.md`. Keep it a **controlled,
presentational** component: it receives the full categorized set plus the current selection and an
`onSelect` callback, and renders a Fluent `TabList`. All derivation (distinct organizations, counts,
"All" tab, ordering) lives in a **pure exported function `deriveCustomerTabs`** in the hook file, so
it is unit-testable without React and never sits inline in JSX.

Then extend the existing temporary surface to drive and consume the selection:
- `useMailDebug` gains a `selectedCustomer` state (default = the "All" sentinel) and exposes it, a
  setter, and a **filtered** view of the categorized set (`selected === ALL ? all : all.filter(e =>
  e.customer === selected)`).
- `MailDebug` renders `<CustomerTabs emails={categorized} selectedCustomer={…} onSelect={…} />`
  above its two columns, and drives **both** columns from the filtered set — the cards from the
  filtered emails and the raw `<pre>` from `filtered.map((e) => e.message)`. Because the engine emits
  exactly one `CategorizedEmail` per message and never drops one, the "All" view reproduces the full
  raw set unchanged.

Counters use Fluent's `CounterBadge` (with `showZero`) inside each `Tab`; the "All" tab's count is
the total.

## Data contracts
Module boundary — `CustomerTabs` props (the contract a mismatch here would break is selection
round-tripping between the tab strip and the filter):

```ts
// The sentinel identifying the "All" tab. A string unlikely to collide with a real ADO org name.
export const ALL_CUSTOMERS = '__all__';

export interface CustomerTab {
  value: string; // ALL_CUSTOMERS for the All tab; otherwise the exact `customer` string
  label: string; // 'All' for the All tab; otherwise the organization name (the `customer` value)
  count: number; // All → total emails; otherwise emails whose `customer === value`
}

export interface CustomerTabsProps {
  emails: CategorizedEmail[]; // the full (unfiltered) categorized set — counts derive from this
  selectedCustomer: string; // ALL_CUSTOMERS or a customer value; must match a rendered tab's value
  onSelect: (value: string) => void; // receives the selected tab's `value` (ALL_CUSTOMERS or a customer)
}
```

`deriveCustomerTabs(emails: CategorizedEmail[]): CustomerTab[]` → always returns the "All" tab first
(count = `emails.length`), then one tab per **distinct** `customer` sorted alphabetically, count =
occurrences. `onSelect`'s emitted `value` and `useMailDebug`'s `selectedCustomer`/filter comparison
must use the **same** `customer` strings and the same `ALL_CUSTOMERS` sentinel.

## Task breakdown
1. **Add the `CustomerTabs` component + `useCustomerTabs` hook + `deriveCustomerTabs`.** New folder
   `src/components/CustomerTabs/` with `CustomerTabs.tsx` (renders `TabList`/`Tab` + `CounterBadge`,
   controlled via `selectedValue`/`onTabSelect`) and `useCustomerTabs.ts` (exports the pure
   `deriveCustomerTabs`, the `ALL_CUSTOMERS` sentinel, and a `useCustomerTabs(emails)` hook that
   `useMemo`s the derivation). *Rules: `frontend-architecture.md` (own folder, logic in a hook not
   JSX, Fluent components/tokens), `categorization-domain.md` (Customer = ADO organization; consume
   tags, never re-derive).*
2. **Wire selection + filtering into the debug surface.** In `useMailDebug` add `selectedCustomer`
   state (default `ALL_CUSTOMERS`), a setter, and a memoised filtered set; in `MailDebug.tsx` render
   `<CustomerTabs>` above the columns and feed both the cards and the `<pre>` from the filtered set
   (`filtered.map((e) => e.message)` for the raw JSON). *Rules: `frontend-architecture.md` (logic in
   the hook, not inline; UI layout invariant — tabs across the top under the fixed bar).*
3. **Unit + component tests.** `useCustomerTabs.test.ts` covering `deriveCustomerTabs`; a
   `CustomerTabs.test.tsx` rendering through the `FluentProvider`/`webLightTheme` wrapper. *Rules:
   `testing.md` (Vitest; test pure logic directly; render component tests through the provider
   wrapper).*
4. **Verify done.** `npm run build`, `npm run lint`, `npm run format:check`, `npm run test` all
   clean. *Rules: `frontend-architecture.md` ("what done looks like"), `testing.md`.*

## Assumptions & open questions
- **Wiring lives in the temporary `MailDebug` (no permanent container now).** I put the selected-tab
  state in `useMailDebug` and render `CustomerTabs` inside `MailDebug`, rather than introducing a
  dedicated permanent container/context in this story. Reviewer may prefer standing up that container
  now so #39 inherits it — is the transitional wiring acceptable?
- **`Uncategorized` gets its own tab, ordered alphabetically like any org.** Distinct customers
  (including the `Uncategorized` fallback) are sorted alphabetically, so `Uncategorized` lands near
  the end by letter. Alternative preferences: pin `Uncategorized` last explicitly, or order tabs by
  descending count instead of alphabetically.
- **"All" sentinel is the literal `'__all__'`.** Chosen to avoid colliding with a real ADO org
  literally named "All". Alternative: use the display string `'All'` directly (simpler, tiny
  collision risk).
- **Counter rendered with Fluent `CounterBadge` (`showZero`).** So an "All" tab can show `0` on an
  empty inbox. Reviewer may prefer plain `Org (12)` text or a different badge style — this is a
  design detail the story defers to implementation.

## Considerations
- **Bounded set, in-memory (`frontend-architecture.md`).** Derivation and filtering run over the
  already-fetched ≤~100-e-mail set with no re-fetch; recomputation is trivial and memoised.
- **No message is lost when filtering the raw `<pre>`.** The engine emits one `CategorizedEmail` per
  message and never drops one, so the "All" view's `filtered.map((e) => e.message)` equals the
  original `messages`; per-org views are strict subsets.
- **`customer` values are used verbatim as tab values.** They already carry the `Uncategorized`
  fallback and any GUID/`needsReview` cases from the engine; tabs surface them as-is (visibility over
  silent grouping).

## Testing recommendations
The project has an established test practice (Vitest, `npm run test`; the testing rule requires the
categorization logic be unit-tested and component tests be rendered through the provider wrapper), so
this story ships tests.

- **Altitude:** unit tests for the pure `deriveCustomerTabs`; one component/behavioral test for
  `CustomerTabs` mounted through `FluentProvider` + `webLightTheme`.
- **Must-cover:**
  - `deriveCustomerTabs([])` → a single "All" tab, `count: 0` (no org tabs) — never throws.
  - Mixed set (e.g. two orgs, one repeated, plus an `Uncategorized`) → "All" first with
    `count = total`; one tab per distinct org in alphabetical order with correct per-org counts;
    `Uncategorized` present as its own tab.
  - `CustomerTabs` renders one tab per derived entry with its visible counter, reflects
    `selectedCustomer` as the active tab, and calls `onSelect` with the tab's `value` when a different
    tab is clicked.

## Definition of done
- [ ] An organization tab strip renders under the top bar, with an **"All"** tab selected by default.
- [ ] Each tab shows a counter of e-mails under that organization; "All" shows the total.
- [ ] Selecting a tab filters the displayed set (cards **and** the raw `<pre>`) to that organization;
      "All" shows every e-mail.
- [ ] `CustomerTabs` is its own folder with a colocated `useCustomerTabs` hook; tab-derivation logic
      lives in the pure `deriveCustomerTabs`, not inline in JSX (`frontend-architecture.md`).
- [ ] Tabs consume the engine's `customer` tags verbatim; no re-categorization and no engine changes
      (`categorization-domain.md`).
- [ ] New tests cover `deriveCustomerTabs` (empty, multi-org, `Uncategorized`) and a `CustomerTabs`
      render/selection test through the `FluentProvider` wrapper; `npm run test` passes (`testing.md`).
- [ ] Type-checks and builds cleanly (`npm run build`); no ESLint errors and Prettier-clean
      (`npm run lint`, `npm run format:check`).
- [ ] No new dependencies; no persistence/backend introduced (`frontend-architecture.md`).

## Files/areas affected
- `src/components/CustomerTabs/CustomerTabs.tsx` — **new** (controlled `TabList` UI).
- `src/components/CustomerTabs/useCustomerTabs.ts` — **new** (`ALL_CUSTOMERS`, `deriveCustomerTabs`,
  `useCustomerTabs`).
- `src/components/CustomerTabs/useCustomerTabs.test.ts` — **new** (pure derivation tests).
- `src/components/CustomerTabs/CustomerTabs.test.tsx` — **new** (render/selection test via provider).
- `src/components/MailDebug/useMailDebug.ts` — **edit** (selection state + filtered set).
- `src/components/MailDebug/MailDebug.tsx` — **edit** (render `CustomerTabs`; drive columns from the
  filtered set).
