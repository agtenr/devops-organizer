# Plan — Story 29: Project setup

## Context
The repository is greenfield: only `.claude/` config and `.gitignore` are tracked — there is
no `package.json`, no `src/`, no toolchain. This story scaffolds the front-end application so
that later stories (authentication, categorization service, UI) have a working, conventions-compliant
base to build on. The outcome is a runnable "hello world" SPA plus wired-up build, lint/format,
unit-test, and end-to-end test harnesses — **no business logic**.

The stack is fixed by the project rules (`.claude/rules/frontend-architecture.md`): a **Vite +
React + TypeScript** SPA using **Fluent UI v9**, package-managed with **npm**, linted with
**ESLint (typescript-eslint + react-hooks) + Prettier**, unit-tested with **Vitest**, and
end-to-end tested with **Playwright**.

## Keep it simple
Scaffold-only. Concrete non-goals for this story:
- **No authentication.** No MSAL / Microsoft Graph packages, config, or code — the story says
  "No authentication required yet"; that is a separate story (`.claude/rules/authentication.md`).
- **No categorization service, email models, or feature UI.** No customer tabs, sidebar, list view,
  or categorization logic — those are later stories (`.claude/rules/categorization-domain.md`).
- **No state-management decision.** Context vs. TanStack Query stays undecided; hello world needs
  neither (`frontend-architecture.md` leaves it open).
- **No CI/CD or deployment.** Local-only, per `.claude/CLAUDE.md` open TODOs.
- **No real/business tests.** Only trivial smoke tests that prove each test harness runs.
- **No pre-created empty folders** (`services/`, `hooks/`, `models/`). Add each when the first
  story needs it, to avoid a tree of empty directories.

## Implementation approach
Scaffold the files **explicitly** (do not rely on the interactive `npm create vite` wizard) so the
result is deterministic and reviewable. Create the standard Vite React-TS project files at the repo
root, add the Fluent UI provider at the React root, render a minimal Fluent-based hello-world screen,
and wire the four harnesses whose commands the existing skills already promise
(`npm run build|dev|test|lint|format|test:e2e`). After scaffolding, run each skill's command once to
confirm the stub skills now reflect reality, and record the settled `src/` tree back into
`frontend-architecture.md` (that file explicitly defers the tree "until the first components are
scaffolded").

Key files to create (repo root unless noted):
- `package.json` — dependencies + the exact scripts the skills call: `dev`, `build`, `preview`,
  `test`, `lint`, `format`, `test:e2e`.
- `tsconfig.json` + `tsconfig.node.json` — strict TypeScript.
- `vite.config.ts` — React plugin + Vitest test block (`environment: 'jsdom'`, `globals: true`,
  a `setupTests.ts` for `@testing-library/jest-dom`).
- `index.html` — Vite entry.
- `src/main.tsx` — React root wrapped in Fluent UI `FluentProvider` with `webLightTheme`.
- `src/App/App.tsx` — hello-world screen built from a Fluent component (component-per-folder per
  `frontend-architecture.md`; no logic hook yet — there is no logic to extract).
- `src/App/App.test.tsx` — one Vitest smoke test asserting the hello-world text renders.
- `src/setupTests.ts` — jest-dom matchers.
- `eslint.config.js` — ESLint flat config (typescript-eslint + eslint-plugin-react-hooks).
- `.prettierrc` (+ `.prettierignore`) — Prettier config.
- `playwright.config.ts` — Playwright config that boots the Vite dev server (`webServer`).
- `e2e/smoke.spec.ts` — one Playwright test asserting the hello-world screen loads.

Dependencies (scaffold scope only): `react`, `react-dom`, `@fluentui/react-components`; dev:
`vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `vitest`,
`jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `eslint`, `typescript-eslint`,
`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `prettier`, `@playwright/test`.

## Task breakdown
1. **Initialize npm project + TypeScript config.** Create `package.json` (name, `"type": "module"`,
   scripts, deps above), `tsconfig.json`, `tsconfig.node.json`. Rule: `frontend-architecture.md`
   (TypeScript + Vite + npm).
2. **Add Vite + React entry.** Create `index.html`, `src/main.tsx` (React root inside
   `FluentProvider`/`webLightTheme`), `vite.config.ts` with `@vitejs/plugin-react`. Rule:
   `frontend-architecture.md` (Vite/React/Fluent UI).
3. **Build the hello-world component.** Create `src/App/App.tsx` rendering a Fluent component (e.g. a
   `Text`/`Title1`) that shows a hello-world message. Rule: `frontend-architecture.md` (Fluent UI for
   all UI; component-per-folder).
4. **Wire ESLint + Prettier.** Create `eslint.config.js` (typescript-eslint + react-hooks) and
   `.prettierrc`/`.prettierignore`; add `lint` and `format` scripts. Ensure the scaffold passes both.
   Rule: `frontend-architecture.md` (ESLint + Prettier conventions & "done" bar).
5. **Wire Vitest.** Add the Vitest block to `vite.config.ts`, create `src/setupTests.ts`, and add one
   smoke test `src/App/App.test.tsx`; add the `test` script. Rule: `.claude/rules/testing.md` (Vitest
   is the runner).
6. **Wire Playwright.** Add `@playwright/test`, `playwright.config.ts` (with `webServer` booting
   `npm run dev`), `e2e/smoke.spec.ts`, and the `test:e2e` script. Rule: `.claude/rules/testing.md`
   (Playwright for E2E — this story makes the aspirational harness real).
7. **Verify + record.** Run `npm install` then each skill command (`build`, `dev`, `test`, `lint`,
   `format`, `test:e2e`) to confirm they pass; update `.claude/rules/frontend-architecture.md` to
   record the now-settled `src/` tree (replacing its "TODO (undecided): the concrete `src/` tree").
   Rules: `frontend-architecture.md` + all five skills' "done" bars.

## Assumptions & open questions
- **Package scope:** install only the scaffold packages now and defer auth packages (`@azure/msal-*`, `@microsoft/microsoft-graph-client`) to the authentication story, since "no authentication required yet." Prefer installing everything up-front instead?
- **Fluent UI in hello world:** render the hello-world text via a Fluent UI v9 component inside `FluentProvider` (to prove the griffel/theme pipeline), rather than plain HTML. Acceptable, or is plain HTML fine for a placeholder?
- **`src/` tree shape:** create only what hello world needs (`src/main.tsx`, `src/App/…`) and add `services/`, `hooks/`, `models/` when a story first needs them — rather than stubbing empty folders now. Prefer the full skeleton created up-front?
- **`.env.sample` deferral:** defer committing `.env.sample` and any `VITE_*` wiring to the authentication story, since nothing consumes those vars until auth exists. Prefer a documented `.env.sample` committed now?
- **Smoke tests vs. "no real tests yet":** add exactly one Vitest smoke test and one Playwright smoke test purely to prove the harnesses run — interpreting "no real tests yet" as no business-logic tests. Prefer zero tests (config only), or a different placeholder?
- **ESLint flat config:** use the modern `eslint.config.js` flat config (ESLint 9 default) rather than legacy `.eslintrc`. Any objection?

## Considerations
- **Node version:** Vite (5/6) requires a recent Node (18+/20+). The implementer should confirm the
  local Node on this Windows machine satisfies Vite's engine requirement before scaffolding.
- **Playwright browser binaries:** first E2E run needs `npx playwright install` to download browsers —
  a one-time local step (and a future CI consideration, though no CI is configured yet).
- **Skills are currently stubs:** they document *intended* commands; scaffolding makes them real, which
  is why task 7 runs each one to confirm.

## Testing recommendations
- **Spec-level (behavioral) tests? Yes (minimal).** One Vitest smoke test asserting the hello-world
  renders — enough to prove the unit-test harness is wired, consistent with "unit testing framework is
  set up (no real tests yet)."
- **Live / end-to-end test? Yes.** One Playwright smoke test asserting the app loads and shows the
  hello-world screen — this directly exercises the "Application can be tested E2E using Playwright"
  requirement and proves the harness end-to-end.

## Definition of done
- [ ] `npm install` succeeds and `package.json` lists React, Vite, TypeScript, Fluent UI v9, ESLint, Prettier, Vitest, and Playwright (AC: all needed packages in `package.json`).
- [ ] `npm run dev` serves the SPA locally and a basic hello-world screen renders (AC: run locally + hello world shown).
- [ ] `npm run build` completes with no TypeScript or Vite errors (build skill "done" bar).
- [ ] `npm run lint` reports no ESLint errors and Prettier reports no formatting changes needed (frontend-architecture "done" bar).
- [ ] `npm run test` runs Vitest green, including the hello-world smoke test (testing.md).
- [ ] `npm run test:e2e` runs Playwright green with the hello-world smoke test (AC/requirement: E2E via Playwright).
- [ ] Stack matches the project rules — Vite + React + TypeScript + Fluent UI v9, managed with npm (AC: project guidelines followed).
- [ ] No authentication or Graph packages/config/scopes were added (story: no auth yet).
- [ ] The settled `src/` tree is recorded in `.claude/rules/frontend-architecture.md`, replacing its "TODO (undecided)" note.

## Files/areas affected
- **New:** `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`,
  `src/main.tsx`, `src/App/App.tsx`, `src/App/App.test.tsx`, `src/setupTests.ts`, `eslint.config.js`,
  `.prettierrc`, `.prettierignore`, `playwright.config.ts`, `e2e/smoke.spec.ts`.
- **Changed:** `.claude/rules/frontend-architecture.md` (record the settled `src/` tree).
- **Untouched:** all other `.claude/` rules and skills; no auth/categorization code.
