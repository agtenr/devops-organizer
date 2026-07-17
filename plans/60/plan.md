# Plan — Story 60: Update the app title

## Context
The top navigation bar currently shows the title **"Azure DevOps E-mail Organizer"**
(`src/components/TopBar/TopBar.tsx:47`). The story asks for two small changes to that title:

1. Shorten it to **"ADO E-mail Organizer"**.
2. Make the title **clickable** so that clicking it **refreshes the page with all filters cleared**
   — a convenient "reset to a clean slate" affordance.

The filter selection (organization tab + project/type facets, subject search, open preview) lives
entirely as in-memory React state in `useOrganizer` (`src/components/Organizer/useOrganizer.ts`),
mounted under `App` (`src/App/App.tsx`). A full browser page reload re-mounts the whole app, so the
filter/selection state resets to its defaults as a natural consequence — no explicit state-reset
plumbing is required. The acceptance criterion says "refreshes the page", so a real reload
(`window.location.reload()`) is the literal, correct implementation and clearing filters falls out
of it for free.

## Keep it simple
- **No cross-component "reset filters" callback.** The AC says the page **refreshes**; a full
  `window.location.reload()` re-mounts `App` and resets `useOrganizer` state to defaults, which *is*
  "all filters cleared". We deliberately do **not** thread a `resetFilters()` handler from `TopBar`
  down/through `Organizer`/`useOrganizer` — that would be more code for a weaker guarantee (it would
  clear the facet selection but not re-fetch or reset unrelated in-memory state the way a refresh
  does).
- **No routing / query-param state.** Filters are in-memory only; we are not introducing URL-encoded
  filter state, so "clear filters" needs nothing more than the reload.
- **No config/env for the title string.** The title is a fixed product name; it stays a literal in
  the component (matching how it lives today), not a new `VITE_*` var.
- **Harness header stays a stand-in.** `src/harness.tsx` uses a static header stand-in (the real
  `TopBar` needs MSAL). We update its title text for screenshot fidelity but do **not** turn the
  harness into a vehicle for the real reload behavior.

## AC coverage
| AC | Status | Where |
|---|---|---|
| Top-bar title reads "ADO E-mail Organizer" | covered | Task 1 (TopBar text) + Task 3 (harness stand-in) + unit test + screenshot |
| Clicking the title refreshes the page with all filters cleared | covered | Task 1 (clickable title) + Task 2 (`refresh` in `useTopBar`); unit test asserts reload is invoked; real reload/clear verified by the live-verification DoD line (see OQ2) |

Both ACs are covered. The only open questions are *how* to render the clickable title (OQ1) and
*how* AC2's real-browser behavior is verified (OQ2) — neither narrows an AC.

## Implementation approach
Two source files, one harness touch, one new test, one screenshot.

- **`src/components/TopBar/useTopBar.ts`** — add a `refresh` action to the hook's return (logic
  belongs in the hook, not the JSX — `frontend-architecture.md`). It calls `window.location.reload()`:
  ```ts
  const refresh = () => {
    window.location.reload();
  };
  return { displayName, logout, refresh };
  ```
- **`src/components/TopBar/TopBar.tsx`** — (a) change the title text to `ADO E-mail Organizer`;
  (b) make the title an interactive control wired to `refresh`. Recommended: render the title as a
  Fluent v9 **`Button` with `appearance="transparent"`** (prefer the first-class Fluent component
  over a hand-rolled clickable — `frontend-architecture.md`), keeping the current visual weight
  (size 500, semibold) and the `gridColumnStart: 2` centering, and preserving the heading landmark
  via `role="heading"` / `aria-level={1}` (or by keeping an `<h1>` wrapper). See **OQ1** for the
  exact semantics choice. Wire `onClick={refresh}`.
- **`src/harness.tsx`** — update the static header stand-in's title text (currently
  `Azure DevOps E-mail Organizer`, `src/harness.tsx:166`) to `ADO E-mail Organizer` so the committed
  screenshot faithfully shows the new title. This story adds **no** field to `useOrganizer`'s return,
  so the harness `mockData` object needs no other change (the `refresh` action lives on `useTopBar`,
  which the harness does not use).

## Task breakdown
1. **Add the `refresh` action to `useTopBar`.** Edit `src/components/TopBar/useTopBar.ts` to return a
   `refresh: () => void` that calls `window.location.reload()`; update the hook's doc comment.
   *Rule:* `.claude/rules/frontend-architecture.md` (logic in the colocated hook, not JSX).
2. **Update the title text and make it clickable.** Edit `src/components/TopBar/TopBar.tsx`: change
   the literal to `ADO E-mail Organizer` and render the title as the interactive control from
   *Implementation approach* / **OQ1**, wired to `refresh`. Keep the centered layout and heading
   semantics. *Rule:* `.claude/rules/frontend-architecture.md` (Fluent v9 first-class component &
   tokens/griffel styling; top-bar layout invariants — title centered, name + log-out on the right).
3. **Keep the harness stand-in faithful.** Edit `src/harness.tsx` to update the stand-in header title
   text to `ADO E-mail Organizer`. *Rule:* `.claude/rules/testing.md` (harness/screenshot seam is the
   only sanctioned screenshot source; keep it faithful to the real UI).
4. **Add a unit test for the top bar.** Create `src/components/TopBar/TopBar.test.tsx`, rendering
   through the `FluentProvider` (`webLightTheme`) wrapper and mocking `@azure/msal-react` (same
   pattern as `src/hooks/useCategorizedMail.test.ts` — provide `useMsal` returning an `accounts`
   array and an `instance` with `logoutRedirect`). Assert: (a) the title reads
   `ADO E-mail Organizer`; (b) the title is an interactive control (a `button`, or has
   `role="heading"` per OQ1) and (c) activating it invokes `window.location.reload` (stub it, e.g.
   `Object.defineProperty(window, 'location', { value: { reload: vi.fn() }, writable: true })` or a
   `vi.spyOn`, and assert the spy was called on click). *Rule:* `.claude/rules/testing.md`
   (render through the provider wrapper; new test files must be git-tracked and included in the PR).
5. **Capture and commit the screenshot.** Add a Playwright shot (new `e2e/top-bar-title.spec.ts` or a
   case appended to an existing spec) that loads `/harness.html`, asserts the title text
   `ADO E-mail Organizer` is visible, and writes `page.screenshot({ path:
   'e2e/screenshots/60/top-bar-title.png' })`. Confirm the PNG is **git-tracked**. *Rule:*
   `.claude/rules/testing.md` (committed harness screenshot under `e2e/screenshots/<id>/`, referenced
   from the PR via a raw-bytes image URL).

## Testing recommendations
- **Whether to test:** Yes — the project has Vitest (`npm run test`) and Playwright
  (`npm run test:e2e`) practices (`.claude/rules/testing.md`). Use both; do not bootstrap anything new.
- **At what altitude:**
  - **Unit (Vitest, jsdom + FluentProvider):** the new `TopBar.test.tsx` (Task 4) — title text +
    click invokes `window.location.reload`. This pins the *mechanism*.
  - **Screenshot (Playwright, harness seam):** Task 5 — documentary evidence the new title renders
    (`page.screenshot`, not `toHaveScreenshot`).
- **Must-cover list** (beyond what the ACs already state):
  - Title text is exactly `ADO E-mail Organizer` (not the old string) → assertion in the unit test
    **and** the screenshot spec.
  - Activating the title control calls `window.location.reload` exactly once → unit test with a
    stubbed `reload`.
- **Live verification:** **needs manual live verification before merge** — jsdom cannot execute a real
  reload and the harness header is a stand-in, so AC2's *actual* "page reloads and filters are
  cleared" behavior is confirmed by a human in the running app (apply a customer/project/type filter,
  click the title, confirm the page reloads to the default `All` tab with no facet/search/preview
  state). See **OQ2** for the alternative (extending the harness/E2E seam) if the reviewer prefers an
  automated check.

## Considerations
- **A refresh re-fetches mail.** `window.location.reload()` re-runs the MSAL/Graph load path, so the
  ≤~100-email corpus is fetched again. This is the intended, expected effect of "refresh the page"
  and the cost is trivial at this corpus size — noted as FYI, not a concern.
- **Heading landmark.** Turning the title into a button risks losing the `<h1>` document landmark;
  the plan preserves it (OQ1). Flagged so the reviewer notices the accessibility angle.

## Assumptions & open questions
- **OQ1 — How to render the clickable title.** Render it as a Fluent v9 **`Button
  appearance="transparent"`** styled to match the current title, with `role="heading"`/`aria-level={1}`
  to preserve the `<h1>` landmark (recommended, because it is the idiomatic first-class Fluent
  interactive component per `frontend-architecture.md`) **or** keep `<Text as="h1">` and attach an
  `onClick` + keyboard handler + `role="button"`/`tabIndex` to the heading itself (fewer visual
  changes, but hand-rolls the interactive/keyboard behavior Fluent's Button gives for free)? Reply A
  (transparent Button) or B (interactive heading).
- **OQ2 — How to verify AC2's reload/clear in a real browser.** Accept a **unit test of the mechanism
  (spy on `window.location.reload`) plus a manual live-verification DoD line** (recommended, because
  the established harness seam mounts a *stand-in* header — not the real MSAL-backed `TopBar` — and
  reload-clears-filters depends on in-memory state that the harness seeds from the URL, so a harness
  E2E cannot faithfully assert it) **or** extend the harness/E2E seam to mount the real `TopBar` and
  assert the reload/clear automatically (more faithful, but a new per-story seam extension the
  testing rule steers away from)? Reply A (unit + manual) or B (extend the seam).

## Definition of done
- [ ] Top-bar title reads **"ADO E-mail Organizer"** (AC1).
- [ ] The title is an interactive control that, when activated, calls `window.location.reload()`
      (AC2 mechanism).
- [ ] Manual live verification done: in the running app, applying filters then clicking the title
      reloads the page with the `All` tab selected and no project/type/search/preview state (AC2
      behavior).
- [ ] `src/harness.tsx` stand-in header shows the new title so the screenshot is faithful.
- [ ] New `TopBar.test.tsx` asserts the new title text and the reload-on-click mechanism; full
      `npm run test` passes.
- [ ] A Playwright screenshot of the new title is committed under `e2e/screenshots/60/`, is
      **git-tracked**, and is referenced from the code PR via a raw-bytes image URL.
- [ ] Type-checks and builds cleanly; no ESLint errors; Prettier-formatted (`frontend-architecture.md`
      "what done looks like").

## Files/areas affected
- `src/components/TopBar/useTopBar.ts` — add `refresh` action.
- `src/components/TopBar/TopBar.tsx` — new title text; clickable title wired to `refresh`.
- `src/harness.tsx` — stand-in header title text (screenshot fidelity).
- `src/components/TopBar/TopBar.test.tsx` — **new** unit test.
- `e2e/top-bar-title.spec.ts` (or an existing spec) + `e2e/screenshots/60/top-bar-title.png` — **new**
  screenshot spec + committed shot.
