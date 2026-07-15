# Frontend architecture rules

## Language / framework / version
- **TypeScript** single-page app, built with **Vite**.
- **React** (Fluent UI v9 is React-based) — no other UI framework.
- **Fluent UI v9** (`@fluentui/react-components`) for all UI. Prefer its components,
  tokens, and `griffel` styling over hand-rolled CSS.
  - **Prefer the first-class Fluent v9 component over retrofitting a lower-level primitive.**
    For a UI capability that has a purpose-built Fluent v9 component (e.g. **DataGrid** for a
    resizable/sortable grid), adopt **that** component rather than augmenting a lower-level
    primitive (e.g. bolting features onto the primitive **Table**) — **even when** the idiomatic
    component is the larger, higher-risk change. The "simplest / minimal-diff change" bias does
    **not** override the idiomatic-component preference here. (Human ruling, story 54.)
- Package manager: **npm**.

## Structure & key directories
- **Front-end only** — there is no backend and no server-side processing. Everything runs
  in the browser.
- Each component lives in **its own folder**.
- **Logic and rendering are split**: the `.tsx` component renders; its logic lives in a
  colocated **custom hook** (e.g. `useCustomerTabs.ts` next to `CustomerTabs.tsx`).
  - **`use*` is for hooks only.** A colocated file named `use*` holds a real **custom hook**
    (stateful / React logic — `useState`, `useEffect`, `useMemo`, etc.), e.g.
    `useCustomerTabs.ts`, `useEmailList.ts`. A `use*` filename that exports **no hook** is wrong.
  - **Pure, React-free helpers get their own colocated file, not the hook.** Derivation /
    formatting logic with no React dependency belongs in its **own file named for its content**
    (not `use`-prefixed), colocated in the component's folder — e.g. `facetFilters.ts` next to
    `SidebarFilters.tsx`, `emailFormatters.ts` next to `EmailList.tsx`. Do **not** stuff such
    helpers into the `use*` file. (Human rulings, stories 39 and 40.)
  - **Placement:** keep these **pure, colocated helpers** in the component's own folder — not a
    generic `src/utils/`, and not `src/services/`. `src/services/` is the **service layer**
    generally — the I/O services (`services/graph`, `services/mail`, `services/projectMap`, …)
    **and** the centralized categorization business logic (see `categorization-domain.md`). The
    rule here is only that a component's pure derivation/formatting helper belongs in that
    component's folder, **not** in `services/`; it does **not** forbid non-categorization services.
- The mapping/categorization business logic is **centralized in a service** (see
  `categorization-domain.md`) — components never re-implement it.
- **Concrete tree (settled in story 29 scaffold — grow it as features land):**
  - `src/main.tsx` — app entry: mounts React into `#root`, wrapped in Fluent UI `FluentProvider`.
  - `src/App/` — the root component folder (`App.tsx` + colocated `App.test.tsx`). Each new
    component gets its **own folder** here (or under a `components/` grouping) following the same
    pattern; its logic hook lives colocated in that folder.
  - `src/setupTests.ts` — Vitest/jsdom setup (registers `@testing-library/jest-dom`).
  - `src/vite-env.d.ts` — Vite client-types / `import.meta.env` typing file: holds
    `/// <reference types="vite/client" />` plus the `ImportMetaEnv` interface typing the
    `VITE_*` vars. Keep it on re-scaffold/onboard so env typing is not silently dropped.
  - `e2e/` (repo root) — Playwright specs, run via `npm run test:e2e` (separate from Vitest).
  - Build/tooling config lives at the repo root: `vite.config.ts` (Vite + Vitest), `tsconfig*.json`,
    `eslint.config.js`, `.prettierrc`, `playwright.config.ts`.
  - `services/`, `hooks/` (non-colocated shared), and `models/` are **not yet created** — add each
    under `src/` when the first story needs it, rather than stubbing empty folders.

## Data flow
- All emails are fetched **once, on app load** (see `authentication.md` for the Graph read).
- The working set is **bounded (max ~100 emails)** and processed **entirely in memory** —
  no persistence, no caching layer, no pagination required.
- TODO (undecided): state approach beyond local React state (React Context vs. a data
  library such as TanStack Query). Not decided — do not assume one.

### State & data placement
- **State/data that outlives a transitional component must live in a permanent container.**
  Selection state, the fetch/categorize data path, and anything with a lifetime longer than a
  throwaway visualizer must **not** be colocated inside a temporary/scaffolding component that
  will later be deleted — put it in a component or hook that will survive. (Human corrections,
  story 38.)
- **Hoist reusable data hooks up front.** A data hook with a foreseeable future consumer belongs
  in the shared `src/hooks/` location from the start, not colocated and moved later — if you know
  data needs to be reused, hoist it as soon as reuse is foreseeable. (Human corrections, story 38.)
- **A cross-cutting UI concern has a single owner.** Loading/error handling (and similar
  cross-cutting states) is owned in **one place** — the parent/container — with children rendered
  **success-only**: the child receives already-loaded data and does not carry its own
  loading/error branches. Leaving a child's now-unreachable loading/error branches in place "to
  minimize the diff" is a **smell, not a simplification** — remove the dead/duplicate branches
  rather than keeping two owners. (Human correction, story 46.)

## UI layout invariants
- Top navigation bar is **fixed to the top** of the page (does not scroll with the content). It
  shows the **app title centered**, and the logged-in user's **display name** plus a **log-out**
  button on the **right** — nothing else.
- **Customer tabs** across the top, including an **"All"** tab; each tab shows an **item
  counter**.
- **Left sidebar** filters by **project and/or type**; each entry shows an **item counter**.
- **Center**: a simple **list view** of the (filtered) emails.
- **Entry ordering (customer tabs and sidebar project/type facets).** Any fixed/"All" entry comes
  **first**; real values are ordered **alphabetically (case-insensitive)**; the
  uncategorized/fallback bucket is pinned **last** regardless of its letter. (Human ruling on tab
  order, story 38 — applies to both the tabs and the facet lists.)
- **The e-mail preview stays open across a filter change.** When a filter change removes the
  previewed row from the visible list, the preview **stays open** — switching filters does **not**
  close the preview. Ratified in story 40 and pinned in code (`useEmailList.ts` +
  `useEmailList.test.ts`); recorded here so a later story's acceptance criterion cannot silently
  reverse it. (Ratified story 40; near-reversal caught in story 55.)

## Conventions
- **Fluent v9 `DataGrid` `resizableColumns` auto-fits by default.** Enabling `resizableColumns`
  defaults `resizableColumnsOptions.autoFitColumns` to **`true`**, which re-fits every column to
  the container width on **each render** — this both **overrides per-column `idealWidth`** (a column
  renders narrower than configured) **and immediately reverts a manual resize** (drag/keyboard
  resizes don't stick). When columns need **fixed or persistent** widths, set
  `resizableColumnsOptions={{ autoFitColumns: false }}`. (Story 54.)
- **ESLint + Prettier**: ESLint (typescript-eslint + react-hooks rules) for correctness,
  Prettier for formatting.
  - **Derived state is computed during render, not synced via an effect.** The `react-hooks`
    config here enforces **`react-hooks/set-state-in-effect`** ("avoid calling `setState()`
    directly within an effect"). Compute values derived from props/state **during render**
    (e.g. via `useMemo`) rather than mirroring them into state with `useEffect` + `setState` —
    the effect+setState state-syncing pattern trips this rule and fails lint. (Story 43.)
- **Deterministic, reproducible installs & runtime**:
  - Every dependency in `package.json` is pinned to an **exact version** — no `^`, `~`, or
    `*` ranges. This is enforced by `.npmrc` (`save-exact=true`); add packages with
    `npm install --save-exact`.
  - The Node runtime is pinned to the current LTS via **Volta** (voltajs) — an exact
    `volta.node` version in `package.json`, with a matching `engines.node`.
  - **Line endings are pinned to LF deterministically across OSes.** Git stores content
    with LF, but on Windows `core.autocrlf` checks files out as CRLF; Prettier's default
    `endOfLine: lf` then flags *every* working-tree file even though the committed content
    is clean — a false positive that breaks `npm run format:check` on Windows checkouts.
    Prevent this with a committed **`.gitattributes`** enforcing LF (e.g. `* text=auto
    eol=lf`) **and/or** aligning Prettier's `endOfLine` so the check matches the checkout.
    (Applying this convention touches repo files outside `.claude/` — `.gitattributes`,
    `.prettierrc`.)

## What "done" looks like for a change here
- Type-checks and builds cleanly; no ESLint errors; formatted with Prettier.
- Logic sits in a hook or the service, not inline in JSX.
- Any new categorization behavior is covered by unit tests (see `testing.md`).
