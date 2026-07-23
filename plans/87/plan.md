# Plan: Dark theme

## Context

The app currently renders exclusively in Fluent UI's `webLightTheme`. Users need a way to switch
between light and dark mode, with their preference persisted across sessions so it survives a
browser refresh or a new login.

## Keep it simple

- **No system-preference detection.** The story asks for a button; we are not adding
  `prefers-color-scheme` auto-detection on top of it.
- **No per-component dark styling.** Fluent UI v9's `webDarkTheme` handles the entire visual
  switch — we never write custom dark-mode CSS.
- **Two themes only.** No "follow system" or custom theme picker — just light and dark.

## AC coverage

| AC | Status | Where |
|---|---|---|
| Switch between light and dark mode via top-nav button | covered | Task 3 (TopBar toggle icon) |
| Selection persisted between sessions | covered | Tasks 1-2 (approot service + context) |
| Default is light mode | covered | Task 2 (context defaults to `'light'`) |

## Implementation approach

Three layers:

1. **Persistence service** (`src/services/theme/themeService.ts`) — read/write a JSON file
   (`theme-preference.json`) to the user's OneDrive app folder (`/me/drive/special/approot:`),
   reusing the same `Files.ReadWrite` Graph scope that persists the project GUID map (story 42).
   The shape is `{ "theme": "light" | "dark" }`. A 404 (first use) resolves to `'light'`.

2. **Theme state + context** (`src/components/ThemeProvider/useTheme.ts` / `ThemeProvider.tsx`) —
   a React context providing `{ theme: Theme, themeMode: 'light' | 'dark', toggleTheme: () =>
   Promise<void> }`. The `ThemeProvider` component owns the async fetch on mount (after auth)
   and the save-on-toggle action. It wraps the app inside `MsalAuthenticationTemplate` so the
   Graph client is available.

3. **TopBar toggle** — an icon button (`<SunRegular>` / `<MoonRegular>` from `@fluentui/react-icons`,
   already installed) in the user group, consuming `useTheme()` to read the current mode and call
   `toggleTheme()`.

The `ThemeProvider` sits inside the auth gate in `App.tsx`, wrapping the shell. The
`FluentProvider` moves from `main.tsx` into `ThemeProvider` so it receives the dynamic theme value.
`main.tsx` becomes a bare `MsalProvider` mount.

## Data contracts

**Theme preference file** (OneDrive app folder: `theme-preference.json`):

```json
{ "theme": "light" }
```

| Field | Type | Notes |
|---|---|---|
| `theme` | `"light"` \| `"dark"` | Written by the app on each toggle. Read on app load; 404 → default `'light'`. |

## Task breakdown

1. **Create theme persistence service** — `src/services/theme/themeService.ts`
   Functions: `fetchThemePreference(client: Client): Promise<'light' | 'dark'>` and
   `saveThemePreference(client: Client, theme: 'light' | 'dark'): Promise<void>`.
   Pattern: mirror `projectMapService.ts` (same `approot` Graph path, same 404 → default behavior).
   Rules: `.claude/rules/authentication.md` (reuse `Files.ReadWrite` scope).

2. **Create theme context and provider** — `src/components/ThemeProvider/ThemeProvider.tsx`,
   `src/components/ThemeProvider/useTheme.ts`
   The `useTheme` hook exports the context consumer. `ThemeProvider` fetches the saved preference
   on mount via the Graph client (created from the MSAL account), defaults to `'light'` until the
   fetch resolves, and calls `saveThemePreference` on each toggle.
   Rules: `.claude/rules/frontend-architecture.md` (logic in hook, rendering in component).

3. **Wire ThemeProvider into app shell** — `src/App/App.tsx`, `src/main.tsx`
   Move `FluentProvider` from `main.tsx` into `ThemeProvider`. `main.tsx` renders only
   `MsalProvider > App`. `App.tsx` wraps the shell in `ThemeProvider` inside the auth gate so
   the Graph client is available during the fetch.
   Rules: `.claude/rules/frontend-architecture.md`.

4. **Add dark/light toggle icon to TopBar** — `src/components/TopBar/TopBar.tsx`,
   `src/components/TopBar/useTopBar.ts`
   Import `useTheme` and render a `title="Dark mode"` / `title="Light mode"` icon button using
   `<MoonRegular>` / `<SunRegular>` placed **inside the user group** (between display name and Log
   out). The icon shows the **target theme** (Sun = click to switch to light, Moon = click to
   switch to dark). Keep the hook thin — the toggle call lives in the provider, not the hook.
   Rules: `.claude/rules/frontend-architecture.md` (Fluent UI v9 components).

5. **Update harness for e2e** — `src/harness.tsx`
   Wrap the harness in `ThemeProvider` (or hardcode a dark-mode variant via `?state=dark`) so
   screenshots can capture both themes. The harness's `FluentProvider` also moves inside
   `ThemeProvider`.

6. **Unit tests** — `src/services/theme/themeService.test.ts`,
   `src/components/TopBar/TopBar.test.tsx` (extend existing tests)
   Service: mock Graph client, verify 404 → `'light'`, valid JSON → `'dark'`, malformed → `'light'`,
   save writes correct payload. TopBar: verify toggle icon renders and calls `toggleTheme`.
   Rules: `.claude/rules/testing.md` (render through `FluentProvider`, pure service tested directly).

7. **Committed screenshot** — `e2e/screenshots/87/dark-mode.png`
   Playwright screenshot of the app in dark mode via the harness (`?state=dark`).
   Rules: `.claude/rules/testing.md` (harness seam, not real mailbox).

## Assumptions & open questions

All assumptions resolved by review:

1. **Toggle placement** — ratified: **inside** the user group (between display name and Log out).
2. **Icon semantics** — ratified: **target** theme icon (Sun = click to switch to light,
   Moon = click to switch to dark).

## Considerations

- **Brief flash on first load.** The context defaults to `'light'` until the Graph call returns, so
  a user whose saved preference is `'dark'` will see a light→dark flash on first load. This is
  acceptable: the flash is a single React re-render (tens of milliseconds) and `main.tsx` blocks
  React render behind `msalInstance.initialize()` already, so adding the theme fetch would add a
  second delay on every load for a marginal visual gain. If this proves objectionable, a
  `localStorage` cache of the last known theme (read synchronously) eliminates the flash entirely —
  but that adds a second storage layer.

- **Graph call on every toggle.** Each theme change fires a `PUT` to OneDrive approot. This is
  consistent with the project map save pattern (story 42). No throttling is added — a user toggles
  theme rarely, and the write is small.

## Testing recommendations

- **Altitude:** unit (Vitest) for the service and hook logic; e2e (Playwright) for the visual
  screenshot.
- **Must-cover list:**
  - Service receives 404 → resolves to `'light'` (first-time user).
  - Service receives valid `{"theme":"dark"}` → resolves to `'dark'`.
  - Service receives malformed content → resolves to `'light'` (graceful degradation).
  - Service `saveThemePreference` → Graph `PUT` with correct JSON payload and path.
  - TopBar toggle icon calls `toggleTheme` on click.
  - TopBar icon switches between sun and moon on mode change.

## Definition of done

- [ ] Theme service reads/writes the preference from OneDrive approot (404 → `'light'` default).
- [ ] Theme context provides `themeMode` and `toggleTheme` to descendants.
- [ ] `FluentProvider` receives `webLightTheme` or `webDarkTheme` dynamically from context.
- [ ] TopBar renders a toggle icon button in the user group that switches themes on click.
- [ ] Theme preference persists across browser refresh (verified manually or via e2e).
- [ ] Default theme is `'light'` for a user with no saved preference.
- [ ] Vitest suite passes (`npm run test`).
- [ ] No ESLint errors; formatted with Prettier (`npm run format:check`).
- [ ] Type-checks and builds cleanly (`npm run build`).
- [ ] Committed dark-mode screenshot under `e2e/screenshots/87/`, referenced from the PR.
- [ ] Logic in hooks, rendering in components (`.claude/rules/frontend-architecture.md`).
- [ ] No new Graph scopes required — reuses existing `Files.ReadWrite` (`.claude/rules/authentication.md`).

## Files/areas affected

- **New:**
  - `src/services/theme/themeService.ts`
  - `src/services/theme/themeService.test.ts`
  - `src/components/ThemeProvider/ThemeProvider.tsx`
  - `src/components/ThemeProvider/useTheme.ts`
  - `e2e/screenshots/87/dark-mode.png`

- **Modified:**
  - `src/main.tsx` — move `FluentProvider` into `ThemeProvider`.
  - `src/App/App.tsx` — wrap shell in `ThemeProvider`.
  - `src/components/TopBar/TopBar.tsx` — add toggle icon button.
  - `src/components/TopBar/useTopBar.ts` — import and re-export `useTheme`.
  - `src/components/TopBar/TopBar.test.tsx` — extend with toggle tests.
  - `src/harness.tsx` — wrap in `ThemeProvider`, support `?state=dark`.
