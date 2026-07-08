# Plan — Story 30: Authentication setup

## Context
The scaffold (story 29, *Implementation complete*) gives us a runnable Vite + React + TypeScript
SPA with a Fluent UI hello-world screen, but **no authentication**. This story gates the app
behind an organizational (Entra ID) sign-in: on load the app detects whether the user is signed
in, and if not **redirects** them to the Microsoft login page (never a popup). After a successful
sign-in the user is returned to the app, their **display name** is shown in a top bar next to a
**log-out** button, and the session is **remembered across browser sessions** so they are not
re-prompted every visit. If sign-in fails, an explanatory **error page** is shown.

The stack is fixed by `.claude/rules/authentication.md`: **MSAL React** (`@azure/msal-react`) +
**msal-browser** (`@azure/msal-browser`) for the SPA redirect flow, against the **existing** app
registration (client `9d1fdce9-fb8c-432e-a293-8a879ce34c26`, tenant
`17b35a1d-057c-4ac5-a15a-08758f7a7064`), with all config read from `VITE_*` env vars.

## Keep it simple
Sign-in / sign-out / error-page only. Concrete non-goals for this story:
- **No Microsoft Graph and no mail reading.** The display name comes from the MSAL account's ID-token
  `name` claim — `@microsoft/microsoft-graph-client`, the `DevOps` folder read, and the `Mail.Read`
  scope are the **mail-reading** story, not this one (`.claude/rules/authentication.md`).
- **No categorization, tabs, sidebar, or list view.** Those are later stories; this story renders
  only the top bar and the auth gate around an otherwise-placeholder authenticated area.
- **No custom token/session store.** Tokens live only in MSAL's own cache — we merely choose its
  location (see open questions). No hand-rolled persistence.
- **No route-based error page / router.** A single Fluent error component rendered by the auth
  template is enough; no `react-router` is introduced.
- **No silent-token / `acquireToken` plumbing.** There is no protected resource to call yet, so we
  only do interactive sign-in + the display name; token acquisition arrives with the mail story.

## Implementation approach
Create the MSAL instance and config in a small **`src/auth/`** module, wrap the app in
`MsalProvider` at the React root, and use MSAL React's **`MsalAuthenticationTemplate`** with
`InteractionType.Redirect` to auto-initiate the redirect login for unauthenticated users and to
supply the loading and error UIs. The authenticated area renders a **TopBar** component (display
name + logout), following the project's component-per-folder + logic-in-a-hook convention.

MSAL React handles `handleRedirectPromise` internally inside `MsalProvider`, so we do **not** call
it ourselves (per the MSAL React FAQ). msal-browser v5 requires `await instance.initialize()`
**before** the instance is used, so `main.tsx` becomes async: initialize, then render.

Concrete files:
- **`src/auth/msalConfig.ts`** *(new)* — reads `import.meta.env.VITE_ENTRA_CLIENT_ID` /
  `VITE_ENTRA_TENANT_ID`, builds the msal-browser `Configuration`
  (`auth.clientId`, `auth.authority = https://login.microsoftonline.com/${tenantId}`,
  `auth.redirectUri = '/'`, `cache.cacheLocation = 'localStorage'`), and exports a singleton
  `msalInstance = new PublicClientApplication(config)` plus a `loginRequest: RedirectRequest`
  (default OIDC scopes only — see open questions). No IDs hardcoded; all via env.
- **`src/main.tsx`** *(changed)* — `await msalInstance.initialize()` then render
  `<MsalProvider instance={msalInstance}><FluentProvider theme={webLightTheme}><App/></FluentProvider></MsalProvider>`
  (FluentProvider inside MsalProvider so the loading/error/top-bar UIs all get the Fluent theme).
- **`src/App/App.tsx`** *(changed)* — replaces the hello-world heading with a
  `MsalAuthenticationTemplate` (`interactionType={InteractionType.Redirect}`,
  `authenticationRequest={loginRequest}`, `errorComponent={AuthError}`,
  `loadingComponent={AuthLoading}`) wrapping the authenticated area, which renders `<TopBar />`.
- **`src/components/TopBar/TopBar.tsx` + `useTopBar.ts`** *(new)* — the hook reads
  `accounts[0]?.name ?? accounts[0]?.username` via `useMsal()` and exposes `logout()` calling
  `instance.logoutRedirect()`; the `.tsx` renders the name + a Fluent `Button`. Per the layout
  invariant the bar shows **only** the name and the logout button.
- **`src/components/AuthError/AuthError.tsx`** *(new)* — receives the
  `MsalAuthenticationResult` (`error`) and renders an explanatory Fluent error page (title +
  `error.errorCode` / `error.message`).
- **`src/components/AuthLoading/AuthLoading.tsx`** *(new)* — a Fluent `Spinner` "Signing in…".
- **`.env.sample`** *(new)* — documents `VITE_ENTRA_CLIENT_ID` and `VITE_ENTRA_TENANT_ID`
  (committed; real `.env` stays gitignored).

Dependencies to add (exact-pinned, `npm install --save-exact`): `@azure/msal-browser` and
`@azure/msal-react` (latest at implementation time — currently `5.17.0` / `5.5.2`).

## Data contracts
- **Environment → app config** (`import.meta.env`, all strings). Names must match `.env.sample`,
  `.claude/rules/authentication.md`, and the code exactly:
  - `VITE_ENTRA_CLIENT_ID: string` → `Configuration.auth.clientId`
  - `VITE_ENTRA_TENANT_ID: string` → interpolated into `Configuration.auth.authority`
  - (`VITE_MAIL_FOLDER` is **not** consumed in this story — deferred to the mail story.)
- **MSAL account → UI**: the app reads only `AccountInfo.name` (preferred) with
  `AccountInfo.username` as fallback — both optional; the UI must not assume `name` is present.
- **Auth error → error page**: `AuthError` consumes `MsalAuthenticationResult.error` of type
  `AuthError | null` (`errorCode: string`, `message: string`).

## Task breakdown
1. **Add MSAL dependencies.** Add `@azure/msal-browser` and `@azure/msal-react` to `package.json`,
   **exact-pinned** (`npm install --save-exact`; no `^`/`~`/`*`). Rule:
   `.claude/rules/frontend-architecture.md` (exact pins, npm).
2. **Add `.env.sample`.** Document `VITE_ENTRA_CLIENT_ID` and `VITE_ENTRA_TENANT_ID` (with the known
   values as sample content is fine — they are not secrets for a browser SPA). Rule:
   `.claude/rules/authentication.md` (VITE_* config, committed `.env.sample`, no hardcoded IDs).
3. **Create `src/auth/msalConfig.ts`.** Build `Configuration` from `import.meta.env`, export
   `msalInstance` + `loginRequest`. `cacheLocation: 'localStorage'`; authority from tenant id;
   `redirectUri: '/'`. Rule: `.claude/rules/authentication.md` (MSAL React, least privilege, no
   hardcoding, tokens only in MSAL cache) + `frontend-architecture.md` (structure).
4. **Wire the provider in `src/main.tsx`.** `await msalInstance.initialize()`, then render inside
   `<MsalProvider>` (FluentProvider nested). Rule: `.claude/rules/authentication.md` (MSAL init) +
   `frontend-architecture.md` (`main.tsx` entry, FluentProvider).
5. **Build `TopBar` (component + `useTopBar` hook).** Display name + Fluent logout `Button`; hook
   holds the `useMsal`/`logoutRedirect` logic. Rule: `frontend-architecture.md` (component-per-folder,
   logic-in-hook, Fluent UI, top-bar layout invariant: name + logout only).
6. **Build `AuthError` and `AuthLoading` components.** Fluent-based error page (from the auth
   result's `error`) and a "Signing in…" spinner. Rule: `frontend-architecture.md` (Fluent UI) +
   `.claude/rules/authentication.md` (explanatory error page).
7. **Gate the app in `src/App/App.tsx`.** `MsalAuthenticationTemplate` (Redirect) with the error +
   loading components, rendering `<TopBar />` when authenticated. Rule:
   `.claude/rules/authentication.md` (redirect flow, never popup; token via MSAL) +
   `frontend-architecture.md` (logic split, Fluent UI).
8. **Update the superseded scaffold tests.** The hello-world screen is gone, so update
   `src/App/App.test.tsx` (mount under `FluentProvider` **and** a mocked/`MsalProvider` context;
   assert the auth gate/top-bar behavior instead of the old heading) and rewrite
   `e2e/smoke.spec.ts` to assert an unauthenticated visit initiates the Microsoft redirect (see
   testing recs) rather than the old heading. Rule: `.claude/rules/testing.md` (Vitest, provider
   wrapper; Playwright).
9. **Add unit tests.** `src/auth/msalConfig.test.ts` (given env vars → authority/clientId/cache are
   built correctly) and `src/components/TopBar/TopBar.test.tsx` (mocked `useMsal`: renders the name,
   logout button invokes `logoutRedirect`). Rule: `.claude/rules/testing.md`.
10. **Resolve the auth rule's scope TODO.** Update `.claude/rules/authentication.md`'s "TODO
    (undecided)" to record the settled login-scope decision (default OIDC scopes for sign-in;
    `Mail.Read` + folder endpoint deferred to the mail story). Rule:
    `.claude/rules/authentication.md`.
11. **Verify.** Run `npm run build`, `npm run lint`, `npm run test` green; then a **live** browser
    sign-in → name shown → logout round-trip; validate the Definition of done. Rules: all five
    skills' "done" bars + `.claude/rules/authentication.md` invariants.

## Assumptions & open questions
- **Token cache location = `localStorage`.** Chosen over `sessionStorage` because the AC requires the
  session be *remembered across browser sessions*; `sessionStorage` is cleared when the tab/browser
  closes. Trade-off: `localStorage` token storage has a wider XSS exposure surface. Reviewer: accept
  `localStorage`, or prefer `sessionStorage` and relax the "remembered across sessions" AC?
- **Login scopes = default OIDC only (no `Mail.Read` yet).** Sign-in requests only the implicit
  `openid`/`profile` scopes and reads the display name from the ID-token `name` claim, so no Graph
  client and no mail scope are added in this story (least privilege). Reviewer: OK to defer
  `Mail.Read` to the mail-reading story, or request it now at first sign-in to pre-consent?
- **`.env.sample` scope.** Adds only `VITE_ENTRA_CLIENT_ID` + `VITE_ENTRA_TENANT_ID` now;
  `VITE_MAIL_FOLDER` is deferred to the mail story since nothing reads it yet. Reviewer: include
  `VITE_MAIL_FOLDER` up front for completeness instead?
- **Auth-gating mechanism = `MsalAuthenticationTemplate` (Redirect).** Auto-initiates the redirect
  for unauthenticated users and supplies the loading/error components, matching the story's
  "automatically redirected" flow — rather than a manual "Sign in" button + `useMsalAuthentication`.
  Reviewer: prefer an explicit sign-in button instead of an automatic redirect on load?
- **New folder layout: `src/auth/` (config) + `src/components/` (TopBar/AuthError/AuthLoading).**
  Introduces a `components/` grouping alongside the existing `src/App/`. Reviewer: keep the new
  components directly under `src/App/` instead of a new `components/` grouping?
- **Automated E2E scope.** Playwright will assert only that an unauthenticated visit *initiates* the
  Entra redirect (URL leaves the app toward `login.microsoftonline.com`); the full credentialed
  round-trip is verified **manually** because scripting a real org login (with MFA) in the harness is
  fragile and unsafe. Reviewer: accept manual verification for the full flow, or invest in a
  Playwright login fixture with a test account?

## Considerations
- **App-registration redirect URI (prerequisite, human/admin).** The existing app registration
  (`9d1fdce9-…`) must list the app's origin as a **SPA** redirect URI — `http://localhost:5173` for
  local dev — or sign-in returns `AADSTS` redirect errors. This is an external Entra config task, not
  code; the error page will surface it if missing.
- **`main.tsx` becomes async** (`await initialize()` before render). Under React `StrictMode` the dev
  double-invoke is harmless; the instance is a module singleton so it initializes once.
- **`.env` is gitignored** — a developer must copy `.env.sample` to `.env` and fill the IDs before the
  app will sign in locally.
- **MSAL-dependent unit tests require mocking** `@azure/msal-react` hooks (`useMsal`) or wrapping in a
  real `MsalProvider`; a bare render of `TopBar`/`App` will throw without MSAL context.

## Testing recommendations
- **Spec-level (behavioral) tests? Yes.** Unit-test the pure config builder (`msalConfig.test.ts`:
  env → correct authority/clientId/cacheLocation) and `TopBar` with a mocked `useMsal` (renders the
  name; logout button calls `logoutRedirect`). These are the deterministic, mockable seams; the MSAL
  redirect itself is not unit-testable.
- **Live / end-to-end test? Yes.** A **manual live** browser test of the full round-trip (load →
  redirect to Microsoft → sign in with an org account → returned, name shown → logout), plus an
  **automated Playwright** check that an unauthenticated load initiates the redirect toward
  `login.microsoftonline.com`. The full credentialed flow stays manual (see the E2E open question).

## Definition of done
- [ ] Loading the app while unauthenticated redirects the browser to the Microsoft (Entra) login page via a **redirect** flow, never a popup (AC: org sign-in; AC: redirect not popup).
- [ ] After a successful sign-in the user is returned to the app and their **display name** is shown in the top bar (AC: name printed on screen).
- [ ] The top bar shows **only** the display name and a **log-out** button (frontend-architecture layout invariant).
- [ ] The log-out button signs the user out via `logoutRedirect` (AC: logout button next to the name).
- [ ] The session is remembered across browser sessions — reopening the app does not re-prompt sign-in (AC: remembered across sessions).
- [ ] A sign-in failure renders an explanatory error page showing the error details (AC: error page on failure).
- [ ] Client ID and tenant ID are read only from `VITE_*` env vars via `import.meta.env` — none hardcoded in source (authentication.md invariant).
- [ ] Least privilege: no `Mail.Read`/write or broader scopes and no Graph client added in this story (authentication.md invariant).
- [ ] Tokens are held only in MSAL's cache — no other token storage is introduced (authentication.md invariant).
- [ ] Auth logic lives in the `useTopBar` hook and `src/auth/msalConfig.ts`, not inline in JSX (frontend-architecture "done" bar).
- [ ] `.env.sample` is committed documenting the `VITE_*` vars and `.env` remains gitignored (authentication.md).
- [ ] New dependencies are exact-pinned — no `^`/`~`/`*` (frontend-architecture).
- [ ] `npm run build`, `npm run lint`, and `npm run test` all pass; component tests mount under `FluentProvider` (+ MSAL context) (testing.md).
- [ ] The full sign-in → name → logout round-trip is verified live in a browser (ratified live test).

## Files/areas affected
- **New:** `src/auth/msalConfig.ts`, `src/auth/msalConfig.test.ts`,
  `src/components/TopBar/TopBar.tsx`, `src/components/TopBar/useTopBar.ts`,
  `src/components/TopBar/TopBar.test.tsx`, `src/components/AuthError/AuthError.tsx`,
  `src/components/AuthLoading/AuthLoading.tsx`, `.env.sample`.
- **Changed:** `package.json` (MSAL deps, exact-pinned), `src/main.tsx` (async init + `MsalProvider`),
  `src/App/App.tsx` (auth gate + `TopBar`), `src/App/App.test.tsx` (superseded hello-world test),
  `e2e/smoke.spec.ts` (superseded hello-world smoke), `.claude/rules/authentication.md` (resolve the
  login-scope TODO).
- **Untouched:** all categorization/frontend feature code (none exists yet); no CI/CD.
