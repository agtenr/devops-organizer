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

Because there is no real list view yet, the story targets the existing debug surface: the tabs filter
what `MailDebug` renders (the cards **and** the raw `<pre>`). Per reviewer decision, the selection
state and the email data are **owned by a new permanent container** (`Organizer`) that sits between
the top bar and `MailDebug` — **not** inside the throwaway `MailDebug`, which is demoted to a pure
presentational visualizer that renders whatever filtered emails it is handed. The real list view that
replaces `MailDebug` is the successor story (#39); the permanent pieces built here — the `Organizer`
container, the `CustomerTabs` component, and the pure tab-derivation logic — survive that transition,
so #39 only swaps the visualizer.

## Keep it simple
- **A container + a shared data hook, but no context / data-library.** Per reviewer decision the
  data path is **extracted to a reusable `useCategorizedMail` hook under `src/hooks/`** (so #39's
  real list view can consume it independently), and the selected-tab state lives in a **new permanent
  `Organizer` container**, **not** in the throwaway `MailDebug`. But we keep it plain: local React
  state + the existing categorization service, passed down by props. We do **not** introduce React
  Context, a data library (TanStack Query), or a global store — that broader state decision is still
  open (`frontend-architecture.md` "state approach… not decided") and props suffice for this depth.
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

Introduce a **permanent `Organizer` container** (`src/components/Organizer/`) that owns the
selection, backed by a **reusable data hook**, and demote `MailDebug` to a pure visualizer:
- **Extract the fetch + categorize logic** out of the current `useMailDebug` into a new **shared
  hook `src/hooks/useCategorizedMail.ts`** (per reviewer: data known to be reused is extracted to a
  shared hook, not colocated). This is the first non-colocated shared hook, so it creates the
  `src/hooks/` directory `frontend-architecture.md` anticipates. It holds the mail-service +
  `categorizeEmails` call and exposes `{ status, error, folderName, categorized }` — no selection
  concern. #39's real list view can import it directly.
- **`useOrganizer`** (colocated in `src/components/Organizer/`) consumes `useCategorizedMail`, owns
  the `selectedCustomer` state (default = the `ALL_CUSTOMERS` sentinel), and derives the **filtered**
  set (`selected === ALL_CUSTOMERS ? categorized : categorized.filter((e) => e.customer === selected)`).
  It exposes `{ status, error, folderName, categorized, filtered, selectedCustomer, setSelectedCustomer }`.
- **`Organizer.tsx`** renders `<CustomerTabs emails={categorized} selectedCustomer={…} onSelect={setSelectedCustomer} />`
  followed by `<MailDebug status={…} error={…} folderName={…} emails={filtered} />`. `CustomerTabs`
  gets the **full** `categorized` set (counts must reflect totals, not the current filter); `MailDebug`
  gets the **filtered** set.
- **`MailDebug` becomes presentational** — it drops its `useMailDebug` hook and all fetching/state,
  taking `{ status, error, folderName, emails: CategorizedEmail[] }` as props. It renders the cards
  from `emails` and the raw `<pre>` from `emails.map((e) => e.message)`. Because the engine emits
  exactly one `CategorizedEmail` per message and never drops one, the "All" view reproduces the full
  raw set unchanged; per-org views are subsets. `useMailDebug.ts` is deleted.
- **`App.tsx`** renders `<Organizer />` in place of `<MailDebug />` (inside the existing
  `MsalAuthenticationTemplate`, so the account is available for the fetch).

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

// MailDebug is now presentational — it receives the already-filtered set and renders it.
export interface MailDebugProps {
  status: 'loading' | 'success' | 'error';
  error: string;
  folderName: string;
  emails: CategorizedEmail[]; // the FILTERED set; the raw <pre> is emails.map((e) => e.message)
}

// Shared, reusable data hook (src/hooks/) — fetch + categorize only, no selection concern.
// #39's real list view consumes this directly; useOrganizer consumes it and layers selection on top.
export interface UseCategorizedMailResult {
  status: 'loading' | 'success' | 'error';
  error: string;
  folderName: string;
  categorized: CategorizedEmail[]; // full set; categorized.length === fetched-message count
}
```

`deriveCustomerTabs(emails: CategorizedEmail[]): CustomerTab[]` → ordering fixed by reviewer:
**"All" first** (count = `emails.length`), then one tab per **distinct** organization sorted
**alphabetically** (case-insensitive), and **`Uncategorized` pinned last** if present. Use the
exported `UNCATEGORIZED` constant from `src/models/categorization.ts` for that value — do not
hardcode the string. `onSelect`'s emitted `value` and `useOrganizer`'s `selectedCustomer`/filter
comparison must use the **same** `customer` strings and the same `ALL_CUSTOMERS` sentinel.

## Task breakdown
1. **Add the `CustomerTabs` component + `useCustomerTabs` hook + `deriveCustomerTabs`.** New folder
   `src/components/CustomerTabs/` with `CustomerTabs.tsx` (renders `TabList`/`Tab` + `CounterBadge`,
   controlled via `selectedValue`/`onTabSelect`) and `useCustomerTabs.ts` (exports the pure
   `deriveCustomerTabs` with the All-first / alphabetical / `Uncategorized`-last ordering, the
   `ALL_CUSTOMERS` sentinel, and a `useCustomerTabs(emails)` hook that `useMemo`s the derivation;
   reuse the `UNCATEGORIZED` constant from `src/models/categorization.ts`). *Rules:
   `frontend-architecture.md` (own folder, logic in a hook not JSX, Fluent components/tokens),
   `categorization-domain.md` (Customer = ADO organization; consume tags, never re-derive).*
2. **Extract the shared data hook `src/hooks/useCategorizedMail.ts`.** Relocate the fetch +
   `categorizeEmails` logic out of `useMailDebug` into this new non-colocated shared hook (creates the
   `src/hooks/` directory); it returns `UseCategorizedMailResult` and has no selection concern.
   *Rules: `frontend-architecture.md` (shared hooks under `src/hooks/`; single fetch on load, bounded
   in-memory set), `categorization-domain.md` (consume the pure service; never re-derive tags).*
3. **Add the `Organizer` container + `useOrganizer` hook.** New folder `src/components/Organizer/`
   with `useOrganizer.ts` (consumes `useCategorizedMail`; adds `selectedCustomer` state defaulting to
   `ALL_CUSTOMERS`, a setter, and a memoised `filtered` set) and `Organizer.tsx` (renders
   `CustomerTabs` fed the full `categorized` set, then `MailDebug` fed the `filtered` set). *Rules:
   `frontend-architecture.md` (own folder, logic in the hook not JSX; UI layout invariant — tabs
   across the top under the fixed bar).*
4. **Demote `MailDebug` to presentational and wire the container into `App`.** Change `MailDebug.tsx`
   to take `MailDebugProps` and render cards from `emails` + the `<pre>` from `emails.map((e) =>
   e.message)`; delete `useMailDebug.ts`. In `App.tsx` render `<Organizer />` in place of
   `<MailDebug />`. *Rules: `frontend-architecture.md` (logic/rendering split; component structure).*
5. **Unit + component tests.** `useCustomerTabs.test.ts` covering `deriveCustomerTabs`; a
   `CustomerTabs.test.tsx` rendering through the `FluentProvider`/`webLightTheme` wrapper. *Rules:
   `testing.md` (Vitest; test pure logic directly; render component tests through the provider
   wrapper).*
6. **Verify done.** `npm run build`, `npm run lint`, `npm run format:check`, `npm run test` all
   clean. *Rules: `frontend-architecture.md` ("what done looks like"), `testing.md`.*

All prior open questions are now settled by review and folded into the plan, leaving no open
assumptions:
- Selection state lives in a **permanent `Organizer` container**, not in `MailDebug`.
- The data path is **extracted to a shared `src/hooks/useCategorizedMail` hook** (reviewer: data
  known to be reused is extracted from the component level up front).
- Tab order is **All → alphabetical → `Uncategorized` last**.
- The "All" sentinel is `'__all__'`; counters use Fluent `CounterBadge`.

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
  - Mixed set (e.g. orgs `Contoso` + `Adatum`, one repeated, plus an `Uncategorized`) → order is
    exactly `[All, Adatum, Contoso, Uncategorized]` with `All.count = total` and correct per-org
    counts; i.e. **All first, orgs alphabetical, `Uncategorized` pinned last** even though `U` would
    already sort late (a set with an org named e.g. `Zzz` must still place `Uncategorized` after it).
  - Set with **no** uncategorized emails → no `Uncategorized` tab appears.
  - `CustomerTabs` renders one tab per derived entry with its visible counter, reflects
    `selectedCustomer` as the active tab, and calls `onSelect` with the tab's `value` when a different
    tab is clicked.

## Definition of done
- [ ] An organization tab strip renders under the top bar, with an **"All"** tab selected by default.
- [ ] Each tab shows a counter of e-mails under that organization; "All" shows the total.
- [ ] Selecting a tab filters the displayed set (cards **and** the raw `<pre>`) to that organization;
      "All" shows every e-mail.
- [ ] Tab order is **All → organizations alphabetical → `Uncategorized` last**.
- [ ] The fetch + categorize data path lives in a shared `src/hooks/useCategorizedMail` hook (no
      selection concern); selection state lives in the permanent `Organizer` container (colocated
      `useOrganizer`, which consumes the shared hook), **not** in `MailDebug`; `MailDebug` is
      presentational and `useMailDebug.ts` is removed (`frontend-architecture.md`).
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
- `src/hooks/useCategorizedMail.ts` — **new** (shared data hook: fetch + categorize, relocated from
  `useMailDebug`; creates the `src/hooks/` directory).
- `src/components/Organizer/Organizer.tsx` — **new** (permanent container: renders `CustomerTabs` +
  `MailDebug`).
- `src/components/Organizer/useOrganizer.ts` — **new** (consumes `useCategorizedMail`;
  `selectedCustomer` state + `filtered` set).
- `src/components/MailDebug/MailDebug.tsx` — **edit** (now presentational — takes `MailDebugProps`,
  renders cards + `<pre>` from the passed `emails`).
- `src/components/MailDebug/useMailDebug.ts` — **deleted** (logic split to `useCategorizedMail` +
  `useOrganizer`).
- `src/App/App.tsx` — **edit** (render `<Organizer />` in place of `<MailDebug />`).
