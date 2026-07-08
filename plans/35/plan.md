# Plan — Story 35: Top bar

## Context
Story 30 (*done*) already introduced a `TopBar` component as part of the auth gate: it renders the
signed-in user's **display name** on the left and a **log-out** button on the right
(`flex`, `space-between`), and the sign-out action already works via `logoutRedirect`. Story 35
finishes the top bar as a real navigation chrome:

- The bar is **fixed to the top** and does **not** scroll with the page content.
- The **app title** is shown **centered** in the bar; the title text is exactly
  **"Azure DevOps E-mail Organizer"**.
- The user's **display name** and a **sign-out** control sit in the **upper-right** corner.
- **Sign-out** works (already implemented in `useTopBar` — reused unchanged).

This is a focused restyle/relayout of the existing `TopBar.tsx` plus the addition of the title; the
sign-out logic (`useTopBar`) needs no change. It depends on #29 (scaffold) and #30 (auth), both done.

Two pre-existing facts this plan must handle (found while grounding):
1. The **repo test suite is red at HEAD.** `src/App/App.test.tsx` and `e2e/smoke.spec.ts` still
   assert the story-29 *"hello, devops organizer"* heading that story 30 removed, and the
   `TopBar.test.tsx` plan 30 promised was never added. Story 35's "done" bar requires a green
   Vitest suite, so repairing these is folded into this story.
2. The **`frontend-architecture.md` layout invariant** currently says the top bar shows *"only the
   logged-in user's display name and a log-out button — nothing else."* Story 35 explicitly adds a
   centered title, so that rule (and the matching comment in `TopBar.tsx`) must be reconciled here.

## Keep it simple
Relayout the one existing component and add the title — nothing more. Concrete non-goals:
- **No new hook / no logic change.** `useTopBar` already exposes `{ displayName, logout }`; it is
  reused verbatim. No new state, no context, no data library.
- **No routing, no theming toggle, no responsive/mobile breakpoints.** A single desktop-oriented
  three-zone layout is enough for a ~100-item, desktop-first app.
- **No new authenticated E2E flow.** A credentialed org sign-in can't be scripted safely in the
  harness (same constraint story 30 ratified); the Playwright smoke stays at the unauthenticated
  redirect check, and the authenticated view is verified manually.
- **No title configurability.** The title is a hardcoded UI string (not a secret, not an ID) — it is
  copy, not configuration, so it lives in the component, not an env var.

## Implementation approach
Change the **rendering** of `src/components/TopBar/TopBar.tsx` only; keep `useTopBar.ts` as-is.

Replace the current `space-between` flex with a **three-zone CSS grid**
(`gridTemplateColumns: '1fr auto 1fr'`) so the title is centered independent of the right group's
width: left column is an empty spacer, the **center column** holds the title (justified center), and
the **right column** holds the display-name + sign-out group (justified end). Make the `<header>`
**stick to the top** with `position: 'sticky', top: 0`, an opaque background
(`backgroundColor: tokens.colorNeutralBackground1`) and a `zIndex` so future scrolled content passes
*under* it, keeping the existing bottom border. Style everything with `griffel` `makeStyles` + Fluent
`tokens` (no hand-rolled CSS), per the frontend-architecture rule.

The title is a Fluent `Text` rendered as a semantic top-level heading
(`<Text as="h1" size={500} weight="semibold" align="center">Azure DevOps E-mail Organizer</Text>`)
so it is both styled by Fluent and exposes an accessible `heading` role for tests. The right group
wraps the existing `Text` (name) and sign-out `Button` in a flex container with a token gap. The
sign-out control stays a Fluent `Button` (an action, not navigation — see open questions) wired to
the existing `logout` from `useTopBar`.

Concrete files:
- **`src/components/TopBar/TopBar.tsx`** *(changed)* — three-zone grid, sticky header, centered `h1`
  title, right-aligned name+logout group; update the component doc-comment (it currently claims
  "only name + logout — nothing else").
- **`src/components/TopBar/useTopBar.ts`** *(unchanged)* — reused; `{ displayName, logout }` already
  match the need.
- **`.claude/rules/frontend-architecture.md`** *(changed)* — update the top-nav layout invariant to
  include the centered app title and the fixed-to-top behavior.
- **`src/components/TopBar/TopBar.test.tsx`** *(new)* — the real behavioral test for this story.
- **`src/App/App.test.tsx`** *(changed)* — remove the obsolete hello-world assertion (its subject no
  longer exists) so the Vitest suite is green.
- **`e2e/smoke.spec.ts`** *(changed)* — repoint from the removed hello-world heading to the
  unauthenticated-redirect check story 30 ratified, so the E2E smoke matches the auth-gated app.

## Task breakdown
1. **Relayout `TopBar.tsx` with the centered title and sticky positioning.** Three-zone grid
   (`1fr auto 1fr`); `position: sticky; top: 0` + opaque background + `zIndex`, keeping the bottom
   border; centered `<Text as="h1">Azure DevOps E-mail Organizer</Text>`; right group = existing
   name `Text` + sign-out `Button` (wired to `useTopBar().logout`) in a gap'd flex container. Update
   the doc-comment. Reuse `useTopBar` unchanged. Rule: `.claude/rules/frontend-architecture.md`
   (component-per-folder, logic-in-hook, Fluent UI + griffel tokens, top-bar layout invariant).
2. **Reconcile the top-bar layout invariant in the rule.** Update
   `.claude/rules/frontend-architecture.md`'s "UI layout invariants" top-nav bullet to state the bar
   is fixed to the top and shows the centered app title plus the display name + log-out on the right.
   Rule: `.claude/rules/frontend-architecture.md`.
3. **Add `src/components/TopBar/TopBar.test.tsx`.** Mount under the app's `FluentProvider`
   (`webLightTheme`); mock the colocated `./useTopBar` (`vi.mock`) to return a fixed
   `{ displayName, logout: vi.fn() }`. Assert: the title heading `Azure DevOps E-mail Organizer` is
   present (`getByRole('heading')`), the display name renders, and clicking the sign-out button calls
   `logout`. Rule: `.claude/rules/testing.md` (Vitest, render through the `FluentProvider` wrapper).
4. **Repair the stale scaffold tests so the suites are green.** Remove the obsolete hello-world
   assertion in `src/App/App.test.tsx` (subject removed in story 30; real UI coverage now lives in
   `TopBar.test.tsx`), and update `e2e/smoke.spec.ts` to assert an unauthenticated visit initiates the
   Entra redirect (URL heads to `login.microsoftonline.com`) instead of the removed heading. Rule:
   `.claude/rules/testing.md` (Vitest green; Playwright).
5. **Verify.** `npm run build`, `npm run lint`, `npm run test` all green (the suite is **red at
   baseline** — this is the gate that proves task 4 landed); then a **manual live** browser check:
   title centered, bar stays fixed on scroll, name + sign-out upper-right, sign-out round-trip. Rules:
   the `build`/`lint`/`test`/`e2e` skills' "done" bars + `.claude/rules/frontend-architecture.md`
   "what done looks like".

## Assumptions & open questions
- **Positioning = `position: sticky; top: 0`, not literal `position: fixed`.** The AC says "fixed",
  but `sticky` achieves the required behavior ("doesn't scroll with the page") while keeping the bar
  in normal flow, so growing content below needs no manual top-offset (a `fixed` bar is removed from
  flow and would overlap the first content unless every following section is padded). I proceed with
  `sticky`; if you want the literal `fixed` semantics, say so and I'll switch (and add the content
  offset).
- **Sign-out control stays a Fluent `Button`, not a `Link`.** The story description says "sign-out
  *link*" while the ACs say "sign-out *button*"; sign-out is an action (not navigation), so a
  `Button` is the accessibility-correct element. If you want it to *look* like a link, I'll use
  `appearance="transparent"`/`"subtle"` — still a button semantically. Flag if you disagree.
- **Fixing the red baseline suite is folded into this story.** `App.test.tsx` + `e2e/smoke.spec.ts`
  assert the removed story-29 hello-world and fail at HEAD; I repair them here (delete the dead App
  assertion, repoint the smoke to the redirect check) because story 35's DoD needs a green suite.
  Alternative: split this into a separate chore/story — tell me if you'd rather I not touch the
  scaffold tests here.

## Considerations
- **Title is a semantic `<h1>`** (accessible `heading` role) — chosen for a11y and so the unit/E2E
  tests can target it by role; it is the app's top-level heading.
- **Sticky/fixed needs an opaque background + `zIndex`** so scrolled content passes under the bar
  rather than showing through it; the existing bottom border is retained.
- **Nothing scrolls beneath the bar yet** (the authenticated area currently renders only `TopBar`),
  so the fixed/scroll behavior is only fully observable once list content lands — the manual live
  check should force overflow (e.g. temporary tall content or a zoomed viewport) to confirm it.
- **Three-zone grid centers the title independent of the right group's width.** At extreme narrow
  widths the zones could crowd; not handled — acceptable for a desktop-first, ~100-item app.

## Testing recommendations
- **Spec-level (behavioral) tests? Yes.** `TopBar.test.tsx` mounted under `FluentProvider` with a
  mocked `useTopBar`: the centered title heading renders with the exact text, the display name
  renders, and the sign-out button invokes `logout`. This is the deterministic, mockable seam for the
  story's behavior.
- **Live / end-to-end test? Yes (manual for the authenticated view).** A **manual live** browser
  check of the full result — title centered, bar fixed on scroll, name + sign-out upper-right,
  sign-out round-trip — because a credentialed org sign-in can't be scripted safely in the harness.
  The automated Playwright smoke stays at the unauthenticated-redirect assertion (no new authenticated
  E2E), consistent with story 30's ratified E2E decision.

## Definition of done
- [ ] The top bar is fixed to the top of the page and does not scroll with page content (AC).
- [ ] The app title **"Azure DevOps E-mail Organizer"** is shown centered in the bar (AC + description exact text).
- [ ] The signed-in user's display name and a sign-out control are shown in the upper-right corner (AC).
- [ ] The sign-out control signs the user out via `logoutRedirect` (AC), reusing `useTopBar` unchanged.
- [ ] Rendering stays in `TopBar.tsx` with logic in the `useTopBar` hook; styling uses Fluent UI + griffel tokens, no hand-rolled CSS (frontend-architecture "done" bar).
- [ ] The `frontend-architecture.md` top-nav layout invariant is updated to reflect the centered title + fixed-to-top behavior (rule reconciliation).
- [ ] `TopBar.test.tsx` mounts under `FluentProvider` and asserts the title heading, the display name, and that sign-out calls `logout` (testing.md provider-wrapper rule).
- [ ] The stale hello-world assertions in `App.test.tsx` and `e2e/smoke.spec.ts` are updated (suite was red at baseline).
- [ ] `npm run build`, `npm run lint`, and `npm run test` all pass (testing.md "done" bar).
- [ ] The authenticated top bar is verified live in a browser: title centered, bar fixed on scroll, name + sign-out upper-right, sign-out round-trip (ratified live test).

## Files/areas affected
- **New:** `src/components/TopBar/TopBar.test.tsx`.
- **Changed:** `src/components/TopBar/TopBar.tsx` (three-zone grid, sticky, centered title, right
  group, doc-comment), `.claude/rules/frontend-architecture.md` (top-nav invariant),
  `src/App/App.test.tsx` (drop obsolete hello-world assertion), `e2e/smoke.spec.ts` (redirect smoke).
- **Untouched:** `src/components/TopBar/useTopBar.ts` (reused as-is), `src/auth/*`, `src/main.tsx`,
  all categorization/tabs/sidebar/list code (later stories); no CI/CD.
