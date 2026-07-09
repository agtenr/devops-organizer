# Frontend architecture rules

## Language / framework / version
- **TypeScript** single-page app, built with **Vite**.
- **React** (Fluent UI v9 is React-based) — no other UI framework.
- **Fluent UI v9** (`@fluentui/react-components`) for all UI. Prefer its components,
  tokens, and `griffel` styling over hand-rolled CSS.
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
  - **Placement:** keep these helpers colocated in the component's own folder — not a generic
    `src/utils/`, and not `src/services/` (reserved for the categorization business logic, see
    `categorization-domain.md`).
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

## Conventions
- **ESLint + Prettier**: ESLint (typescript-eslint + react-hooks rules) for correctness,
  Prettier for formatting.
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
