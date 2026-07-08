<!-- AIND KICKSTART DRAFT — intended design captured in conversation, NOT yet validated against
     code. Review and correct before relying on it; re-run /aind:onboard once code exists to
     reconcile. Suggestions, not ground truth. -->

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
- The mapping/categorization business logic is **centralized in a service** (see
  `categorization-domain.md`) — components never re-implement it.
- TODO (undecided): the concrete `src/` tree (e.g. `components/`, `hooks/`, `services/`,
  `models/`). Settle it when the first components are scaffolded, then record it here.

## Data flow
- All emails are fetched **once, on app load** (see `authentication.md` for the Graph read).
- The working set is **bounded (max ~100 emails)** and processed **entirely in memory** —
  no persistence, no caching layer, no pagination required.
- TODO (undecided): state approach beyond local React state (React Context vs. a data
  library such as TanStack Query). Not decided — do not assume one.

## UI layout invariants
- Top navigation bar shows **only** the logged-in user's display name and a **log-out**
  button — nothing else.
- **Customer tabs** across the top, including an **"All"** tab; each tab shows an **item
  counter**.
- **Left sidebar** filters by **project and/or type**; each entry shows an **item counter**.
- **Center**: a simple **list view** of the (filtered) emails.

## Conventions
- **ESLint + Prettier**: ESLint (typescript-eslint + react-hooks rules) for correctness,
  Prettier for formatting.

## What "done" looks like for a change here
- Type-checks and builds cleanly; no ESLint errors; formatted with Prettier.
- Logic sits in a hook or the service, not inline in JSX.
- Any new categorization behavior is covered by unit tests (see `testing.md`).
