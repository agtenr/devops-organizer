# Plan — Story 35: Top bar

## Context
The app currently renders only a hello-world screen (`src/App/App.tsx`). This story adds the
**top navigation bar**: a fixed bar across the top of the page showing the app title in the
centre, and the signed-in user's display name plus a sign-out control on the right. Once present,
it becomes the persistent chrome every later feature (customer tabs, sidebar, list) sits beneath.

The story explicitly declares a dependency on **#29** (scaffold — already merged) and **#30**
(authentication — MSAL sign-in). The display name and the sign-out action are both sourced from
authentication, so the bar's *logic* consumes MSAL. The stack and conventions are fixed by
`.claude/rules/frontend-architecture.md` (Vite + React + TypeScript, Fluent UI v9, griffel
styling, logic-in-hooks) and `.claude/rules/authentication.md` (MSAL React).

## Keep it simple
This is one presentational component plus a thin logic hook. Concrete non-goals:
- **No auth infrastructure.** This story does **not** add MSAL packages, `MsalProvider`, config, or
  the sign-in flow — that is story #30. This story *consumes* what #30 provides
  (`.claude/rules/authentication.md`).
- **No customer tabs, sidebar, or list.** Only the top bar; the body below it stays as-is for now
  (`.claude/rules/frontend-architecture.md` UI layout invariants — those are later stories).
- **No state-management decision.** The bar reads its data from the MSAL account via its hook; no
  Context/TanStack introduced (`frontend-architecture.md` leaves that open).
- **No responsive/mobile design, no theming toggle, no settings menu.** The bar is a single fixed
  row; nothing beyond the three elements the ACs name.

## Implementation approach
Add a `TopBar` component in its own folder under a new `src/components/` grouping, split into
rendering (`.tsx`) and logic (colocated hook) exactly as `frontend-architecture.md` requires. The
component is **presentational** — it takes `userDisplayName` and `onSignOut` as props — so it is
fully unit-testable without any auth context. The colocated `useTopBar` hook is the seam that
reads the display name and the sign-out action from MSAL; `App.tsx` wires the hook into the
component.

Concrete files:
- **`src/components/TopBar/TopBar.tsx`** — presentational. Props
  `{ userDisplayName: string; onSignOut: () => void }`. Renders a fixed bar using griffel
  `makeStyles` (`position: 'fixed'`, `top/left/right: 0`, a `zIndex` above content, a
  `height`, horizontal padding, and Fluent `tokens` for background/stroke). Three regions:
  left spacer, centred title (`Title3`/`Text` weight-semibold: **"Azure DevOps E-mail Organizer"**),
  right cluster (a `Text` with the display name + a Fluent `Button appearance="subtle"` labelled
  **"Sign out"** wired to `onSignOut`). Use Fluent components + tokens only — no hand-rolled CSS
  values where a token exists.
- **`src/components/TopBar/useTopBar.ts`** — logic hook. Uses `@azure/msal-react` `useMsal()` to
  get `instance` and `accounts`; returns `userDisplayName` from `accounts[0]?.name` (fallback to
  `accounts[0]?.username ?? ''`) and `onSignOut: () => instance.logoutRedirect()`. This is where
  the **#30 dependency** lives — it imports MSAL and assumes a `MsalProvider` is mounted above it.
- **`src/components/TopBar/TopBar.test.tsx`** — Vitest component test (rendered through
  `FluentProvider`/`webLightTheme`).
- **`src/App/App.tsx`** (changed) — render `<TopBar {...useTopBar()} />` at the top, keeping the
  existing hello-world body beneath it (so nothing else regresses and the e2e smoke test stays
  green). Add top padding/margin on the body equal to the bar height so the fixed bar doesn't
  overlap content.

## Data contracts
The one boundary is the `TopBar` component ↔ its caller (`App` via `useTopBar`):

```ts
interface TopBarProps {
  userDisplayName: string;   // MSAL AccountInfo.name; '' when no account
  onSignOut: () => void;     // triggers MSAL logout (redirect)
}
```

`useTopBar()` returns an object structurally matching `TopBarProps` so `App` can spread it
directly: `<TopBar {...useTopBar()} />`. Field names/types must match on both sides.

## Task breakdown
1. **Presentational `TopBar` component.** Create `src/components/TopBar/TopBar.tsx` with the
   `TopBarProps` interface and the fixed-bar layout (griffel `makeStyles` + Fluent `tokens`,
   centred title, right-aligned name + sign-out `Button`). Rule:
   `.claude/rules/frontend-architecture.md` (Fluent UI + griffel for all UI; component-per-folder;
   rendering in `.tsx`).
2. **`useTopBar` logic hook.** Create `src/components/TopBar/useTopBar.ts` consuming
   `useMsal()` → display name + `logoutRedirect`. Rules:
   `.claude/rules/authentication.md` (MSAL React; never store tokens elsewhere; sign-out via MSAL)
   and `.claude/rules/frontend-architecture.md` (logic lives in a colocated hook, not in JSX).
3. **Wire into `App`.** Update `src/App/App.tsx` to render `<TopBar {...useTopBar()} />` above the
   existing body, offsetting the body by the bar height. Rule:
   `.claude/rules/frontend-architecture.md` (UI layout invariants; logic-in-hook consumption).
4. **Component test.** Create `src/components/TopBar/TopBar.test.tsx` rendering `TopBar` inside
   `FluentProvider`/`webLightTheme` and asserting: the title text renders, the display name
   renders, a "Sign out" button exists, and clicking it calls the `onSignOut` prop
   (`fireEvent`/`userEvent`). Rule: `.claude/rules/testing.md` (render through the provider
   wrapper; prefer testing behaviour directly).

## Assumptions & open questions
- **Auth dependency & sequencing:** this plan assumes **#30 merges first**, adding the MSAL
  packages and mounting `MsalProvider` above `App` in `src/main.tsx`; `useTopBar` then consumes
  `useMsal()`. Until #30 lands, this story does not type-check or run (the import and the provider
  are absent). Alternative the reviewer may prefer: ship `TopBar` **presentational-only** now with
  temporary placeholder wiring in `App` (static name + no-op sign-out), decoupling it from #30 at
  the cost of throwaway glue. Recommended: consume MSAL (no throwaway code); sequence after #30.
- **Rule vs. story — title in the bar:** `frontend-architecture.md`'s UI invariant says the top bar
  shows "**only** the logged-in user's display name and a log-out button — nothing else," but this
  story requires the app **title** centred in the bar. Recommended: follow the story (title + name +
  sign-out) and update the rule's wording to admit the title. Reviewer may instead want the title
  kept out of the bar.
- **Sign-out control — button vs. link:** the ACs say "sign-out **button**" (twice); the description
  says "sign-out **link**." Recommended: a Fluent `Button` (`role="button"` matches the ACs and is
  the primary wording). Reviewer may prefer a Fluent `Link` to match the description.
- **Sign-out method — redirect vs. popup:** `useTopBar` uses `instance.logoutRedirect()`.
  Recommended to mirror whatever interactive flow #30 chose for sign-in (redirect vs. popup) for
  consistency; if #30 uses popup, switch to `logoutPopup()`.
- **Component folder location:** placing the component under a new `src/components/TopBar/` grouping
  (vs. directly under `src/App/`). `frontend-architecture.md` explicitly permits either; a
  `components/` grouping is introduced here for non-root feature components.
- **Body after adding the bar:** the existing hello-world body is kept beneath the fixed bar for now
  so the e2e smoke test stays green. Reviewer may prefer removing the hello-world placeholder as
  part of this story (which would require updating `e2e/smoke.spec.ts`).

## Considerations
- **Fixed-bar overlap:** a `position: fixed` bar is lifted out of flow, so the body needs top
  padding equal to the bar height or its first content hides behind the bar — handled in task 3.
- **Empty display name:** if `accounts[0]` is undefined (e.g. transient state before the account
  resolves), the hook yields `''`; the bar renders without a name rather than crashing, consistent
  with the "never crash on a missing signal" spirit of the domain rules.
- **E2E of sign-out is not automatable now:** exercising the real sign-out flow needs a live
  Entra login, which the harness can't drive headlessly — hence no e2e for it (see Testing).

## Testing recommendations
- **Spec-level (behavioral) tests? Yes.** A `TopBar.test.tsx` that mounts the presentational
  component through the `FluentProvider` wrapper and asserts the title text, the display name, the
  presence of the "Sign out" button, and that clicking it invokes `onSignOut`. This is cheap and
  high-value because the component is prop-driven and needs no auth context.
- **Live / end-to-end test? No (for the sign-out flow).** The sign-out behaviour depends on a real
  MSAL session that cannot be driven headlessly without live Entra credentials; adding a brittle
  auth-dependent e2e is not worth it now. Keep the existing hello-world smoke test green (the body
  is retained), and grow e2e once auth is stable.

## Definition of done
- [ ] The top bar renders fixed at the top of the page and does not scroll with the body (AC 1; verified via the `position: fixed` style and body offset).
- [ ] The app title "Azure DevOps E-mail Organizer" is shown centred in the bar (AC 2 + story description).
- [ ] The signed-in user's display name and a sign-out control are shown at the right of the bar (AC 3).
- [ ] Clicking the sign-out control triggers MSAL logout (AC 4), asserted in the component test via the `onSignOut` prop and wired to `instance.logoutRedirect()` in `useTopBar`.
- [ ] Rendering lives in `TopBar.tsx` and all logic (display name + sign-out) lives in the colocated `useTopBar` hook — no logic inline in JSX (`frontend-architecture.md` "done" bar).
- [ ] All UI is built from Fluent UI v9 components/tokens with griffel styling — no hand-rolled CSS where a token exists (`frontend-architecture.md`).
- [ ] Sign-out goes through MSAL only; no tokens are read/stored outside MSAL's cache (`authentication.md` invariants).
- [ ] `npm run test` is green including the new `TopBar.test.tsx`; `npm run build` and `npm run lint` are clean (`frontend-architecture.md` "done" bar; `testing.md`).

## Files/areas affected
- **New:** `src/components/TopBar/TopBar.tsx`, `src/components/TopBar/useTopBar.ts`,
  `src/components/TopBar/TopBar.test.tsx`.
- **Changed:** `src/App/App.tsx` (render the bar + offset the body). Possibly
  `.claude/rules/frontend-architecture.md` (reconcile the "nothing else" invariant with the title —
  pending the open question).
- **Depends on (not created here):** `@azure/msal-react` + `MsalProvider` in `src/main.tsx` from
  story #30.
- **Untouched:** categorization/domain code, all other rules and skills.
