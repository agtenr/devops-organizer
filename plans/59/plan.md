# Plan — Story 59: Update the app title

## Context

The top navigation bar currently shows the app title **"Azure DevOps E-mail Organizer"**
(`src/components/TopBar/TopBar.tsx:47`). The story asks for two changes:

1. Rename the title to **"E-mail Organizer"**.
2. Make the title **clickable**: clicking it **refreshes the page with all filters cleared**.

Filter state (organization tab + project + type facets) lives entirely as **in-memory React
state** in `useOrganizer` (`src/components/Organizer/useOrganizer.ts:33-35`) — there is no
persistence, no URL encoding, no routing. So a **full page reload** re-mounts the app with
`useOrganizer`'s initial state (`selectedCustomer = ALL_CUSTOMERS`, `selectedProject = null`,
`selectedTypeKeys = ∅`), which **clears every filter as a natural consequence**. No bespoke
"clear filters" logic is needed — the reload *is* the mechanism, and it matches the AC wording
"refreshes the page" literally.

Intended outcome: a friendlier, shorter title that doubles as a "reset to a clean slate" action,
consistent with the common "click the app title/logo to go home" convention.

## Keep it simple

- **No SPA soft-reset / no `useOrganizer` reset function.** The AC says "refreshes the page", and
  filters are in-memory-only, so `window.location.reload()` clears them for free. We do **not** add
  a filter-reset callback to `useOrganizer`, thread it through `Organizer` → `TopBar`, or introduce
  any cross-component reset wiring. (See open question OQ1 — this is the recommended reading, not a
  silent narrowing.)
- **No router.** The app has no routing today; clicking the title does **not** introduce
  react-router or navigation infrastructure. A plain `window.location.reload()` is sufficient.
- **No change to the layout invariant.** The title stays **centered** in the fixed top bar
  (`.claude/rules/frontend-architecture.md` "UI layout invariants"); only its text and its
  clickability change. The centering grid (`gridColumnStart: 2`) is untouched.
- **No new "clear-filters" E2E through the harness.** The harness models filter state via URL
  params (`?state=filtered`), not live React state (`src/harness.tsx:95-111`), and
  `window.location.reload()` preserves the query string — so a harness reload would *re-seed*, not
  clear, filters. The harness is therefore not a faithful vehicle for AC2's clearing behavior (see
  OQ3); we don't build a misleading E2E around it.

## AC coverage

| AC | Status | Where |
|---|---|---|
| The app title in the top bar reads "E-mail Organizer" | covered | Task 2 (TopBar), Task 3 (harness stand-in), Task 4 (unit test), Task 5 (screenshot + E2E assertion) |
| Clicking the app title refreshes the page with all filters cleared | covered | Task 1 (reload handler) + Task 2 (wire click); filter-clearing is a by-construction consequence of the reload — verification approach in OQ3 |

## Implementation approach

- **`src/components/TopBar/useTopBar.ts`** — add a `reloadApp` action to the hook so the reload
  logic lives in the hook, not inline in JSX (per the logic/rendering split rule). It simply calls
  `window.location.reload()`. Return it alongside `displayName` and `logout`.
- **`src/components/TopBar/TopBar.tsx`** — (a) change the title text to `E-mail Organizer`; (b) make
  the title an accessible interactive control that calls `reloadApp` on click. Render the title text
  inside a Fluent v9 **`Button appearance="transparent"`** so keyboard access (Enter/Space, focus
  ring) comes for free rather than hand-rolling `role`/`tabIndex`/`onKeyDown` on a `Text` — this is
  the Fluent-first, idiomatic choice (`.claude/rules/frontend-architecture.md`). Keep the `<h1>`
  heading semantics by keeping the `Text as="h1"` as the centered grid cell and placing the Button
  as its content (or applying the heading typography to the Button); strip the Button's default
  horizontal padding so the title still reads as a centered heading, not a chip. (Exact element
  nesting is the coder's call within these constraints; see OQ2 for Button-vs-Link.)
- **`src/harness.tsx`** — update the **static header stand-in** title (`src/harness.tsx:166`) to
  `E-mail Organizer` so the committed harness screenshot reflects the shipped title. The stand-in is
  a decorative mirror of the real `TopBar` (which needs MSAL and can't mount in the harness); it
  only needs the correct **text** — it does **not** need the reload behavior (the harness has no live
  filter state to clear).

## Task breakdown

1. **Add the reload action to the TopBar hook.**
   File: `src/components/TopBar/useTopBar.ts`. Add `const reloadApp = () => window.location.reload();`
   and include `reloadApp` in the returned object. Keep the existing `displayName`/`logout`.
   Rule: `.claude/rules/frontend-architecture.md` (logic lives in the colocated hook, not JSX).

2. **Rename + make the title clickable.**
   File: `src/components/TopBar/TopBar.tsx`. Change the title text to `E-mail Organizer`; consume
   `reloadApp` from `useTopBar`; render the title as a transparent Fluent `Button` wired to
   `reloadApp`, preserving the centered `<h1>` heading and the existing grid placement. Import
   `Button` (already available from `@fluentui/react-components`; `Button` is already imported).
   Rules: `.claude/rules/frontend-architecture.md` (Fluent-first, layout invariant: title centered).

3. **Update the harness stand-in title.**
   File: `src/harness.tsx` (line ~166). Change the stand-in header text to `E-mail Organizer`.
   Rule: `.claude/rules/testing.md` (the harness is the screenshot/E2E seam; keep it faithful to the
   shipped UI).

4. **Add a TopBar component test (new file).**
   File: `src/components/TopBar/TopBar.test.tsx`. Render through the `FluentProvider`/`webLightTheme`
   wrapper (per the testing rule). Mock `@azure/msal-react`'s `useMsal` to supply an account
   (`{ name: 'Test User' }`) and a stub `instance.logoutRedirect`. Assert: (a) the heading reads
   `E-mail Organizer`; (b) clicking the title control invokes a page reload. Because jsdom's
   `window.location.reload` is not implemented and is non-configurable, stub it in the test — e.g.
   `Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload: vi.fn() } })`
   (restore after) — then assert the stub was called once on click.
   Rule: `.claude/rules/testing.md` (component tests through the provider wrapper).

5. **Add a Playwright screenshot + title assertion (new file), committed under `e2e/screenshots/59/`.**
   File: `e2e/app-title.spec.ts`. `page.goto('/harness.html')`, assert the title
   `E-mail Organizer` is visible (real-browser check of AC1), then
   `await page.screenshot({ path: 'e2e/screenshots/59/app-title.png' })` (documentary evidence, not
   `toHaveScreenshot`). Commit the PNG and confirm it is **git-tracked**. The code PR description
   must embed the screenshot via a **raw-bytes URL** (`?raw=true` / `/raw/<branch>/…` /
   `raw.githubusercontent.com`).
   Rule: `.claude/rules/testing.md` ("UI screenshots" — committed, harness seam, referenced from PR).

## Considerations

- **Reload cost (FYI).** `window.location.reload()` re-mounts the app: MSAL re-acquires the token
  **silently** (its cache is in storage, so no re-login prompt) and mail is **re-fetched** by
  `useCategorizedMail`. This is heavier than an in-app reset but is exactly what "refresh the page"
  asks for; there is no lighter option that still satisfies the AC literally, so this is FYI, not a
  choice (the lighter soft-reset alternative *is* offered as OQ1).
- **No PII in the committed screenshot.** The shot is taken through the harness stand-in header
  (mock data, no MSAL account), so no real display name or mailbox content is captured —
  consistent with the anonymisation rule.

## Testing recommendations

The project has a settled test practice — **Vitest** unit tests (`npm run test`) and **Playwright**
E2E (`npm run test:e2e`) — so we test.

- **Altitude:**
  - **Unit (component):** `TopBar.test.tsx` at the DOM/behaviour level — title text + reload-on-click
    wiring (Task 4).
  - **E2E (real browser):** `app-title.spec.ts` — assert the new title is visible and capture the
    committed screenshot (Task 5).
- **Must-cover (beyond the plain ACs):**
  - Clicking the title **invokes `window.location.reload()`** exactly once → verified via the stubbed
    `reload` in the component test. (This is the one behaviour the AC text doesn't make mechanically
    obvious.)
- **Live verification (needed):** AC2's *filter-clearing* cannot be faithfully exercised through the
  static-filter harness (see OQ3), so it is validated by **construction** (in-memory state + full
  reload) plus the reload-wiring unit test, and confirmed by a **manual live check** before merge
  (DoD below).

## Definition of done

- [ ] The top-bar title reads exactly **"E-mail Organizer"** (AC1).
- [ ] Clicking the title triggers a full page reload via `window.location.reload()`, which clears all
      in-memory filters — organization tab, project, and type (AC2).
- [ ] The title control is **keyboard-accessible** (focusable, activatable with Enter/Space) via a
      Fluent interactive component (no hand-rolled `role`/`tabIndex`).
- [ ] The reload handler lives in `useTopBar`, not inline in JSX (`frontend-architecture.md`).
- [ ] The title stays **centered** in the fixed top bar (layout invariant unchanged).
- [ ] `TopBar.test.tsx` renders through `FluentProvider` and asserts the title text **and**
      reload-on-click (`testing.md`).
- [ ] The harness stand-in header title is updated to "E-mail Organizer" (screenshot fidelity).
- [ ] A committed Playwright screenshot at `e2e/screenshots/59/app-title.png` shows the new title,
      taken via the harness seam, and is **git-tracked**.
- [ ] The code PR description embeds/links the screenshot via a **raw-bytes URL**.
- [ ] Type-checks and builds cleanly; no ESLint errors; Prettier-clean; full `npm run test` passes.
- [ ] **Manual live verification before merge:** in the running app, apply a customer tab +
      project + type filter, click the title, and confirm the page reloads and all three filters
      reset to defaults (AC2).

## Assumptions & open questions

- **OQ1 — Filter-clearing mechanism.** Clear filters by a **full page reload**
  (`window.location.reload()`), so the in-memory filter state resets on re-mount (recommended —
  matches the AC wording "refreshes the page" literally and needs no cross-component wiring)
  **or** implement an **SPA soft-reset** (a `resetFilters` callback on `useOrganizer` threaded to
  the title, clearing selections without a real reload — snappier, no re-auth/re-fetch, but does
  **not** literally "refresh the page")? Reply **A** (reload) or **B** (soft-reset).
- **OQ2 — Clickable title element.** Render the title as a Fluent **`Button appearance="transparent"`**
  (recommended — the reload is an *action*, and Button gives accessible keyboard/focus behaviour for
  free) **or** as a Fluent **`Link`** (reads more like the conventional "logo/home" navigation link,
  but `Link` is semantically navigation and wants an `href`)? Reply **A** (Button) or **B** (Link).
- **OQ3 — AC2 real-browser verification.** Verify the *filter-clearing* by the **reload-wiring unit
  test plus by-construction reasoning and a manual live check** (recommended — the harness models
  filters via URL params, not live React state, and `reload()` preserves the query string, so a
  harness E2E would *re-seed* rather than clear filters and would test harness-specific behaviour,
  not the real mechanism) **or** invest in **extending the harness with live interactive filter
  state** so an automated E2E can drive set-filter → click-title → assert-cleared? Reply **A**
  (unit + construction + manual) or **B** (extend harness for an E2E).

## Files/areas affected

- `src/components/TopBar/useTopBar.ts` — add `reloadApp`.
- `src/components/TopBar/TopBar.tsx` — rename title, make it a clickable Fluent control.
- `src/components/TopBar/TopBar.test.tsx` — **new** component test.
- `src/harness.tsx` — update stand-in header title text.
- `e2e/app-title.spec.ts` — **new** Playwright title assertion + screenshot capture.
- `e2e/screenshots/59/app-title.png` — **new**, committed visual evidence.
